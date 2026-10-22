import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import type { z } from 'zod';
import { type Category, categorySchema, type DeathEvent, eventSchema } from './schema.ts';
import { type Issue, type LoadedEvent, validateEvents } from './validate.ts';

const CATEGORIES_FILE = 'data/categories.yaml';
const EVENTS_DIR = 'data/events';

export interface Dataset {
	categories: Category[];
	events: DeathEvent[];
}

export class DataError extends Error {
	readonly issues: Issue[];

	/**
	 * Creates an error that lists every data problem found.
	 *
	 * @param issues Every problem found while loading the data.
	 */
	constructor(issues: Issue[]) {
		super(`${issues.length} data error(s):\n${issues.map(formatIssue).join('\n')}`);
		this.issues = issues;
	}
}

/**
 * Formats a data problem as `file:field - message`.
 *
 * @param i Problem to format.
 * @returns One indented line of text.
 */
export function formatIssue(i: Issue): string {
	return `  ${i.file}:${i.field} - ${i.message}`;
}

/**
 * Reads and parses a YAML file, recording syntax errors instead of throwing.
 *
 * @param path Absolute path of the file.
 * @param root Project root, used to report a relative path.
 * @param issues List that collects problems.
 * @returns The parsed value, or `undefined` if the YAML is invalid.
 */
function readYaml(path: string, root: string, issues: Issue[]): unknown {
	try {
		return parse(readFileSync(path, 'utf8'), { uniqueKeys: true });
	} catch (error) {
		issues.push({ file: relative(root, path), field: '(yaml)', message: (error as Error).message });

		return undefined;
	}
}

/**
 * Validates a value against a schema and records every schema problem.
 *
 * @param schema Zod schema to apply.
 * @param value Parsed YAML value.
 * @param file File path used in error messages.
 * @param issues List that collects problems.
 * @returns The parsed value, or `undefined` if it is invalid.
 */
function collect<T>(schema: z.ZodType<T>, value: unknown, file: string, issues: Issue[]) {
	const result = schema.safeParse(value);
	if (result.success) return result.data;

	for (const issue of result.error.issues) {
		issues.push({ file, field: issue.path.join('.') || '(root)', message: issue.message });
	}

	return undefined;
}

/**
 * Reads and validates `data/categories.yaml`, recording problems instead of throwing.
 *
 * @param root Directory that contains `data/`.
 * @param issues List that collects problems.
 * @returns The valid categories, in display order.
 */
function readCategories(root: string, issues: Issue[]): Category[] {
	const raw = readYaml(join(root, CATEGORIES_FILE), root, issues);

	if (!Array.isArray(raw)) {
		issues.push({ file: CATEGORIES_FILE, field: '(root)', message: 'expected a list' });

		return [];
	}

	return raw
		.map((value) => collect(categorySchema, value, CATEGORIES_FILE, issues))
		.filter((category): category is Category => category !== undefined)
		.sort((a, b) => a.order - b.order);
}

/**
 * Loads and validates `data/categories.yaml` only, without the events.
 *
 * @param root Directory that contains `data/`.
 * @returns The categories, in display order.
 * @throws {DataError} Listing every problem found.
 */
export function loadCategories(root: string): Category[] {
	const issues: Issue[] = [];
	const categories = readCategories(root, issues);
	if (issues.length > 0) throw new DataError(issues);

	return categories;
}

/**
 * Loads every event file of `data/events/` (in file name order) and validates it against the
 * schema.
 *
 * @param root Directory that contains `data/`.
 * @param issues List that collects problems.
 * @returns The events that passed the schema, with their file paths.
 */
function loadEvents(root: string, issues: Issue[]): LoadedEvent[] {
	const dir = join(root, EVENTS_DIR);
	const names = readdirSync(dir)
		.filter((name) => /\.ya?ml$/.test(name))
		.sort();

	if (names.length === 0) {
		issues.push({ file: EVENTS_DIR, field: '(dir)', message: 'no event files found' });
	}

	const loaded: LoadedEvent[] = [];

	for (const name of names) {
		const file = `${EVENTS_DIR}/${name}`;
		const event = collect(eventSchema, readYaml(join(dir, name), root, issues), file, issues);

		if (event) loaded.push({ file, event });
	}

	return loaded;
}

/**
 * Loads and validates the categories and every event file under `<root>/data/`.
 *
 * @param root Directory that contains `data/`.
 * @returns The validated categories (in display order) and events.
 * @throws {DataError} Listing every problem found.
 */
export function loadDataset(root: string): Dataset {
	const issues: Issue[] = [];
	const categories = readCategories(root, issues);
	const loaded = loadEvents(root, issues);

	issues.push(...validateEvents(loaded, categories));
	if (issues.length > 0) throw new DataError(issues);

	return { categories, events: loaded.map((l) => l.event) };
}
