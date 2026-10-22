import { expect, type Page, test } from '@playwright/test';

/**
 * Compares the height of each dot grid with ceil(dots / cols) * pitch.
 *
 * @param page Page under test.
 * @returns The grids whose height differs.
 */
async function gridMismatches(page: Page) {
	return page.$$eval('.grid', (grids) => {
		const root = getComputedStyle(document.documentElement);
		const cols = Number.parseFloat(root.getPropertyValue('--cols'));
		const p = Number.parseFloat(root.getPropertyValue('--p'));
		return grids
			.map((g) => {
				const total = Number((g as HTMLElement).style.getPropertyValue('--t'));
				const expected = Math.ceil(total / cols) * p;
				return { id: g.closest('article')?.id, expected, actual: g.getBoundingClientRect().height };
			})
			.filter((r) => Math.abs(r.expected - r.actual) > 0.01);
	});
}

test.describe('dot grid', () => {
	for (const width of [320, 375, 768, 1280]) {
		test(`heights follow ceil(dots / cols) * pitch at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await page.goto('/');
			expect(await gridMismatches(page)).toEqual([]);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - window.innerWidth,
			);
			expect(overflow).toBeLessThanOrEqual(0);
		});
	}

	test('parent grid shades its children and lists them', async ({ page }) => {
		await page.goto('/');
		const segs = page.locator('#big-war .grid > i');
		const styles = await segs.evaluateAll((els) =>
			els.map((e) => [e.className, (e as HTMLElement).style.cssText]),
		);
		expect(styles[0]?.[1]).toContain('--o: 0; --n: 800; --k: color-mix(');
		expect(styles[1]?.[1]).toContain('--o: 800; --n: 1200; --k: color-mix(');
		expect(styles[2]?.[1]).toContain('--o: 2000; --n: 3000');
		expect(styles[3]?.[0]).toBe('s u');
		const legend = page.locator('#big-war .incl-l li');
		await expect(legend).toHaveCount(3);
		await expect(legend.nth(0).locator('.sw-none')).toHaveCount(1);
		await expect(legend.nth(2).locator('a')).toHaveAttribute('href', '#big-war-massacre');
	});

	test('events below 1,000 deaths are shown as a number only', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#small-accident .grid')).toHaveCount(0);
		await expect(page.locator('#small-accident .ev-n')).toHaveText('750 deaths');
		await expect(page.locator('#small-accident')).not.toContainText('Fewer than 1,000');
	});
});

test.describe('event content', () => {
	test('formats periods, ranges, badges and categories', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#ancient-plague .ev-y')).toHaveText('c. 430 BCE - 426 BCE');
		await expect(page.locator('#ongoing-pandemic .ev-y')).toHaveText(
			'2019 - ongoing (as of May 1, 2026)',
		);
		await expect(page.locator('#ongoing-pandemic .ev-r')).toHaveText('Estimates 7M - 20M');
		await expect(page.locator('#endemic-disease .tags')).toContainText(
			'Cumulative total, 1900-1977',
		);
		await expect(page.locator('#famine-war .tag:not(.tag-plain)')).toHaveText([
			'Famine',
			'War & armed conflict',
		]);
		await expect(page.locator('#big-war-battle .tags')).toContainText('Part of Big War');
		await expect(page.locator('#small-accident .tag-draft')).toHaveCount(1);
	});

	test('details expand with sources, countries and related links', async ({ page }) => {
		await page.goto('/');
		const details = page.locator('#ongoing-pandemic details');
		await details.locator('summary').click();
		await expect(details.locator('.sources a')).toHaveAttribute('rel', 'noopener noreferrer');
		await expect(details.locator('.countries')).toContainText('China');
		await expect(details).toContainText('See also');
		await expect(page.locator('#ancient-plague details')).toContainText('Ongoing pandemic');
	});

	test('French page localizes and falls back to English', async ({ page }) => {
		await page.goto('/fr/');
		await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
		await expect(page.locator('#ancient-plague .ev-y')).toHaveText(
			'v. 430 av. J.-C. - 426 av. J.-C.',
		);
		await expect(page.locator('#english-only h2')).toHaveText('English-only event');
		await expect(page.locator('#totals')).toHaveText('11 événements · 315\u202f238\u202f250 morts');
	});
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('shows every event, dots and details; hides controls', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#list > article')).toHaveCount(11);
		await expect(page.locator('.bar')).toBeHidden();
		await expect(page.locator('.minimap')).toBeHidden();
		await expect(page.locator('noscript')).toHaveCount(1);
		expect(await gridMismatches(page)).toEqual([]);
		await page.locator('#quake summary').click();
		await expect(page.locator('#quake .ev-body')).toBeVisible();
	});
});
