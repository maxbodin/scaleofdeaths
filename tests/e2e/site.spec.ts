import { resolve } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { loadDataset } from '../../src/build/load-data.ts';
import { milestones } from '../../src/shared/layout.ts';
import { REAL_URL } from './helpers.ts';

/** The real site is built from this dataset (see playwright.config.ts). */
const dataset = loadDataset(
	resolve(import.meta.dirname, '..', '..', process.env.SOD_DATA_ROOT ?? '.'),
);

/** The event with the most milestone labels, to check they are all rendered. */
const tallest = dataset.events
	.map((e) => ({ id: e.id, labels: milestones(e.deaths.best, e.deaths.high).length }))
	.sort((a, b) => b.labels - a.labels)[0];

test.describe('real site', () => {
	for (const path of ['/', '/fr/']) {
		test(`${path} loads with no errors, CSP violations or third-party requests`, async ({
			page,
		}) => {
			const problems: string[] = [];
			page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(m.text()));
			page.on('pageerror', (e) => problems.push(e.message));
			page.on(
				'request',
				(r) =>
					!r.url().startsWith(REAL_URL) && !r.url().startsWith('data:') && problems.push(r.url()),
			);
			await page.goto(REAL_URL + path);
			await expect(page.locator('#list > article')).toHaveCount(dataset.events.length);
			await expect(page.locator('#minimap-list li')).toHaveCount(dataset.events.length);
			await expect(page.locator(`#${tallest?.id} .milestone`)).toHaveCount(tallest?.labels ?? 0);
			expect(problems).toEqual([]);
		});
	}

	test('first screen fits in the first 14 KB of compressed HTML', async ({
		request,
		browserName,
	}) => {
		test.skip(browserName !== 'chromium', 'network-level check, engine-independent');
		const html = await (await request.get(`${REAL_URL}/`)).text();
		const firstGrid = html.indexOf('</article>');
		expect(firstGrid).toBeGreaterThan(0);
		const prefix = Buffer.from(html.slice(0, firstGrid));
		expect(brotliCompressSync(prefix).length).toBeLessThanOrEqual(14 * 1024);
	});
});
