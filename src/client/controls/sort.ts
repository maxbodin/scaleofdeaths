import type { SortKey, SortOrder } from '../../shared/sort.ts';
import { byId } from '../dom.ts';
import type { Patch, Sync } from './patch.ts';

/**
 * Wires the sort select.
 *
 * @param onChange Receives the new sort key and order.
 * @returns A function that syncs the select with a view state.
 */
export function initSort(onChange: Patch): Sync {
	const select = byId<HTMLSelectElement>('sort');

	select.addEventListener('change', () => {
		const [sort, order] = select.value.split('-') as [SortKey, SortOrder];

		onChange({ sort, order });
	});

	return (s) => {
		select.value = `${s.sort}-${s.order}`;
	};
}
