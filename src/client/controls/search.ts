import { matchesFilters } from '../../shared/filter.ts';
import { findMatches, foldText, matchesQuery } from '../../shared/search.ts';
import { sortItems } from '../../shared/sort.ts';
import type { ViewState } from '../../shared/url-state.ts';
import { byId, el } from '../dom.ts';
import { type Entry, indexText } from '../entries.ts';
import type { Sync } from './patch.ts';

/** Most suggestions listed under the search field. */
const MAX_SUGGESTIONS = 8;

/** Pause in typing, in milliseconds, after which the list is filtered. */
const TYPING_DELAY = 150;

export interface SearchHooks {
	/** Every event entry. */
	entries: Entry[];
	/** Returns the current view state. */
	state: () => ViewState;
	/** Applies a search query to the list. */
	onSearch: (q: string) => void;
	/** Scrolls to a suggested event. */
	onJump: (id: string) => void;
	/** Text shown when no event matches. */
	noMatch: string;
}

/**
 * Lists the events matching a query and the other active filters: title matches first, then matches in other fields, each in display order.
 *
 * @param hooks Search hooks.
 * @param query Query as typed.
 * @returns At most `MAX_SUGGESTIONS` entries.
 */
function suggestions(hooks: SearchHooks, query: string): Entry[] {
	const state = { ...hooks.state(), q: query };

	indexText(hooks.entries);

	const matches = sortItems(hooks.entries, state.sort, state.order).filter((e) =>
		matchesFilters(e, state),
	);
	const titled = new Set(matches.filter((e) => matchesQuery(foldText(e.title), query)));

	return [...titled, ...matches.filter((e) => !titled.has(e))].slice(0, MAX_SUGGESTIONS);
}

/**
 * Splits a text into plain text and `<mark>` elements around the words matching a query.
 *
 * @param text Text to show.
 * @param query Query as typed.
 * @returns Nodes to append.
 */
function marked(text: string, query: string): Node[] {
	const nodes: Node[] = [];
	let last = 0;

	for (const [start, end] of findMatches(text, query)) {
		nodes.push(document.createTextNode(text.slice(last, start)));
		nodes.push(el('mark', { textContent: text.slice(start, end) }));
		last = end;
	}

	nodes.push(document.createTextNode(text.slice(last)));

	return nodes;
}

/**
 * Creates one suggestion: the event's title, with the matching words marked, and its period.
 *
 * @param e Suggested entry.
 * @param index Position in the list, used for its id.
 * @param query Query as typed.
 * @returns The option element.
 */
function suggestion(e: Entry, index: number, query: string): HTMLLIElement {
	const item = el('li', { id: `q-opt-${index}`, className: 'opt' });
	const title = el('span', { className: 'opt-t' });

	title.append(...marked(e.title, query));
	item.setAttribute('role', 'option');
	item.setAttribute('aria-selected', 'false');
	item.dataset.id = e.id;
	item.append(title, el('span', { className: 'opt-m', textContent: e.period }));

	return item;
}

/**
 * Creates the disabled option shown when nothing matches.
 *
 * @param text Message to show.
 * @returns The option element.
 */
function noMatch(text: string): HTMLLIElement {
	const item = el('li', { className: 'opt opt-none', textContent: text });

	item.setAttribute('role', 'option');
	item.setAttribute('aria-disabled', 'true');

	return item;
}

/**
 * Wires the search field. While typing, matching events are suggested under it and the list is filtered after a short pause; choosing a suggestion clears the search and scrolls to the event. Enter, Escape, Tab or a click elsewhere hide the suggestions and apply the query at once.
 *
 * @param hooks State access, callbacks and messages.
 * @returns A function that syncs the field with a view state.
 */
export function initSearch(hooks: SearchHooks): Sync {
	const input = byId<HTMLInputElement>('q');
	const list = byId<HTMLUListElement>('q-list');
	let active = -1;
	let timer = 0;

	/**
	 * Lists the selectable suggestions.
	 *
	 * @returns The option elements.
	 */
	const options = () => Array.from(list.querySelectorAll<HTMLElement>('[data-id]'));

	/**
	 * Highlights a suggestion for the keyboard and announces it to screen readers.
	 *
	 * @param index Position to highlight; it wraps around. -1 highlights nothing.
	 */
	const highlight = (index: number) => {
		const items = options();
		active = items.length === 0 || index === -1 ? -1 : (index + items.length) % items.length;

		for (const [i, item] of items.entries())
			item.setAttribute('aria-selected', String(i === active));

		const current = items[active];
		if (current) input.setAttribute('aria-activedescendant', current.id);
		else input.removeAttribute('aria-activedescendant');

		current?.scrollIntoView({ block: 'nearest' });
	};

	/**
	 * Hides the suggestions.
	 */
	const close = () => {
		highlight(-1);
		list.hidden = true;
		input.setAttribute('aria-expanded', 'false');
	};

	/**
	 * Shows the suggestions for the text typed so far, or hides them when the field is empty.
	 */
	const suggest = () => {
		const query = input.value.trim();
		if (!query) return close();

		const items = suggestions(hooks, query).map((e, i) => suggestion(e, i, query));

		list.replaceChildren(...(items.length > 0 ? items : [noMatch(hooks.noMatch)]));
		list.hidden = false;
		input.setAttribute('aria-expanded', 'true');
		highlight(-1);
	};

	/**
	 * Filters the list with the typed text once typing pauses.
	 */
	const applySoon = () => {
		clearTimeout(timer);
		timer = window.setTimeout(() => hooks.onSearch(input.value), TYPING_DELAY);
	};

	/**
	 * Hides the suggestions and filters the list with the typed text at once.
	 */
	const commit = () => {
		clearTimeout(timer);
		close();
		hooks.onSearch(input.value);
	};

	/**
	 * Clears the search and scrolls to the chosen event.
	 *
	 * @param id Chosen event id.
	 */
	const choose = (id: string) => {
		clearTimeout(timer);
		input.value = '';
		close();
		hooks.onSearch('');
		hooks.onJump(id);
	};

	/**
	 * Handles the arrow keys, Enter and Escape.
	 *
	 * @param e Keyboard event.
	 */
	const onKey = (e: KeyboardEvent) => {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (list.hidden) suggest();

			const step = e.key === 'ArrowDown' ? 1 : -1;
			highlight(active === -1 && step < 0 ? options().length - 1 : active + step);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const id = options()[active]?.dataset.id;

			if (id) choose(id);
			else commit();
		} else if (e.key === 'Escape') {
			// Search fields clear themselves on Escape in some browsers: keep the text, it is the filter.
			e.preventDefault();
			if (list.hidden) return;

			e.stopPropagation();
			commit();
		}
	};

	input.addEventListener('input', () => {
		if (!input.value.trim()) return commit();

		suggest();
		applySoon();
	});
	input.addEventListener('keydown', onKey);
	input.addEventListener('blur', commit);

	list.addEventListener('pointerdown', (e) => e.preventDefault());
	list.addEventListener('click', (e) => {
		const id = (e.target as Element).closest<HTMLElement>('[data-id]')?.dataset.id;
		if (id) choose(id);
	});

	return (state) => {
		if (document.activeElement !== input) input.value = state.q;
	};
}
