/**
 * Lighthouse mobile audit of the production build against the performance budgets.
 * Each page is audited several times and judged on the median, as Lighthouse recommends,
 * so a busy machine does not produce false failures.
 */
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { preview } from 'vite';
import { fail, ROOT } from './cli.ts';

const PORT = 4176;
const PAGES = ['/', '/fr/'];
const RUNS = 3;
const BUDGET = { score: 0.9, lcp: 3000, cls: 0, tbt: 50 };

type Row = Record<
	'performance' | 'accessibility' | 'bestPractices' | 'seo' | 'lcp' | 'cls' | 'tbt',
	number
>;

/**
 * Runs one Lighthouse audit and keeps the scores and metrics that have a budget.
 *
 * @param url Page to audit.
 * @param port Debugging port of the Chrome instance.
 * @returns Category scores (0 to 1) and LCP, CLS and TBT.
 */
async function audit(url: string, port: number): Promise<Row> {
	const result = await lighthouse(url, {
		port,
		onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
		logLevel: 'error',
	});
	if (!result) throw new Error('Lighthouse returned no result');

	const { categories, audits } = result.lhr;

	/**
	 * Reads the numeric value of a Lighthouse audit.
	 *
	 * @param id Lighthouse audit id, for example `largest-contentful-paint`.
	 * @returns The audit's numeric value, or `NaN` when it is missing.
	 */
	const metric = (id: string) => audits[id]?.numericValue ?? Number.NaN;

	return {
		performance: categories.performance?.score ?? 0,
		accessibility: categories.accessibility?.score ?? 0,
		bestPractices: categories['best-practices']?.score ?? 0,
		seo: categories.seo?.score ?? 0,
		lcp: Math.round(metric('largest-contentful-paint')),
		cls: metric('cumulative-layout-shift'),
		tbt: Math.round(metric('total-blocking-time')),
	};
}

/**
 * Takes the median of each score and metric across several runs.
 *
 * @param rows Results of the runs.
 * @returns The median row.
 */
function median(rows: Row[]): Row {
	const keys = Object.keys(rows[0] ?? {}) as Array<keyof Row>;
	const middle = Math.floor(rows.length / 2);

	/**
	 * Computes the median of one score or metric.
	 *
	 * @param key Score or metric name.
	 * @returns Its median value.
	 */
	const pick = (key: keyof Row) => rows.map((r) => r[key]).sort((a, b) => a - b)[middle] ?? 0;

	return Object.fromEntries(keys.map((key) => [key, pick(key)])) as Row;
}

/**
 * Tells whether a result meets every budget.
 *
 * @param row Median result of a page.
 * @returns `true` if the page is within budget.
 */
function withinBudget(row: Row): boolean {
	const scoreOk = row.performance >= BUDGET.score;
	const metricsOk = row.lcp <= BUDGET.lcp && row.cls <= BUDGET.cls && row.tbt <= BUDGET.tbt;

	return scoreOk && metricsOk;
}

/**
 * Audits one page several times and prints its median result.
 *
 * @param path Page path, for example `/fr/`.
 * @param port Debugging port of the Chrome instance.
 * @returns `true` if the page is within budget.
 */
async function auditPage(path: string, port: number): Promise<boolean> {
	const rows: Row[] = [];

	for (let i = 0; i < RUNS; i++) {
		rows.push(await audit(`http://localhost:${PORT}${path}`, port));
	}

	const row = median(rows);
	const ok = withinBudget(row);

	console.log(`${ok ? '✓' : '✗'} ${path.padEnd(5)} median of ${RUNS}: ${JSON.stringify(row)}`);

	return ok;
}

const server = await preview({
	root: ROOT,
	logLevel: 'silent',
	preview: { port: PORT, strictPort: true },
});
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
let failed = false;

try {
	for (const path of PAGES) {
		if (!(await auditPage(path, chrome.port))) failed = true;
	}
} finally {
	chrome.kill();
	await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
}

if (failed) {
	fail(
		`Lighthouse budget missed (performance ≥ ${BUDGET.score * 100}, LCP ≤ ${BUDGET.lcp} ms, CLS 0, TBT ≤ ${BUDGET.tbt} ms).`,
	);
}
