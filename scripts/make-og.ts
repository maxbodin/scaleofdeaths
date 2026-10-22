/**
 * Generates public/og.png, the 1200 x 630 image shown in link previews on social networks and
 * messaging apps: a field of dots in the category colours, with the site title in the bottom
 * right corner on a plain white rectangle.
 *
 * The image is drawn in headless Chromium (canvas for the dots, HTML for the title, so system
 * fonts render properly) and saved as a screenshot.
 */
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { loadCategories } from '../src/build/load-data.ts';
import { fail, ROOT } from './cli.ts';

const OUTPUT = join(ROOT, 'public', 'og.png');
const TITLE = 'Scale of Deaths';

/** Share of the dot field given to each category, top to bottom. */
const SHARES: Record<string, number> = {
	war: 0.44,
	epidemic: 0.22,
	famine: 0.12,
	genocide: 0.11,
	'natural-disaster': 0.08,
	accident: 0.03,
};

interface DotField {
	width: number;
	height: number;
	/** Distance between dot centres, in pixels. */
	pitch: number;
	/** Dot radius, in pixels. */
	radius: number;
	/** Space kept free around the title, in pixels. */
	padding: number;
	/** Colour and share of the field of each band, top to bottom. */
	bands: Array<[string, number]>;
}

/**
 * Builds the colour bands of the dot field from the category colours.
 *
 * @returns Colour and share of each band, top to bottom.
 */
function categoryBands(): Array<[string, number]> {
	return loadCategories(ROOT)
		.filter((c) => SHARES[c.id] !== undefined)
		.sort((a, b) => (SHARES[b.id] ?? 0) - (SHARES[a.id] ?? 0))
		.map((c) => [c.color, SHARES[c.id] ?? 0]);
}

/**
 * Builds the page to screenshot: an empty canvas and the title in the bottom right corner.
 *
 * @param field Size of the image.
 * @returns HTML.
 */
function pageHtml(field: DotField): string {
	return `<!doctype html>
<html>
  <head>
    <style>
      html, body { margin: 0; width: ${field.width}px; height: ${field.height}px; background: #fff; overflow: hidden; }
      canvas { position: absolute; inset: 0; }
      h1 {
        position: absolute;
        right: 64px;
        bottom: 52px;
        margin: 0;
        font: 800 88px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        letter-spacing: -0.02em;
        color: #16181d;
      }
    </style>
  </head>
  <body>
    <canvas width="${field.width}" height="${field.height}"></canvas>
    <h1>${TITLE}</h1>
  </body>
</html>`;
}

/**
 * Draws the dot field on the page's canvas, row by row. Whole grid cells are left empty from the title (plus padding) to the bottom right corner, so the title sits on a plain white rectangle with straight edges and no dot is ever cut.
 *
 * Runs in the browser, so it only uses what it receives.
 *
 * @param field Size, spacing and colours of the field.
 */
function drawDots(field: DotField): void {
	const canvas = document.querySelector('canvas') as HTMLCanvasElement;
	const context = canvas.getContext('2d') as CanvasRenderingContext2D;
	const title = (document.querySelector('h1') as HTMLElement).getBoundingClientRect();

	const cols = Math.floor(field.width / field.pitch);
	const rows = Math.floor(field.height / field.pitch);
	const total = cols * rows;
	const offsetX = (field.width - cols * field.pitch) / 2;
	const offsetY = (field.height - rows * field.pitch) / 2;
	const clearLeft = title.left - field.padding;
	const clearTop = title.top - field.padding;

	for (let index = 0; index < total; index++) {
		const col = index % cols;
		const row = Math.floor(index / cols);

		const cellLeft = offsetX + col * field.pitch;
		const cellTop = offsetY + row * field.pitch;
		const cellRight = cellLeft + field.pitch;
		const cellBottom = cellTop + field.pitch;
		if (cellRight > clearLeft && cellBottom > clearTop) continue;

		let limit = 0;
		const band = field.bands.find(([, share]) => {
			limit += share;
			return index / total < limit;
		});

		context.fillStyle = band?.[0] ?? '#6E7681';
		context.beginPath();
		context.arc(
			cellLeft + field.pitch / 2,
			cellTop + field.pitch / 2,
			field.radius,
			0,
			Math.PI * 2,
		);
		context.fill();
	}
}

/**
 * Renders the dot field and the title in headless Chromium and saves the screenshot.
 *
 * @param field Size, spacing and colours of the field.
 */
async function render(field: DotField): Promise<void> {
	const browser = await chromium.launch();

	try {
		const page = await browser.newPage({
			viewport: { width: field.width, height: field.height },
			deviceScaleFactor: 1,
		});

		await page.setContent(pageHtml(field));
		await page.evaluate(() => document.fonts.ready);
		await page.evaluate(drawDots, field);
		await page.screenshot({ path: OUTPUT });
	} finally {
		await browser.close();
	}
}

try {
	await render({
		width: 1200,
		height: 630,
		pitch: 24,
		radius: 7.5,
		padding: 28,
		bands: categoryBands(),
	});

	console.log(`✓ ${OUTPUT} written`);
} catch (error) {
	fail(error);
}
