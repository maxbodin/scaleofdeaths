import { type DateParts, dateKey, parseDate } from '../shared/dates.ts';
import { sortItems } from '../shared/sort.ts';
import { countryKey, countryLabels } from './countries.ts';
import type { Dataset } from './load-data.ts';
import type { Category, DeathEvent, LocalizedText } from './schema.ts';

export interface EventView {
	event: DeathEvent;
	id: string;
	best: number;
	start: number;
	end: number;
	startParts: DateParts;
	endParts?: DateParts;
	asOfParts?: DateParts;
	categories: Category[];
	parent?: DeathEvent;
	children: DeathEvent[];
	related: DeathEvent[];
	countryKeys: string[];
}

export interface CountryOption {
	key: string;
	label: LocalizedText;
}

export interface SiteModel {
	categories: Category[];
	/** In the default order (deaths ascending). */
	views: EventView[];
	countries: CountryOption[];
}

/** Lookups shared by every event while the model is built. */
interface Lookups {
	byId: Map<string, DeathEvent>;
	categories: Map<string, Category>;
	related: Map<string, Set<string>>;
	all: DeathEvent[];
}

/**
 * Parses a date that validation has already accepted.
 *
 * @param value Date string from an event file.
 * @returns The date parts.
 * @throws {Error} If the date is invalid, which validation should have prevented.
 */
function mustParse(value: string): DateParts {
	const parts = parseDate(value);
	if (!parts) throw new Error(`invalid date ${value}`);

	return parts;
}

/**
 * Orders sub-events by death toll (fewest first), then by start date, then by id.
 *
 * @param a First event.
 * @param b Second event.
 * @returns A negative number if `a` comes first, a positive number otherwise.
 */
function fewestDeathsFirst(a: DeathEvent, b: DeathEvent): number {
	if (a.deaths.best !== b.deaths.best) return a.deaths.best - b.deaths.best;

	const byStart = dateKey(mustParse(a.start)) - dateKey(mustParse(b.start));
	if (byStart !== 0) return byStart;

	return a.id < b.id ? -1 : 1;
}

/**
 * Indexes `related` links in both directions.
 *
 * @param events Every event.
 * @returns For each event id, the ids it is related to.
 */
function relatedMap(events: DeathEvent[]): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();

	/**
	 * Records a link from one event to another.
	 *
	 * @param a Source event id.
	 * @param b Target event id.
	 * @returns The updated map.
	 */
	const link = (a: string, b: string) => map.set(a, (map.get(a) ?? new Set()).add(b));

	for (const e of events) {
		for (const r of e.related ?? []) {
			link(e.id, r);
			link(r, e.id);
		}
	}

	return map;
}

/**
 * Derives everything the renderer needs from one event: sort keys, parsed dates, categories, parent, sub-events, related events and country keys.
 *
 * @param e Validated event.
 * @param lookups Lookups shared by every event.
 * @returns The event view.
 */
function toView(e: DeathEvent, lookups: Lookups): EventView {
	const startParts = mustParse(e.start);
	const endParts = e.end ? mustParse(e.end) : undefined;
	const asOfParts = e.asOf ? mustParse(e.asOf) : undefined;
	const lastDay = endParts ?? (e.ongoing ? asOfParts : undefined) ?? startParts;
	const relatedIds = [...(lookups.related.get(e.id) ?? [])].sort();

	return {
		event: e,
		id: e.id,
		best: e.deaths.best,
		start: dateKey(startParts),
		end: dateKey(lastDay, 'end'),
		startParts,
		endParts,
		asOfParts,
		categories: e.categories.map((c) => lookups.categories.get(c) as Category),
		parent: e.partOf ? lookups.byId.get(e.partOf) : undefined,
		children: lookups.all.filter((c) => c.partOf === e.id).sort(fewestDeathsFirst),
		related: relatedIds.map((id) => lookups.byId.get(id) as DeathEvent),
		countryKeys: e.countries.map(countryKey),
	};
}

/**
 * Lists every country that appears in the data, with its labels.
 *
 * @param events Every event.
 * @returns One option per distinct country key.
 */
function countryOptions(events: DeathEvent[]): CountryOption[] {
	const labels = new Map<string, LocalizedText>();

	for (const e of events) {
		for (const c of e.countries) labels.set(countryKey(c), countryLabels(c));
	}

	return [...labels].map(([key, label]) => ({ key, label }));
}

/**
 * Builds the render model: categories, country options and events in the default order (deaths ascending).
 *
 * @param data Validated dataset.
 * @returns The site model.
 */
export function buildModel(data: Dataset): SiteModel {
	const lookups: Lookups = {
		byId: new Map(data.events.map((e) => [e.id, e])),
		categories: new Map(data.categories.map((c) => [c.id, c])),
		related: relatedMap(data.events),
		all: data.events,
	};

	const views = data.events.map((e) => toView(e, lookups));

	return {
		categories: data.categories,
		views: sortItems(views, 'deaths', 'asc'),
		countries: countryOptions(data.events),
	};
}
