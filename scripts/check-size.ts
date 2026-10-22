/** Brotli size budgets for the real build and for a synthetic 200-event build. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { buildSite } from '../src/build/site.ts';
import { tempDataset } from '../tests/fixtures/make-edge.ts';
import { syntheticEvents } from '../tests/fixtures/synthetic.ts';
import { fail, ROOT } from './cli.ts';

const dist = join(ROOT, 'dist');
const KB = 1024;
const BUDGETS = { js: 10 * KB, css: 6 * KB };

/** HTML budgets: the real pages carry every description, note and source; the synthetic build guards the markup. */
const HTML_BUDGETS = { real: 300 * KB, synthetic: 100 * KB };

interface Row {
	label: string;
	html: number;
	htmlBudget: number;
	js: number;
	css: number;
}

/**
 * Measures the brotli-compressed size of a text.
 *
 * @param text Text to compress.
 * @returns Compressed size in bytes.
 */
const br = (text: string) => brotliCompressSync(Buffer.from(text)).length;

/**
 * Measures the compressed size of a built page and of its inline CSS and JS.
 *
 * @param label Row label shown in the report.
 * @param file Path of the HTML page.
 * @param htmlBudget Maximum allowed HTML size in bytes.
 * @returns Brotli sizes in bytes.
 */
function measure(label: string, file: string, htmlBudget: number): Row {
	const html = readFileSync(file, 'utf8');
	const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('');
	const js = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] ?? '';

	return { label, html: br(html), htmlBudget, js: br(js), css: br(css) };
}

/**
 * Builds a synthetic 200-event dataset in a temporary folder and measures both locale pages.
 *
 * @returns One row per locale.
 */
async function measureSynthetic(): Promise<Row[]> {
	const dir = tempDataset(syntheticEvents(200));
	const out = join(dir, 'dist');

	await buildSite({ root: ROOT, dataRoot: dir, outDir: out });

	return [
		measure('synthetic 200, en', join(out, 'index.html'), HTML_BUDGETS.synthetic),
		measure('synthetic 200, fr', join(out, 'fr', 'index.html'), HTML_BUDGETS.synthetic),
	];
}

/**
 * Formats a size for the report, marked with ✗ when it exceeds its budget.
 *
 * @param value Measured size in bytes.
 * @param budget Maximum allowed size in bytes.
 * @returns The size in KB.
 */
function cell(value: number, budget: number): string {
	const mark = value > budget ? ' ✗' : '  ';

	return `${(value / KB).toFixed(1).padStart(6)} KB${mark}`;
}

/**
 * Tells whether a page is within every budget.
 *
 * @param row Measured page.
 * @returns `true` if no size exceeds its budget.
 */
function withinBudget(row: Row): boolean {
	return row.html <= row.htmlBudget && row.js <= BUDGETS.js && row.css <= BUDGETS.css;
}

/**
 * Prints the sizes of every page as a table.
 *
 * @param rows Measured pages.
 */
function printTable(rows: Row[]): void {
	const header = [
		'page'.padEnd(20),
		'html'.padStart(11),
		'js (≤10)'.padStart(11),
		'css (≤6)'.padStart(11),
		'html budget'.padStart(13),
	];
	console.log(`${header.join('  ')}   brotli`);

	for (const r of rows) {
		const cells = [
			cell(r.html, r.htmlBudget),
			cell(r.js, BUDGETS.js),
			cell(r.css, BUDGETS.css),
			`≤${r.htmlBudget / KB} KB`.padStart(13),
		];
		console.log(`${r.label.padEnd(20)}  ${cells.join('  ')}`);
	}
}

if (!existsSync(join(dist, 'index.html'))) fail('dist/ is missing: run `bun run build` first.');

const rows = [
	measure('real, en', join(dist, 'index.html'), HTML_BUDGETS.real),
	measure('real, fr', join(dist, 'fr', 'index.html'), HTML_BUDGETS.real),
	...(await measureSynthetic()),
];

printTable(rows);

if (!rows.every(withinBudget)) fail('Size budget exceeded.');

console.log('✓ All size budgets met');
