/** Checks that every source URL answers with a 2xx or 3xx status (manual: needs network). */
import { loadDataset } from '../src/build/load-data.ts';
import type { DeathEvent } from '../src/build/schema.ts';
import { fail, ROOT } from './cli.ts';

const TIMEOUT_MS = 15_000;
const CONCURRENCY = 4;
const UA = 'Mozilla/5.0 (compatible; scaleofdeaths-link-check/1.0)';

/** 401, 403 and 429 usually mean the site blocks automated clients, not that the page is gone. */
const BLOCKED = new Set([401, 403, 429]);

interface Result {
	url: string;
	events: string[];
	status: number | string;
}

/**
 * Requests a URL and reports how it answered.
 *
 * @param url Source URL to check.
 * @returns The final HTTP status after redirects, or a short error description.
 */
async function probe(url: string): Promise<number | string> {
	try {
		const response = await fetch(url, {
			redirect: 'follow',
			headers: { 'user-agent': UA, accept: 'text/html,*/*' },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});

		await response.body?.cancel();

		return response.status;
	} catch (error) {
		return (error as Error).name === 'TimeoutError' ? 'timeout' : (error as Error).message;
	}
}

/**
 * Groups the events by source URL, so each URL is checked once.
 *
 * @param events Every event.
 * @returns Event ids citing each URL.
 */
function eventsByUrl(events: DeathEvent[]): Map<string, string[]> {
	const byUrl = new Map<string, string[]>();

	for (const e of events) {
		for (const s of e.sources) byUrl.set(s.url, [...(byUrl.get(s.url) ?? []), e.id]);
	}

	return byUrl;
}

/**
 * Checks every URL, a few at a time.
 *
 * @param byUrl Event ids citing each URL.
 * @returns One result per URL, sorted by URL.
 */
async function checkAll(byUrl: Map<string, string[]>): Promise<Result[]> {
	const queue = [...byUrl];
	const results: Result[] = [];

	/**
	 * Takes URLs from the queue until it is empty.
	 */
	const worker = async () => {
		for (let next = queue.shift(); next; next = queue.shift()) {
			const [url, events] = next;
			results.push({ url, events, status: await probe(url) });
		}
	};

	await Promise.all(Array.from({ length: CONCURRENCY }, worker));

	return results.sort((a, b) => a.url.localeCompare(b.url));
}

/**
 * Tells whether a URL answered with a success or redirect status.
 *
 * @param r Result of a URL check.
 * @returns `true` for HTTP statuses below 400.
 */
const ok = (r: Result) => typeof r.status === 'number' && r.status < 400;

/**
 * Tells whether a site refused the automated request (401, 403 or 429), which usually means
 * bot blocking rather than a missing page.
 *
 * @param r Result of a URL check.
 * @returns `true` when the page has to be checked manually in a browser.
 */
const blocked = (r: Result) => typeof r.status === 'number' && BLOCKED.has(r.status);

const data = loadDataset(ROOT);
const results = await checkAll(eventsByUrl(data.events));

for (const r of results) {
	const mark = ok(r) ? '✓' : blocked(r) ? '?' : '✗';
	console.log(`${mark} ${String(r.status).padEnd(8)} ${r.url}  (${r.events.join(', ')})`);
}

const unverified = results.filter(blocked).length;

if (unverified > 0) {
	console.warn(`? ${unverified} URL(s) refused automated access: check them in a browser.`);
}

const broken = results.filter((r) => !ok(r) && !blocked(r));

if (broken.length > 0) fail(`✗ ${broken.length} of ${results.length} source URL(s) are broken.`);

console.log(`✓ No broken source URL (${results.length} checked)`);
