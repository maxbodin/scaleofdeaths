import { fill } from '../../shared/text.ts';
import type { ViewState } from '../../shared/url-state.ts';
import { byId, el } from '../dom.ts';
import type { Patch, Sync } from './patch.ts';

/**
 * Reads the country options rendered in the datalist.
 *
 * @returns Country key to label, in alphabetical display order.
 */
export function countryOptions(): Map<string, string> {
	const options = byId('country-list').querySelectorAll('option');

	return new Map(Array.from(options, (o) => [o.dataset.key ?? '', o.value]));
}

/**
 * Wires the country type-ahead input and the removable chips of the picked countries.
 * The chip's remove sign is drawn by CSS; its accessible name says what it does.
 *
 * @param onChange Receives the new country selection.
 * @param current Returns the current view state.
 * @param removeLabel Accessible label template of a chip, with a `{name}` placeholder.
 * @returns A function that syncs the chips with a view state.
 */
export function initCountries(
	onChange: Patch,
	current: () => ViewState,
	removeLabel: string,
): Sync {
	const input = byId<HTMLInputElement>('country-input');
	const chips = byId('country-chips');
	const labels = countryOptions();
	const keysByLabel = new Map(Array.from(labels, ([key, label]) => [label.toLowerCase(), key]));

	/**
	 * Adds the country typed in the input, when it matches an option.
	 */
	const add = () => {
		const key = keysByLabel.get(input.value.trim().toLowerCase());
		if (!key) return;

		input.value = '';

		const { countries } = current();
		if (!countries.includes(key)) onChange({ countries: [...countries, key] });
	};

	/**
	 * Creates the removable chip of a picked country.
	 *
	 * @param key Country key.
	 * @returns The list item holding the chip.
	 */
	const chip = (key: string) => {
		const label = labels.get(key) ?? key;
		const button = el('button', { type: 'button', textContent: label });
		button.setAttribute('aria-label', fill(removeLabel, { name: label }));

		button.addEventListener('click', () => {
			onChange({ countries: current().countries.filter((k) => k !== key) });
		});

		const item = el('li');
		item.append(button);

		return item;
	};

	input.addEventListener('change', add);
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') add();
	});
	byId('country-add').addEventListener('click', add);

	return (s) => chips.replaceChildren(...s.countries.map(chip));
}
