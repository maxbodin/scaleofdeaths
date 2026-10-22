import type { FilterState } from './filter.ts';
import type { SortKey, SortOrder } from './sort.ts';

export interface ViewState extends FilterState {
	sort: SortKey;
	order: SortOrder;
}

export interface AllowedValues {
	/** Canonical order is preserved in the URL and in the state. */
	categories: string[];
	countries: string[];
}

export const DEFAULT_STATE: Readonly<ViewState> = Object.freeze({
	sort: 'deaths',
	order: 'asc',
	categories: null,
	countries: [],
	from: null,
	to: null,
	q: '',
});

/** Longest search query kept from a URL. */
const MAX_QUERY = 100;

/**
 * Keeps the allowed values of a comma-separated list, in canonical order.
 *
 * @param raw Comma-separated values.
 * @param allowed Allowed values, in canonical order.
 * @returns The allowed values present in `raw`.
 */
function pickList(raw: string, allowed: string[]): string[] {
	const wanted = new Set(raw.split(','));

	return allowed.filter((v) => wanted.has(v));
}

/**
 * Parses the `cat` parameter. A missing, all-invalid or all-selected value means every category (`null`); an empty value means none.
 *
 * @param raw Parameter value, or `null`.
 * @param allowed Category ids.
 * @returns The selected categories, or `null` for all of them.
 */
function parseCategories(raw: string | null, allowed: string[]): string[] | null {
	if (raw === null) return null;
	if (raw === '') return [];

	const list = pickList(raw, allowed);

	return list.length === 0 || list.length === allowed.length ? null : list;
}

/**
 * Parses a year parameter (negative for BCE).
 *
 * @param raw Parameter value, or `null`.
 * @returns The year, or `null` when missing or invalid.
 */
function parseYear(raw: string | null): number | null {
	if (raw === null || !/^-?\d{1,4}$/.test(raw)) return null;

	const year = Number(raw);

	return year === 0 ? null : year;
}

/**
 * Parses the `q` parameter: trimmed, with single spaces and a maximum length.
 *
 * @param raw Parameter value, or `null`.
 * @returns The search query, or an empty string.
 */
function parseQuery(raw: string | null): string {
	return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
}

/**
 * Reads the view state from a query string. Unknown or malformed values are dropped one by one, the rest is kept, and an inverted period is swapped.
 *
 * @param search Query string, with or without `?`.
 * @param allowed Allowed categories and countries.
 * @returns The view state.
 */
export function parseState(search: string, allowed: AllowedValues): ViewState {
	const p = new URLSearchParams(search);
	const sort = p.get('sort');
	const order = p.get('order');
	const country = p.get('country');

	let from = parseYear(p.get('from'));
	let to = parseYear(p.get('to'));
	if (from !== null && to !== null && from > to) [from, to] = [to, from];

	return {
		sort: sort === 'date' || sort === 'deaths' ? sort : DEFAULT_STATE.sort,
		order: order === 'asc' || order === 'desc' ? order : DEFAULT_STATE.order,
		categories: parseCategories(p.get('cat'), allowed.categories),
		countries: country ? pickList(country, allowed.countries) : [],
		from,
		to,
		q: parseQuery(p.get('q')),
	};
}

/**
 * Writes a view state as a query string, omitting default values.
 *
 * @param s View state.
 * @returns The query string (starting with `?`), or an empty string for the default state.
 */
export function serializeState(s: ViewState): string {
	const parts: Array<[string, string]> = [];

	if (s.sort !== DEFAULT_STATE.sort) parts.push(['sort', s.sort]);
	if (s.order !== DEFAULT_STATE.order) parts.push(['order', s.order]);
	if (s.categories !== null) parts.push(['cat', s.categories.join(',')]);
	if (s.countries.length > 0) parts.push(['country', s.countries.join(',')]);
	if (s.from !== null) parts.push(['from', String(s.from)]);
	if (s.to !== null) parts.push(['to', String(s.to)]);
	if (s.q) parts.push(['q', s.q]);

	const query = parts.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ',')}`);

	return query.length > 0 ? `?${query.join('&')}` : '';
}
