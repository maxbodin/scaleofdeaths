import { type FilterItem, matchesFilters } from '../shared/filter.ts';
import { foldText } from '../shared/search.ts';
import { type SortItem, sortItems } from '../shared/sort.ts';
import type { ViewState } from '../shared/url-state.ts';

export interface Entry extends SortItem, FilterItem {
	el: HTMLElement;
	parent: string | null;
	title: string;
	period: string;
}

/** Parts of an entry that the search reads: title, period, tags, description, note, countries and sources. */
export const SEARCHABLE =
	'.ev-t, .ev-y, .tag:not(.tag-draft), .ev-body > p, .countries li, .sources a, .pub';

/**
 * Splits a space-separated attribute value.
 *
 * @param value Attribute value.
 * @returns The words, or an empty list.
 */
function words(value: string | undefined): string[] {
	return value ? value.split(' ').filter(Boolean) : [];
}

/**
 * Reads the sort and filter data of one event entry from its `data-*` attributes.
 *
 * @param el The event's article element.
 * @returns The entry.
 */
function readEntry(el: HTMLElement): Entry {
	return {
		el,
		id: el.id,
		best: Number(el.dataset.best),
		start: Number(el.dataset.start),
		end: Number(el.dataset.end),
		cats: words(el.dataset.cats),
		countries: words(el.dataset.countries),
		parent: el.dataset.parent ?? null,
		title: el.querySelector('h2')?.textContent ?? el.id,
		period: el.querySelector('.ev-y')?.textContent ?? '',
	};
}

/**
 * Reads every event entry of the list.
 *
 * @param list The list element.
 * @returns One entry per event, in DOM order.
 */
export function readEntries(list: HTMLElement): Entry[] {
	const articles = list.querySelectorAll<HTMLElement>(':scope > article');

	return Array.from(articles, readEntry);
}

/**
 * Reads the searchable text of an entry.
 *
 * @param el The event's article element.
 * @returns The text, folded for searching.
 */
function searchText(el: HTMLElement): string {
	const parts = Array.from(el.querySelectorAll(SEARCHABLE), (n) => n.textContent ?? '');

	return foldText(parts.join(' '));
}

/**
 * Reads the searchable text of the entries that do not have it yet. It is read on first search only, so loading the page stays cheap.
 *
 * @param entries Entries to index.
 */
export function indexText(entries: Entry[]): void {
	for (const e of entries) e.text ??= searchText(e.el);
}

/**
 * Sorts and filters the entries. The DOM is reordered only when the order changed, and entries
 * that do not match the filters are hidden.
 *
 * @param list The list element.
 * @param entries Every entry.
 * @param state View state to apply.
 * @returns The visible entries, in display order.
 */
export function applyView(list: HTMLElement, entries: Entry[], state: ViewState): Entry[] {
	const sorted = sortItems(entries, state.sort, state.order);
	const current = list.querySelectorAll(':scope > article');

	if (sorted.some((e, i) => current[i] !== e.el)) {
		const fragment = document.createDocumentFragment();
		for (const e of sorted) fragment.append(e.el);

		list.append(fragment);
	}

	if (state.q) indexText(entries);

	for (const e of sorted) e.el.hidden = !matchesFilters(e, state);

	return sorted.filter((e) => !e.el.hidden);
}

/**
 * Tells whether an entry's deaths count towards totals. A sub-event counts only when its parent is hidden, so no death is counted twice.
 *
 * @param entry Entry to check.
 * @param visibleIds Ids of the visible entries.
 * @returns `true` if the entry counts.
 */
function isCounted(entry: Entry, visibleIds: Set<string>): boolean {
	return entry.parent === null || !visibleIds.has(entry.parent);
}

/**
 * Sums the deaths of the visible entries without counting any death twice.
 *
 * @param visible Visible entries.
 * @returns Total deaths.
 */
export function countedTotal(visible: Entry[]): number {
	const ids = new Set(visible.map((e) => e.id));

	return visible.reduce((sum, e) => sum + (isCounted(e, ids) ? e.best : 0), 0);
}
