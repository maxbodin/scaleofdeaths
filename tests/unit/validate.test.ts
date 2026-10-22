import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DataError, loadDataset } from '../../src/build/load-data.ts';
import { tempDataset } from '../fixtures/make-edge.ts';

type Event = Record<string, unknown>;

/**
 * Creates a minimal valid event.
 *
 * @param id Event id.
 * @param extra Fields to add or override.
 * @returns The event.
 */
const base = (id: string, extra: Event = {}): Event => ({
	id,
	title: { en: `Event ${id}` },
	description: { en: 'Description.' },
	categories: ['war'],
	start: '1900',
	deaths: { best: 10_000 },
	countries: [{ code: 'FR' }],
	sources: [{ title: 'Source', url: 'https://example.org', accessed: '2026-10-21' }],
	reviewed: false,
	...extra,
});

/**
 * Loads a dataset and captures the data error, if any.
 *
 * @param dir Directory that contains `data/`.
 * @returns The error, or `undefined` when the data is valid.
 */
function loadError(dir: string): DataError | undefined {
	try {
		loadDataset(dir);
	} catch (error) {
		if (error instanceof DataError) return error;
		throw error;
	}
	return undefined;
}

/**
 * Writes a dataset to a temporary folder and loads it.
 *
 * @param events Events to write.
 * @returns Every problem reported, as `file:field - message` lines.
 */
function issuesFor(events: Event[]): string[] {
	const dir = tempDataset(events);
	try {
		loadDataset(dir);
		return [];
	} catch (error) {
		if (!(error instanceof DataError)) throw error;
		return error.issues.map((i) => `${i.file}:${i.field} - ${i.message}`);
	}
}

describe('data validation', () => {
	it('accepts a valid dataset', () => {
		expect(issuesFor([base('a'), base('b', { partOf: 'a', deaths: { best: 5000 } })])).toEqual([]);
	});

	it.each<[string, Event[], RegExp]>([
		['missing field', [{ ...base('a'), title: undefined }], /a\.yaml:title - /],
		['unknown key', [base('a', { colour: 'red' })], /a\.yaml:\(root\) - .*colour/],
		['bad id', [base('A_b')], /id - expected kebab-case/],
		[
			'em dash',
			[base('a', { title: { en: 'Before \u2014 after' } })],
			/title\.en - must not contain an em dash/,
		],
		[
			'unknown category',
			[base('a', { categories: ['war', 'pirates'] })],
			/unknown category "pirates"/,
		],
		['duplicate category', [base('a', { categories: ['war', 'war'] })], /categories - duplicates/],
		['low > best', [base('a', { deaths: { best: 10, low: 20 } })], /deaths\.low - must be ≤ best/],
		[
			'high < best',
			[base('a', { deaths: { best: 10, high: 5 } })],
			/deaths\.high - must be ≥ best/,
		],
		['zero deaths', [base('a', { deaths: { best: 0 } })], /deaths\.best - /],
		['end before start', [base('a', { start: '1950', end: '1940' })], /end - is before start/],
		['impossible date', [base('a', { start: '2023-02-30' })], /start - invalid date/],
		['ongoing without asOf', [base('a', { ongoing: true })], /asOf - required when ongoing/],
		[
			'ongoing with end',
			[base('a', { ongoing: true, asOf: '2026-01-01', end: '2020' })],
			/end - must be omitted/,
		],
		[
			'endemic without period',
			[base('a', { kind: 'endemic-total' })],
			/end - endemic totals must state/,
		],
		['unknown parent', [base('a', { partOf: 'nope' })], /partOf - unknown event "nope"/],
		['self parent', [base('a', { partOf: 'a' })], /partOf - cannot reference itself/],
		[
			'nesting depth',
			[
				base('a'),
				base('b', { partOf: 'a', deaths: { best: 10 } }),
				base('c', { partOf: 'b', deaths: { best: 1 } }),
			],
			/c\.yaml:partOf - "b" is itself a sub-event/,
		],
		[
			'children exceed parent',
			[
				base('a'),
				base('b', { partOf: 'a', deaths: { best: 6000 } }),
				base('c', { partOf: 'a', deaths: { best: 6000 } }),
			],
			/a\.yaml:deaths\.best - sub-events total 12000/,
		],
		['unknown related', [base('a', { related: ['zzz'] })], /related - unknown event "zzz"/],
		['self related', [base('a', { related: ['a'] })], /related - cannot reference itself/],
		[
			'country without code or name',
			[base('a', { countries: [{ deaths: 5 }] })],
			/countries\[0\] - needs a code or a name/,
		],
		[
			'unknown code',
			[base('a', { countries: [{ code: 'QQ' }] })],
			/"QQ" is not an ISO 3166-1 country code/,
		],
		...['UK', 'EU', 'UN', 'EZ', 'XA', 'IC'].map((code): [string, Event[], RegExp] => [
			`non-country code ${code}`,
			[base('a', { countries: [{ code }] })],
			new RegExp(`countries\\[0\\]\\.code - "${code}" is not an ISO 3166-1 country code`),
		]),
		[
			'former state without name',
			[base('a', { countries: [{ code: 'SU' }] })],
			/countries\[0\]\.name - required for former state "SU"/,
		],
		[
			'renamed state without name',
			[base('a', { countries: [{ code: 'HV' }] })],
			/countries\[0\]\.name - required for former state "HV"/,
		],
		[
			'duplicate country',
			[base('a', { countries: [{ code: 'FR' }, { code: 'FR' }] })],
			/duplicate country "FR"/,
		],
		[
			'per-country sum too high',
			[base('a', { countries: [{ code: 'FR', deaths: 20_000 }] })],
			/countries - per-country deaths exceed/,
		],
		['no source', [base('a', { sources: [] })], /sources - at least one source/],
		[
			'http source',
			[base('a', { sources: [{ title: 'S', url: 'http://x.org', accessed: '2026-01-01' }] })],
			/sources\.0\.url - must be an https/,
		],
		[
			'reviewed without date',
			[base('a', { reviewed: true })],
			/lastReviewed - required when reviewed/,
		],
		[
			'description too long',
			[base('a', { description: { en: 'x'.repeat(601) } })],
			/description\.en - /,
		],
	])('rejects %s', (_name, events, pattern) => {
		expect(issuesFor(events).join('\n')).toMatch(pattern);
	});

	it('rejects an id that differs from the file name, and duplicate ids', () => {
		const dir = tempDataset([base('a')]);
		writeFileSync(join(dir, 'data', 'events', 'other.yaml'), JSON.stringify(base('a')));
		const text = loadError(dir)?.message ?? '';
		expect(text).toMatch(/other\.yaml:id - must equal the file name "other"/);
		expect(text).toMatch(/duplicate id "a"/);
	});

	it('reports YAML syntax errors and an empty event directory', () => {
		const dir = tempDataset([]);
		expect(() => loadDataset(dir)).toThrow(/no event files found/);
		writeFileSync(join(dir, 'data', 'events', 'broken.yaml'), 'id: [unclosed');
		expect(() => loadDataset(dir)).toThrow(/broken\.yaml:\(yaml\)/);
	});

	it('lists every violation, not only the first', () => {
		const issues = issuesFor([
			base('a', { categories: ['nope'], deaths: { best: 10, low: 20 }, partOf: 'zzz' }),
		]);
		expect(issues.length).toBeGreaterThanOrEqual(3);
	});
});
