import { byId } from '../dom.ts';
import type { Patch, Sync } from './patch.ts';

interface Bound {
	year: HTMLInputElement;
	era: HTMLSelectElement;
}

/**
 * Finds the year input and era select of one end of the period.
 *
 * @param id Which end of the period.
 * @returns The two fields.
 */
function bound(id: 'from' | 'to'): Bound {
	return { year: byId<HTMLInputElement>(`${id}-year`), era: byId<HTMLSelectElement>(`${id}-era`) };
}

/**
 * Reads a year from its fields. BCE years are negative.
 *
 * @param b Year and era fields.
 * @returns The year, or `null` when empty or out of range.
 */
function read(b: Bound): number | null {
	const n = Number.parseInt(b.year.value, 10);
	if (!Number.isFinite(n) || n < 1 || n > 9999) return null;

	return b.era.value === 'bce' ? -n : n;
}

/**
 * Shows a year in its fields.
 *
 * @param b Year and era fields.
 * @param value Year (negative for BCE), or `null` to clear the fields.
 */
function write(b: Bound, value: number | null): void {
	b.year.value = value === null ? '' : String(Math.abs(value));
	b.era.value = value !== null && value < 0 ? 'bce' : 'ce';
}

/**
 * Wires the period inputs. An inverted period is swapped.
 *
 * @param onChange Receives the new period.
 * @returns A function that syncs the inputs with a view state.
 */
export function initDateRange(onChange: Patch): Sync {
	const from = bound('from');
	const to = bound('to');

	/**
	 * Sends the period currently entered to `onChange`.
	 */
	const emit = () => {
		let a = read(from);
		let b = read(to);
		if (a !== null && b !== null && a > b) [a, b] = [b, a];

		onChange({ from: a, to: b });
	};

	for (const field of [from.year, from.era, to.year, to.era]) {
		field.addEventListener('change', emit);
	}

	return (s) => {
		write(from, s.from);
		write(to, s.to);
	};
}
