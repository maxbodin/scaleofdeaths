import { yearEndKey, yearStartKey } from './dates.ts';
import { matchesQuery } from './search.ts';

export interface FilterState {
	/** `null` = every category. */
	categories: string[] | null;
	countries: string[];
	from: number | null;
	to: number | null;
	/** Free-text search, as typed. Empty = no search. */
	q: string;
}

export interface FilterItem {
	cats: string[];
	countries: string[];
	start: number;
	end: number;
	/** Searchable text, folded with `foldText`. Needed only while a search is active. */
	text?: string;
}

/**
 * Tells whether an event matches the filters: AND across filter types, OR within each type, interval overlap for the period, and every search term found in the event's text.
 *
 * @param item Event data.
 * @param f Active filters.
 * @returns `true` if the event should be shown.
 */
export function matchesFilters(item: FilterItem, f: FilterState): boolean {
	if (f.categories && !item.cats.some((c) => f.categories?.includes(c))) return false;
	if (f.countries.length > 0 && !item.countries.some((c) => f.countries.includes(c))) return false;
	if (f.from !== null && item.end < yearStartKey(f.from)) return false;
	if (f.to !== null && item.start > yearEndKey(f.to)) return false;
	if (f.q && !matchesQuery(item.text ?? '', f.q)) return false;

	return true;
}
