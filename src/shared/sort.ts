export type SortKey = 'deaths' | 'date';
export type SortOrder = 'asc' | 'desc';

export interface SortItem {
	id: string;
	best: number;
	start: number;
}

/**
 * Compares two events. The primary key follows `order`; ties are broken by fixed rules so the result is deterministic.
 *
 * @param a First event.
 * @param b Second event.
 * @param key Sort key.
 * @param order Sort order.
 * @returns A negative number if `a` comes first, a positive number if `b` does, 0 if they are equal.
 */
function compareItems(a: SortItem, b: SortItem, key: SortKey, order: SortOrder): number {
	const primary = key === 'deaths' ? a.best - b.best : a.start - b.start;
	if (primary !== 0) return order === 'asc' ? primary : -primary;

	const tie = key === 'deaths' ? a.start - b.start : b.best - a.best;
	if (tie !== 0) return tie;

	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Sorts events without changing the input array.
 *
 * @param items Events to sort.
 * @param key Sort key.
 * @param order Sort order.
 * @returns A new, sorted array.
 */
export function sortItems<T extends SortItem>(items: T[], key: SortKey, order: SortOrder): T[] {
	return [...items].sort((a, b) => compareItems(a, b, key, order));
}
