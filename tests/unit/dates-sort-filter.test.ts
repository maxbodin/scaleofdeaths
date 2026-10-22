import { describe, expect, it } from 'vitest';
import { dateKey, parseDate } from '../../src/shared/dates.ts';
import { type FilterState, matchesFilters } from '../../src/shared/filter.ts';
import { findMatches, foldText, matchesQuery, queryTerms } from '../../src/shared/search.ts';
import { sortItems } from '../../src/shared/sort.ts';

describe('dates', () => {
	it('parses partial and BCE dates', () => {
		expect(parseDate('1945')).toEqual({ year: 1945 });
		expect(parseDate('1945-08')).toEqual({ year: 1945, month: 8 });
		expect(parseDate('-0430')).toEqual({ year: -430 });
	});

	it.each(['0000', '1945-13', '1945-02-30', '45', '1945-8', 'abc'])('rejects %s', (value) => {
		expect(parseDate(value)).toBeNull();
	});

	it('accepts 29 February only in leap years', () => {
		expect(parseDate('2024-02-29')).not.toBeNull();
		expect(parseDate('2023-02-29')).toBeNull();
	});

	it('produces monotonic keys across BCE/CE and partial dates', () => {
		const keys = ['-0430', '-0429-12-31', '-0001', '0001', '1945', '1945-08', '1945-08-06'].map(
			(d) => dateKey(parseDate(d) as never),
		);
		expect([...keys].sort((a, b) => a - b)).toEqual(keys);
		expect(dateKey({ year: 1945 }, 'end')).toBe(19451231);
	});
});

describe('sort', () => {
	const items = [
		{ id: 'b', best: 100, start: 19000101 },
		{ id: 'a', best: 100, start: 19000101 },
		{ id: 'c', best: 100, start: 18000101 },
		{ id: 'd', best: 5, start: 20000101 },
	];

	it('deaths asc with tie-breaks start asc then id', () => {
		expect(sortItems(items, 'deaths', 'asc').map((i) => i.id)).toEqual(['d', 'c', 'a', 'b']);
	});

	it('deaths desc reverses only the primary key', () => {
		expect(sortItems(items, 'deaths', 'desc').map((i) => i.id)).toEqual(['c', 'a', 'b', 'd']);
	});

	it('date asc with tie-break best desc then id', () => {
		const tied = [...items, { id: 'e', best: 999, start: 19000101 }];
		expect(sortItems(tied, 'date', 'asc').map((i) => i.id)).toEqual(['c', 'e', 'a', 'b', 'd']);
	});

	it('gives the same order whatever the input order', () => {
		const reversed = [...items].reverse();

		expect(sortItems(reversed, 'date', 'desc')).toEqual(sortItems(items, 'date', 'desc'));
	});
});

describe('filters', () => {
	const item = {
		cats: ['genocide', 'war'],
		countries: ['FR', 'DE'],
		start: 19390901,
		end: 19450902,
	};
	const none: FilterState = { categories: null, countries: [], from: null, to: null, q: '' };

	it('matches categories inclusively (OR)', () => {
		expect(matchesFilters(item, { ...none, categories: ['war', 'famine'] })).toBe(true);
		expect(matchesFilters(item, { ...none, categories: ['epidemic'] })).toBe(false);
		expect(matchesFilters(item, { ...none, categories: [] })).toBe(false);
	});

	it('matches countries inclusively (OR)', () => {
		expect(matchesFilters(item, { ...none, countries: ['IT', 'DE'] })).toBe(true);
		expect(matchesFilters(item, { ...none, countries: ['IT'] })).toBe(false);
	});

	it('matches date ranges by overlap', () => {
		expect(matchesFilters(item, { ...none, from: 1940, to: 1941 })).toBe(true);
		expect(matchesFilters(item, { ...none, from: 1945 })).toBe(true);
		expect(matchesFilters(item, { ...none, from: 1950 })).toBe(false);
		expect(matchesFilters(item, { ...none, to: 1938 })).toBe(false);
	});

	it('combines filter types with AND', () => {
		const both = { ...none, categories: ['war'], countries: ['FR'] };

		expect(matchesFilters(item, { ...both, from: 1950 })).toBe(false);
		expect(matchesFilters(item, { ...both, from: 1944 })).toBe(true);
		expect(matchesFilters({ ...item, text: foldText('Blitz') }, { ...both, q: 'blitz' })).toBe(
			true,
		);
		expect(matchesFilters({ ...item, text: foldText('Blitz') }, { ...both, q: 'somme' })).toBe(
			false,
		);
	});

	it('matches every search term in the folded text', () => {
		const text = foldText('Épidémie de choléra de 1832 - Paris, l’Hôtel-Dieu');

		expect(matchesFilters({ ...item, text }, { ...none, q: 'cholera paris' })).toBe(true);
		expect(matchesFilters({ ...item, text }, { ...none, q: "  EPIDEMIE   l'hotel " })).toBe(true);
		expect(matchesFilters({ ...item, text }, { ...none, q: 'cholera london' })).toBe(false);
		expect(matchesFilters(item, { ...none, q: 'anything' })).toBe(false);
	});

	it('folds accents, case, punctuation and spaces', () => {
		expect(foldText('  Énorme\u2019CRISE (1939-1945) ')).toBe(' enorme crise 1939 1945 ');
		expect(queryTerms('  Énorme   crise ')).toEqual(['enorme', 'crise']);
		expect(matchesQuery(' anything ', '   ')).toBe(true);
	});

	it('finds matches in the original text, accents and punctuation included', () => {
		const text = 'Épidémie de choléra (1832), Hôtel-Dieu; scholars';

		expect(findMatches(text, 'chol').map(([a, b]) => text.slice(a, b))).toEqual(['chol']);
		expect(findMatches(text, 'EPIDEMIE hotel').map(([a, b]) => text.slice(a, b))).toEqual([
			'Épidémie',
			'Hôtel',
		]);
		expect(findMatches(text, 'cholera 1832').map(([a, b]) => text.slice(a, b))).toEqual([
			'choléra',
			'1832',
		]);
		expect(findMatches(text, '   ')).toEqual([]);
	});

	it('merges overlapping matches', () => {
		expect(findMatches('Hiroshima', 'hiro hiroshima')).toEqual([[0, 9]]);
	});

	it('matches terms at the start of words only', () => {
		const text = foldText('Scholars debate the 1832 cholera toll (1939-1945)');

		expect(matchesQuery(text, 'chol')).toBe(true);
		expect(matchesQuery(text, 'olera')).toBe(false);
		expect(matchesQuery(foldText('Scholars'), 'chol')).toBe(false);
		expect(matchesQuery(text, '1945')).toBe(true);
	});
});
