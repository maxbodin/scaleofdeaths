/** Realistic synthetic events (text lengths, sources, countries, sub-events) for budget checks. */
const CATS = ['war', 'epidemic', 'natural-disaster', 'famine', 'genocide', 'accident'];
const CODES = ['FR', 'DE', 'CN', 'IN', 'US', 'BR', 'NG', 'ID', 'RU', 'JP', 'MX', 'EG'];
const SENTENCE_EN =
	'A long description of the event, its causes, its course and its consequences for the people involved. ';
const SENTENCE_FR =
	'Une longue description de l’événement, de ses causes, de son déroulement et de ses conséquences. ';

/**
 * Generates synthetic events with realistic text lengths, sources, countries and sub-events.
 *
 * @param count Number of events.
 * @returns Event objects ready to be written as YAML.
 */
export function syntheticEvents(count: number): Array<Record<string, unknown>> {
	const events: Array<Record<string, unknown>> = [];
	for (let i = 0; i < count; i++) {
		const best = Math.round(1000 * 1.09 ** (i % 170)) + i;
		const parent = i % 10 === 9 ? `synthetic-${i - 9}` : undefined;
		const year = 1000 + ((i * 37) % 1020);
		events.push({
			id: `synthetic-${i}`,
			title: {
				en: `Synthetic event number ${i} with a realistic title`,
				fr: `Événement synthétique numéro ${i} au titre réaliste`,
			},
			description: { en: SENTENCE_EN.repeat(4).trim(), fr: SENTENCE_FR.repeat(4).trim() },
			categories: [CATS[i % CATS.length], ...(i % 7 === 0 ? [CATS[(i + 1) % CATS.length]] : [])],
			start: String(year),
			end: String(year + (i % 6)),
			deaths: parent
				? { best: 500 + i }
				: { best: best + 10_000, low: best, high: best * 2 + 10_000 },
			countries: CODES.slice(i % 6, (i % 6) + 4).map((code, k) =>
				k === 0 ? { code, deaths: 100 } : { code },
			),
			...(parent ? { partOf: parent } : {}),
			sources: [1, 2, 3].map((n) => ({
				title: `Reference work ${n} about event ${i}`,
				publisher: 'Encyclopaedia of Synthetic Data',
				url: `https://example.org/reference/${i}/${n}`,
				accessed: '2026-10-21',
			})),
			reviewed: false,
		});
	}
	return events;
}
