import { expect, test } from '@playwright/test';
import { docTop, onlyCategories, openFilters, scrollUnderBar } from './helpers.ts';

test.describe('orientation', () => {
	test('keeps the current event title pinned under the bar', async ({ page }) => {
		await page.goto('/');
		const top = await docTop(page, '#endemic-disease .grid');
		await scrollUnderBar(page, top + 3000);
		const { header, bar } = await page.evaluate(() => ({
			header: document.querySelector('#endemic-disease .ev-h')?.getBoundingClientRect().top ?? -1,
			bar: document.querySelector('.bar')?.getBoundingClientRect().bottom ?? -1,
		}));
		expect(Math.abs(header - bar)).toBeLessThanOrEqual(1);
	});

	test('mini-map mirrors visible events and jumps on click', async ({ page }) => {
		await page.goto('/');
		const segments = page.locator('#minimap-list li');
		await expect(segments).toHaveCount(11);
		await expect(segments.last()).toHaveAttribute('title', 'Endemic disease - 300,000,000');
		const box = await segments.last().boundingBox();
		if (!box) throw new Error('segment not rendered');
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		await expect(page.locator('#endemic-disease .grid')).toBeInViewport();
		await onlyCategories(page, ['war']);
		await expect(segments).toHaveCount(4);
	});

	test('search suggests events while typing and jumps to the chosen one', async ({ page }) => {
		await page.goto('/?cat=war');
		await openFilters(page);
		await page.locator('#q').pressSequentially('big wa');
		await expect(page.locator('#q')).toHaveAttribute('aria-expanded', 'true');
		await expect(page.locator('#q-list .opt-t')).toHaveText([
			'Big War raid',
			'Big War battle',
			'Big War',
		]);
		await page.locator('#q-list [data-id="big-war"]').click();
		await expect(page.locator('#panel')).toBeHidden();
		await expect(page.locator('#big-war')).toBeInViewport();
		await expect(page).toHaveURL(/\?cat=war#big-war$/);
		await expect(page.locator('#q')).toHaveValue('');
	});

	test('search suggestions work with the keyboard', async ({ page }) => {
		await page.goto('/');
		await openFilters(page);
		await page.locator('#q').pressSequentially('ancient');
		await expect(page.locator('#q-list .opt-t')).toHaveText(['Ancient plague']);
		await page.keyboard.press('ArrowDown');
		await expect(page.locator('#q')).toHaveAttribute('aria-activedescendant', 'q-opt-0');
		await expect(page.locator('#q-opt-0')).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('Enter');
		await expect(page.locator('#ancient-plague')).toBeInViewport();
		await expect(page).toHaveURL(/\/#ancient-plague$/);
	});

	test('random event button picks among the visible events only', async ({ page }) => {
		await page.goto('/?cat=epidemic');
		const epidemics = ['ancient-plague', 'ongoing-pandemic', 'endemic-disease'];
		const picked: string[] = [];

		for (let i = 0; i < 4; i++) {
			await page.click('#random-btn');
			await expect
				.poll(() => page.evaluate(() => location.hash.slice(1)))
				.not.toBe(picked.at(-1) ?? '');
			picked.push(await page.evaluate(() => location.hash.slice(1)));
		}

		for (const id of picked) expect(epidemics).toContain(id);
		await expect(page).toHaveURL(/\?cat=epidemic#/);
		await expect(page.locator(`#${picked.at(-1)}`)).toBeInViewport();
		await onlyCategories(page, []);
		await expect(page.locator('#random-btn')).toBeDisabled();
	});

	test('labels every 10 million deaths, uncertainty rings included', async ({ page }) => {
		await page.goto('/');

		const labels = page.locator('#endemic-disease .milestone');
		await expect(labels).toHaveCount(29);
		await expect(labels.first()).toHaveText('10M');
		await expect(labels.last()).toHaveText('290M');

		await expect(page.locator('#ongoing-pandemic .milestone')).toHaveText(['10M']);
		await expect(page.locator('#big-war .milestone')).toHaveCount(0);
	});

	test('moves the milestone labels with the grid rows', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');

		const label = page.locator('#endemic-disease .milestone').first();

		/**
		 * Measures how far the first label is below the top of its grid.
		 *
		 * @returns Distance in pixels.
		 */
		const offset = () =>
			label.evaluate((el) => {
				const grid = el.closest('.gw')?.querySelector('.grid') as HTMLElement;
				return el.getBoundingClientRect().top - grid.getBoundingClientRect().top;
			});

		const wide = await offset();

		await page.setViewportSize({ width: 375, height: 800 });
		await expect.poll(offset).toBeGreaterThan(wide);
	});

	test('keeps the reading position when the layout reflows', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		/**
		 * Measures how far the bottom edge of the bar is into the endemic-disease entry.
		 *
		 * @returns That distance as a ratio of the entry's height.
		 */
		const read = () =>
			page.evaluate(() => {
				const el = document.getElementById('endemic-disease') as HTMLElement;
				const bar = document.querySelector('.bar')?.getBoundingClientRect().height ?? 0;
				const r = el.getBoundingClientRect();
				return (bar - r.top) / r.height;
			});
		const top = await docTop(page, '#endemic-disease');
		const height = await page.$eval('#endemic-disease', (el) => el.getBoundingClientRect().height);
		await scrollUnderBar(page, top + height * 0.4);
		const before = await read();
		await page.setViewportSize({ width: 700, height: 800 });
		await expect.poll(read).toBeGreaterThan(before - 0.005);
		expect(await read()).toBeLessThan(before + 0.005);
	});
});
