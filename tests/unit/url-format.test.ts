import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en.ts';
import { fr } from '../../src/i18n/fr.ts';
import { formatCompact, formatInt, formatPeriod } from '../../src/shared/format.ts';
import { DEFAULT_STATE, parseState, serializeState } from '../../src/shared/url-state.ts';

const allowed = { categories: ['war', 'epidemic', 'famine'], countries: ['CN', 'DE', 'FR'] };

describe('URL state', () => {
	it('round-trips a full state with canonical ordering', () => {
		const s = parseState(
			'?sort=date&order=desc&cat=famine,war&country=FR,CN&from=-500&to=1945&q=black%20death',
			allowed,
		);
		expect(s).toEqual({
			sort: 'date',
			order: 'desc',
			categories: ['war', 'famine'],
			countries: ['CN', 'FR'],
			from: -500,
			to: 1945,
			q: 'black death',
		});
		expect(serializeState(s)).toBe(
			'?sort=date&order=desc&cat=war,famine&country=CN,FR&from=-500&to=1945&q=black%20death',
		);
	});

	it('drops invalid values one by one', () => {
		const s = parseState('?sort=foo&cat=bogus,war&country=ZZ&from=abc&to=0', allowed);
		expect(s).toEqual({ ...DEFAULT_STATE, categories: ['war'] });
		expect(serializeState(s)).toBe('?cat=war');
	});

	it('treats all-invalid or all-selected categories as default, and empty as none', () => {
		expect(parseState('?cat=bogus', allowed).categories).toBeNull();
		expect(parseState('?cat=war,epidemic,famine', allowed).categories).toBeNull();
		expect(parseState('?cat=', allowed).categories).toEqual([]);
	});

	it('swaps an inverted date range', () => {
		const s = parseState('?from=2000&to=1900', allowed);
		expect([s.from, s.to]).toEqual([1900, 2000]);
	});

	it('trims the search query, collapses its spaces and caps its length', () => {
		expect(parseState('?q=%20%20black%20%20%20death%20', allowed).q).toBe('black death');
		expect(parseState('?q=%20%20', allowed).q).toBe('');
		expect(parseState(`?q=${'a'.repeat(150)}`, allowed).q).toHaveLength(100);
	});

	it('serializes the default state to an empty query', () => {
		expect(serializeState(parseState('', allowed))).toBe('');
	});
});

describe('formatting', () => {
	it('formats numbers per locale', () => {
		expect(formatInt(75_000_000, 'en')).toBe('75,000,000');
		expect(formatInt(75_000_000, 'fr')).toBe('75\u202f000\u202f000');
		expect(formatCompact(85_000_000, 'en')).toBe('85M');
	});

	it.each([
		[{ start: { year: 1939 }, end: { year: 1945 } }, 'en', '1939-1945'],
		[{ start: { year: 1945, month: 8, day: 6 } }, 'en', 'August 6, 1945'],
		[{ start: { year: 1945, month: 8, day: 6 } }, 'fr', '6 août 1945'],
		[{ start: { year: 541 }, end: { year: 549 }, circa: true }, 'en', 'c. 541-549'],
		[{ start: { year: -430 }, end: { year: -426 } }, 'en', '430 BCE - 426 BCE'],
		[{ start: { year: -430 } }, 'fr', '430 av. J.-C.'],
		[
			{ start: { year: 2019 }, ongoing: true, asOf: { year: 2026, month: 5, day: 1 } },
			'en',
			'2019 - ongoing (as of May 1, 2026)',
		],
		[{ start: { year: 1959 }, end: { year: 1959, month: 6 } }, 'en', '1959'],
	])('%j (%s) → %s', (input, locale, expected) => {
		expect(formatPeriod(input, locale, locale === 'fr' ? fr : en)).toBe(expected);
	});
});
