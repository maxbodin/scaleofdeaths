import { dateKey, parseDate } from '../shared/dates.ts';
import { countryKey, DISSOLVED_CODES, isCountryCode } from './countries.ts';
import type { Category, DeathEvent } from './schema.ts';

export interface Issue {
	file: string;
	field: string;
	message: string;
}

export interface LoadedEvent {
	file: string;
	event: DeathEvent;
}

/**
 * Records a problem for the event being checked.
 *
 * @param field Field path.
 * @param message What is wrong.
 */
type Report = (field: string, message: string) => void;

/**
 * Checks date formats, the order of start and end, and the date rules of ongoing and endemic events.
 *
 * @param e Event to check.
 * @param report Records a problem for this event.
 */
function checkDates(e: DeathEvent, report: Report) {
	const start = parseDate(e.start);
	const end = e.end ? parseDate(e.end) : null;

	if (!start) report('start', `invalid date "${e.start}"`);
	if (e.end && !end) report('end', `invalid date "${e.end}"`);
	if (start && end && dateKey(end, 'end') < dateKey(start)) report('end', 'is before start');

	if (e.asOf && !parseDate(e.asOf)) report('asOf', `invalid date "${e.asOf}"`);
	if (e.ongoing && !e.asOf) report('asOf', 'required when ongoing is true');
	if (e.ongoing && e.end) report('end', 'must be omitted when ongoing is true');

	if (e.kind === 'endemic-total' && !e.end && !e.ongoing) {
		report('end', 'endemic totals must state the period covered (end or ongoing)');
	}

	e.sources.forEach((s, i) => {
		if (!parseDate(s.accessed)) report(`sources[${i}].accessed`, `invalid date "${s.accessed}"`);
	});

	if (e.reviewed && !e.lastReviewed) report('lastReviewed', 'required when reviewed is true');
	if (e.lastReviewed && !parseDate(e.lastReviewed)) report('lastReviewed', 'invalid date');
}

/**
 * Checks that low ≤ best ≤ high and that per-country deaths do not exceed the total.
 *
 * @param e Event to check.
 * @param report Records a problem for this event.
 */
function checkTolls(e: DeathEvent, report: Report) {
	const { best, low, high } = e.deaths;

	if (low !== undefined && low > best) report('deaths.low', 'must be ≤ best');
	if (high !== undefined && high < best) report('deaths.high', 'must be ≥ best');

	const perCountry = e.countries.reduce((sum, c) => sum + (c.deaths ?? 0), 0);
	if (perCountry > (high ?? best)) report('countries', 'per-country deaths exceed the total');
}

/**
 * Checks that each country has an ISO 3166-1 country code or a name, that former states have a name, and that no country is listed twice.
 *
 * @param e Event to check.
 * @param report Records a problem for this event.
 */
function checkCountries(e: DeathEvent, report: Report) {
	const seen = new Set<string>();

	e.countries.forEach((c, i) => {
		const field = `countries[${i}]`;

		if (!c.code && !c.name) report(field, 'needs a code or a name');
		if (c.code && !isCountryCode(c.code)) {
			report(`${field}.code`, `"${c.code}" is not an ISO 3166-1 country code`);
		}

		if (c.code && DISSOLVED_CODES.has(c.code) && !c.name) {
			report(`${field}.name`, `required for former state "${c.code}"`);
		}

		const key = countryKey(c);
		if (seen.has(key)) report(field, `duplicate country "${key}"`);

		seen.add(key);
	});
}

/**
 * Checks that the categories exist and are not repeated.
 *
 * @param e Event to check.
 * @param known Category ids from `categories.yaml`.
 * @param report Records a problem for this event.
 */
function checkCategories(e: DeathEvent, known: Set<string>, report: Report) {
	if (new Set(e.categories).size !== e.categories.length) report('categories', 'duplicates');

	for (const c of e.categories) {
		if (!known.has(c)) report('categories', `unknown category "${c}"`);
	}
}

/**
 * Checks `partOf`: an existing event, not the event itself, and only one level deep.
 *
 * @param e Event to check.
 * @param byId Every event, by id.
 * @param report Records a problem for this event.
 */
function checkParent(e: DeathEvent, byId: Map<string, DeathEvent>, report: Report) {
	if (e.partOf === undefined) return;

	const parent = byId.get(e.partOf);

	if (e.partOf === e.id) report('partOf', 'cannot reference itself');
	else if (!parent) report('partOf', `unknown event "${e.partOf}"`);
	else if (parent.partOf) report('partOf', `"${e.partOf}" is itself a sub-event (max depth 1)`);
}

/**
 * Checks `related`: existing events, not the event itself, and no duplicates.
 *
 * @param e Event to check.
 * @param byId Every event, by id.
 * @param report Records a problem for this event.
 */
function checkRelated(e: DeathEvent, byId: Map<string, DeathEvent>, report: Report) {
	const related = e.related ?? [];

	if (new Set(related).size !== related.length) report('related', 'duplicates');

	for (const r of related) {
		if (r === e.id) report('related', 'cannot reference itself');
		else if (!byId.has(r)) report('related', `unknown event "${r}"`);
	}
}

/**
 * Checks that the sub-events of each parent do not add up to more than its best estimate.
 *
 * @param loaded Every loaded event.
 * @param issues List that collects problems.
 */
function checkChildrenSums(loaded: LoadedEvent[], issues: Issue[]) {
	const sums = new Map<string, number>();

	for (const { event } of loaded) {
		if (event.partOf) sums.set(event.partOf, (sums.get(event.partOf) ?? 0) + event.deaths.best);
	}

	for (const { file, event } of loaded) {
		const sum = sums.get(event.id);

		if (sum !== undefined && sum > event.deaths.best) {
			issues.push({
				file,
				field: 'deaths.best',
				message: `sub-events total ${sum}, more than best`,
			});
		}
	}
}

/**
 * Indexes the events by id and reports duplicate ids.
 *
 * @param loaded Every loaded event.
 * @param issues List that collects problems.
 * @returns Every event, by id.
 */
function indexById(loaded: LoadedEvent[], issues: Issue[]): Map<string, DeathEvent> {
	const byId = new Map<string, DeathEvent>();

	for (const { file, event } of loaded) {
		if (byId.has(event.id))
			issues.push({ file, field: 'id', message: `duplicate id "${event.id}"` });

		byId.set(event.id, event);
	}

	return byId;
}

/**
 * Applies the cross-field and cross-file rules that the schema cannot express.
 *
 * @param loaded Every event that passed the schema, with its file path.
 * @param categories Categories from `categories.yaml`.
 * @returns Every problem found.
 */
export function validateEvents(loaded: LoadedEvent[], categories: Category[]): Issue[] {
	const issues: Issue[] = [];
	const known = new Set(categories.map((c) => c.id));
	const byId = indexById(loaded, issues);

	for (const { file, event } of loaded) {
		/**
		 * Records a problem for the current file.
		 *
		 * @param field Field path.
		 * @param message What is wrong.
		 */
		const report: Report = (field, message) => issues.push({ file, field, message });

		const expected = file.replace(/^.*\//, '').replace(/\.ya?ml$/, '');
		if (event.id !== expected) report('id', `must equal the file name "${expected}"`);

		checkDates(event, report);
		checkTolls(event, report);
		checkCountries(event, report);
		checkCategories(event, known, report);
		checkParent(event, byId, report);
		checkRelated(event, byId, report);
	}

	checkChildrenSums(loaded, issues);

	return issues;
}
