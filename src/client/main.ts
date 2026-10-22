import type { ClientStrings } from '../i18n/index.ts';
import { formatInt } from '../shared/format.ts';
import { fill } from '../shared/text.ts';
import { DEFAULT_STATE, parseState, serializeState, type ViewState } from '../shared/url-state.ts';
import { allowedCategories, initCategories } from './controls/categories.ts';
import { countryOptions, initCountries } from './controls/countries.ts';
import { initDateRange } from './controls/date-range.ts';
import { initPanels } from './controls/panels.ts';
import { initRandom } from './controls/random.ts';
import { initSearch } from './controls/search.ts';
import { initSort } from './controls/sort.ts';
import { byId, scrollToY } from './dom.ts';
import { applyView, countedTotal, type Entry, readEntries } from './entries.ts';
import { highlightMatches } from './highlight.ts';
import { type Anchor, anchorAt, anchorTarget, type Layout, measure } from './layout.ts';
import { initMinimapScrub, renderMinimap, updateMinimapView } from './minimap.ts';

const locale = document.documentElement.lang;
const strings = JSON.parse(byId('i18n').textContent ?? '{}') as ClientStrings;
const list = byId('list');
const entries = readEntries(list);
const allowed = { categories: allowedCategories(), countries: [...countryOptions().keys()] };
const langLink = byId<HTMLAnchorElement>('lang-link');
const langBase = langLink.getAttribute('href') ?? '/';

let state: ViewState = parseState(location.search, allowed);
let visible: Entry[] = [];
let layout: Layout | null = null;
let anchor: Anchor | null = null;

/** Reading position captured when a resize starts, restored once the layout has settled. */
let resizeAnchor: Anchor | null = null;

/**
 * Formats a number for the page language.
 *
 * @param n Number to format.
 * @returns The formatted number.
 */
const fmt = (n: number) => formatInt(n, locale);

const panels = initPanels();

/**
 * Closes the filters panel and scrolls to an event.
 *
 * @param id Event id.
 */
function jumpTo(id: string): void {
	panels.close();

	if (location.hash === `#${id}`) revealHash();
	else location.hash = id;
}

const syncRandom = initRandom(jumpTo);

const syncers = [
	initSort(update),
	initCategories(update),
	initCountries(update, () => state, strings.removeItem),
	initDateRange(update),
	initSearch({
		entries,
		state: () => state,
		onSearch: (q) => update({ q }),
		onJump: jumpTo,
		noMatch: strings.noMatch,
	}),
];

/**
 * Counts the active filter types: categories, countries, period and search.
 *
 * @param s View state.
 * @returns A number from 0 to 4.
 */
function activeFilters(s: ViewState): number {
	const categories = Number(s.categories !== null);
	const countries = Number(s.countries.length > 0);
	const period = Number(s.from !== null || s.to !== null);
	const search = Number(s.q !== '');

	return categories + countries + period + search;
}

/**
 * Updates everything that depends on the state: totals, empty state, filter badge, controls, random event button and language link.
 */
function syncChrome(): void {
	const n = visible.length;
	const events = fill(n === 1 ? strings.eventsOne : strings.eventsOther, { n: fmt(n) });

	byId('totals').textContent = fill(strings.totals, { events, deaths: fmt(countedTotal(visible)) });
	byId('empty').hidden = n > 0;
	panels.setBadge(activeFilters(state));

	for (const sync of syncers) sync(state);
	syncRandom(visible);

	langLink.href = langBase + serializeState(state) + location.hash;
}

/**
 * Updates the reading anchor and the mini-map viewport after a scroll.
 */
function onScroll(): void {
	if (!layout) return;

	anchor = anchorAt(layout, window.scrollY + layout.bar);
	updateMinimapView(layout);
}

/**
 * Measures the layout again, then redraws the mini-map.
 */
function relayout(): void {
	layout = measure(list, visible);

	renderMinimap(layout, locale);
	onScroll();
}

/**
 * Applies the state to the list and to the URL.
 *
 * @param keepHash Whether to keep the `#event` part of the URL.
 */
function render(keepHash: boolean): void {
	visible = applyView(list, entries, state);
	schedule('highlight', () => highlightMatches(visible, state.q));

	const hash = keepHash ? location.hash : '';
	history.replaceState(history.state, '', location.pathname + serializeState(state) + hash);

	syncChrome();
}

/**
 * Applies a change from a control: updates the state, the list and the URL, then scrolls back
 * to the top of the list if needed.
 *
 * @param patch Changed state fields.
 */
function update(patch: Partial<ViewState>): void {
	const next = parseState(serializeState({ ...state, ...patch }), allowed);

	if (serializeState(next) === serializeState(state)) {
		syncChrome();
		return;
	}

	state = next;
	render(false);

	const listTop = byId('totals').getBoundingClientRect().top + window.scrollY - (layout?.bar ?? 0);
	if (window.scrollY > listTop) scrollToY(listTop);

	relayout();
}

/**
 * Scrolls to the event named in the URL hash, resetting the filters first if they hide it.
 */
function revealHash(): void {
	const id = decodeURIComponent(location.hash.slice(1));
	const target = entries.find((e) => e.id === id);
	if (!target) return;

	if (target.el.hidden) {
		state = { ...DEFAULT_STATE, sort: state.sort, order: state.order };
		render(true);
		relayout();
	}

	target.el.scrollIntoView({ behavior: 'instant' });
}

const frames = new Map<string, number>();

/**
 * Runs a task on the next animation frame, replacing any task already scheduled under the same
 * key.
 *
 * @param key Task name.
 * @param task Work to run.
 */
function schedule(key: string, task: () => void): void {
	cancelAnimationFrame(frames.get(key) ?? 0);
	frames.set(key, requestAnimationFrame(task));
}

/**
 * Restores the reading position saved when the resize started, once the layout has settled.
 */
function restoreAfterResize(): void {
	const saved = resizeAnchor;
	resizeAnchor = null;

	relayout();

	const target = saved && layout ? anchorTarget(layout, saved) : null;
	if (target !== null) scrollToY(target);
}

for (const button of document.querySelectorAll('[data-reset]')) {
	button.addEventListener('click', () =>
		update({ categories: null, countries: [], from: null, to: null, q: '' }),
	);
}

window.addEventListener('scroll', () => schedule('scroll', onScroll), { passive: true });

window.addEventListener('resize', () => {
	resizeAnchor ??= anchor;
	schedule('resize', restoreAfterResize);
});

window.addEventListener('hashchange', () => {
	revealHash();
	syncChrome();
});

new ResizeObserver(() => schedule('layout', relayout)).observe(list);
initMinimapScrub(() => layout);

render(true);
document.documentElement.classList.remove('pending');

if (location.hash) revealHash();
relayout();
