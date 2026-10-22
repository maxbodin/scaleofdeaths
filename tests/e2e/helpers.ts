import { expect, type Page } from '@playwright/test';

export const REAL_URL = 'http://localhost:4174';

/**
 * Lists the visible event ids.
 *
 * @param page Page under test.
 * @returns The ids, in display order.
 */
export function visibleIds(page: Page): Promise<string[]> {
	return page.$$eval('#list > article:not([hidden])', (els) => els.map((e) => e.id));
}

/**
 * Opens the filters panel unless it is already open.
 *
 * @param page Page under test.
 */
export async function openFilters(page: Page): Promise<void> {
	if (await page.locator('#panel').isVisible()) return;

	await page.click('#filters-btn');
	await expect(page.locator('#panel')).toBeVisible();
}

/**
 * Checks exactly the given categories in the filters panel.
 *
 * @param page Page under test.
 * @param keep Category ids to leave checked.
 */
export async function onlyCategories(page: Page, keep: string[]): Promise<void> {
	await openFilters(page);

	for (const box of await page.locator('input[name="cat"]').all()) {
		const value = (await box.getAttribute('value')) ?? '';

		await box.setChecked(keep.includes(value));
	}
}

/**
 * Scrolls so that a document position sits right under the sticky bar, then waits two frames.
 *
 * @param page Page under test.
 * @param y Document position in pixels.
 */
export async function scrollUnderBar(page: Page, y: number): Promise<void> {
	await page.evaluate(async (target) => {
		const bar = document.querySelector('.bar')?.getBoundingClientRect().height ?? 0;
		window.scrollTo({ top: target - bar, behavior: 'instant' });

		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
	}, y);
}

/**
 * Reads the document position of an element's top edge.
 *
 * @param page Page under test.
 * @param selector CSS selector of the element.
 * @returns The position in pixels.
 */
export function docTop(page: Page, selector: string): Promise<number> {
	return page.$eval(selector, (el) => el.getBoundingClientRect().top + window.scrollY);
}
