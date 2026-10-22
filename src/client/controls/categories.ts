import type { Patch, Sync } from './patch.ts';

/**
 * Finds the category checkboxes.
 *
 * @returns Every checkbox, in display order.
 */
function boxes(): HTMLInputElement[] {
	return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="cat"]'));
}

/**
 * Lists the category ids.
 *
 * @returns The ids, in display order.
 */
export function allowedCategories(): string[] {
	return boxes().map((b) => b.value);
}

/**
 * Wires the category checkboxes. When every box is checked, there is no category filter.
 *
 * @param onChange Receives the new category selection.
 * @returns A function that syncs the checkboxes with a view state.
 */
export function initCategories(onChange: Patch): Sync {
	const inputs = boxes();

	for (const input of inputs) {
		input.addEventListener('change', () => {
			const checked = inputs.filter((b) => b.checked).map((b) => b.value);

			onChange({ categories: checked.length === inputs.length ? null : checked });
		});
	}

	return (s) => {
		for (const input of inputs) {
			input.checked = s.categories === null || s.categories.includes(input.value);
		}
	};
}
