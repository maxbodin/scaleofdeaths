import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { openFilters } from './helpers.ts';

/**
 * Runs axe with the WCAG 2.2 AA rules.
 *
 * @param page Page to scan.
 * @returns The serious and critical violations, as short descriptions.
 */
async function seriousViolations(page: Page) {
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
		.analyze();
	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.map(
			(v) =>
				`${v.id}: ${v.nodes
					.map((n) => n.target.join(' '))
					.slice(0, 3)
					.join(', ')}`,
		);
}

test.describe('accessibility', () => {
	for (const path of ['/', '/fr/']) {
		test(`no serious axe violations on ${path}`, async ({ page }) => {
			await page.goto(path);
			expect(await seriousViolations(page)).toEqual([]);
		});
	}

	test('no serious axe violations with filters open and details expanded', async ({ page }) => {
		await page.goto('/?cat=war');
		await page.locator('#big-war summary').click();
		await openFilters(page);
		expect(await seriousViolations(page)).toEqual([]);
	});

	test('no serious axe violations with search suggestions shown', async ({ page }) => {
		await page.goto('/');
		await openFilters(page);
		await page.locator('#q').pressSequentially('big');
		await page.keyboard.press('ArrowDown');
		await expect(page.locator('#q-list')).toBeVisible();
		expect(await seriousViolations(page)).toEqual([]);
	});

	test('keyboard reaches the controls; Escape closes the panel', async ({ page, browserName }) => {
		test.skip(browserName === 'webkit', 'Safari does not Tab to links/buttons by default');
		await page.goto('/');
		const focused: string[] = [];
		for (let i = 0; i < 6; i++) {
			await page.keyboard.press('Tab');
			focused.push(
				await page.evaluate(
					() => document.activeElement?.id || document.activeElement?.className || '',
				),
			);
		}
		expect(focused).toEqual(expect.arrayContaining(['lang-link', 'sort', 'filters-btn']));
		await page.locator('#filters-btn').focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('#panel')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('#panel')).toBeHidden();
		await expect(page.locator('#filters-btn')).toBeFocused();
	});

	test('respects prefers-reduced-motion', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		expect(
			await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
		).toBe('auto');
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		expect(
			await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
		).toBe('smooth');
	});
});
