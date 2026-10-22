/**
 * Writes the edge-case fixture dataset used by the end-to-end tests into `<dir>/data/`.
 * Run: `node tests/fixtures/make-edge.ts [dir]` (default: tests/fixtures/edge).
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stringify } from 'yaml';

const root = join(import.meta.dirname, '..', '..');
const source = [
	{ title: 'Fixture source', url: 'https://example.org/source', accessed: '2026-10-21' },
];
const reviewed = { sources: source, reviewed: true, lastReviewed: '2026-10-21' };

export const EDGE_EVENTS: Array<Record<string, unknown>> = [
	{
		id: 'big-war',
		title: { en: 'Big War', fr: 'Grande guerre' },
		description: { en: 'Fixture parent event.', fr: 'Événement parent de test.' },
		categories: ['war'],
		start: '1939-09-01',
		end: '1945-09-02',
		deaths: { best: 5_000_000, low: 4_500_000, high: 6_000_000 },
		countries: [{ code: 'FR', deaths: 1_000_000 }, { code: 'DE' }],
		...reviewed,
	},
	{
		id: 'big-war-massacre',
		title: { en: 'Big War massacre', fr: 'Massacre de la Grande guerre' },
		description: {
			en: 'Fixture child of another category.',
			fr: 'Enfant de test d’une autre catégorie.',
		},
		categories: ['genocide'],
		partOf: 'big-war',
		start: '1942',
		deaths: { best: 1_200_000 },
		countries: [{ code: 'PL' }],
		...reviewed,
	},
	{
		id: 'big-war-battle',
		title: { en: 'Big War battle', fr: 'Bataille de la Grande guerre' },
		description: {
			en: 'Fixture child of the same category.',
			fr: 'Enfant de test de même catégorie.',
		},
		categories: ['war'],
		partOf: 'big-war',
		start: '1943-07',
		deaths: { best: 800_000 },
		countries: [{ code: 'RU' }],
		...reviewed,
	},
	{
		id: 'big-war-raid',
		title: { en: 'Big War raid', fr: 'Raid de la Grande guerre' },
		description: { en: 'Fixture child below one dot.', fr: 'Enfant de test sous un point.' },
		categories: ['war'],
		partOf: 'big-war',
		start: '1944-06-06',
		deaths: { best: 500 },
		countries: [{ code: 'FR' }],
		...reviewed,
	},
	{
		id: 'ancient-plague',
		title: { en: 'Ancient plague', fr: 'Peste antique' },
		description: { en: 'Fixture BCE event.', fr: 'Événement de test avant notre ère.' },
		categories: ['epidemic'],
		start: '-0430',
		end: '-0426',
		circa: true,
		deaths: { best: 75_000 },
		countries: [{ name: { en: 'Ancient Athens', fr: 'Athènes antique' } }],
		...reviewed,
	},
	{
		id: 'ongoing-pandemic',
		title: { en: 'Ongoing pandemic', fr: 'Pandémie en cours' },
		description: { en: 'Fixture ongoing event.', fr: 'Événement de test en cours.' },
		categories: ['epidemic'],
		start: '2019-12',
		ongoing: true,
		asOf: '2026-05-01',
		deaths: { best: 7_000_000, high: 20_000_000 },
		countries: [{ code: 'CN' }, { code: 'US' }],
		related: ['ancient-plague'],
		...reviewed,
	},
	{
		id: 'famine-war',
		title: { en: 'Wartime famine', fr: 'Famine de guerre' },
		description: { en: 'Fixture multi-category event.', fr: 'Événement de test multi-catégorie.' },
		categories: ['famine', 'war'],
		start: '1943',
		end: '1944',
		deaths: { best: 3_000_000 },
		countries: [{ code: 'IN' }],
		...reviewed,
	},
	{
		id: 'small-accident',
		title: { en: 'Small accident', fr: 'Petit accident' },
		description: { en: 'Fixture event below one dot.', fr: 'Événement de test sous un point.' },
		categories: ['accident'],
		start: '1912-04-15',
		deaths: { best: 750 },
		countries: [{ code: 'GB' }],
		sources: source,
		reviewed: false,
	},
	{
		id: 'endemic-disease',
		title: { en: 'Endemic disease', fr: 'Maladie endémique' },
		description: { en: 'Fixture endemic total.', fr: 'Total endémique de test.' },
		categories: ['epidemic'],
		kind: 'endemic-total',
		start: '1900',
		end: '1977',
		deaths: { best: 300_000_000 },
		countries: [{ code: 'IN' }, { code: 'CN' }],
		...reviewed,
	},
	{
		id: 'quake',
		title: { en: 'Big earthquake', fr: 'Grand séisme' },
		description: { en: 'Fixture natural disaster.', fr: 'Catastrophe naturelle de test.' },
		categories: ['natural-disaster'],
		start: '2010-01-12',
		deaths: { best: 160_500 },
		countries: [{ code: 'HT' }],
		...reviewed,
	},
	{
		id: 'english-only',
		title: { en: 'English-only event' },
		description: { en: 'Fixture without French text.' },
		categories: ['natural-disaster'],
		start: '1990',
		deaths: { best: 2000 },
		countries: [{ code: 'PH' }],
		...reviewed,
	},
];

/**
 * Writes `categories.yaml` and one YAML file per event under `<dir>/data/`, replacing any previous
 * data.
 *
 * @param dir Target directory.
 * @param events Events to write.
 */
export function writeDataset(dir: string, events: Array<Record<string, unknown>>): void {
	const data = join(dir, 'data');
	rmSync(data, { recursive: true, force: true });
	mkdirSync(join(data, 'events'), { recursive: true });
	copyFileSync(join(root, 'data', 'categories.yaml'), join(data, 'categories.yaml'));
	for (const event of events)
		writeFileSync(join(data, 'events', `${event.id}.yaml`), stringify(event));
}

/**
 * Writes a dataset to a new temporary folder.
 *
 * @param events Events to write.
 * @returns The folder, which contains `data/`.
 */
export function tempDataset(events: Array<Record<string, unknown>>): string {
	const dir = mkdtempSync(join(tmpdir(), 'sod-'));
	writeDataset(dir, events);

	return dir;
}

if (import.meta.main) {
	const dir = resolve(process.argv[2] ?? join(root, 'tests', 'fixtures', 'edge'));
	writeDataset(dir, EDGE_EVENTS);
	console.log(`Wrote ${EDGE_EVENTS.length} fixture events to ${dir}/data`);
}
