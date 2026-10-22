import { expect, test } from '@playwright/test';
import { onlyCategories, openFilters, visibleIds } from './helpers.ts';

const DEFAULT_ORDER = [
	'big-war-raid',
	'small-accident',
	'english-only',
	'ancient-plague',
	'quake',
	'big-war-battle',
	'big-war-massacre',
	'famine-war',
	'big-war',
	'ongoing-pandemic',
	'endemic-disease',
];

test.describe('sorting', () => {
	test('defaults to deaths ascending', async ({ page }) => {
		await page.goto('/');
		expect(await visibleIds(page)).toEqual(DEFAULT_ORDER);
		await expect(page.locator('#sort')).toHaveValue('deaths-asc');
	});

	test('sorts by deaths descending and by date', async ({ page }) => {
		await page.goto('/');
		await page.selectOption('#sort', 'deaths-desc');
		expect(await visibleIds(page)).toEqual([...DEFAULT_ORDER].reverse());
		await page.selectOption('#sort', 'date-asc');
		const ids = await visibleIds(page);
		expect(ids[0]).toBe('ancient-plague');
		expect(ids.indexOf('famine-war')).toBeLessThan(ids.indexOf('big-war-battle'));
		expect(ids.at(-1)).toBe('ongoing-pandemic');
		await expect(page).toHaveURL(/\?sort=date$/);
		await page.selectOption('#sort', 'date-desc');
		expect((await visibleIds(page))[0]).toBe('ongoing-pandemic');
		await expect(page).toHaveURL(/\?sort=date&order=desc$/);
	});
});

test.describe('filters', () => {
	test('categories are inclusive and totals never double count', async ({ page }) => {
		await page.goto('/');
		await onlyCategories(page, ['famine']);
		expect(await visibleIds(page)).toEqual(['famine-war']);
		await onlyCategories(page, ['famine', 'genocide']);
		expect(await visibleIds(page)).toEqual(['big-war-massacre', 'famine-war']);
		await expect(page).toHaveURL(/\?cat=famine,genocide$/);
		await expect(page.locator('#totals')).toHaveText('2 events · 4,200,000 deaths');
		await onlyCategories(page, ['war', 'genocide']);
		await expect(page.locator('#totals')).toHaveText('5 events · 8,000,000 deaths');
		await expect(page.locator('#filters-count')).toHaveText('1');
	});

	test('countries combine with OR and can be removed', async ({ page }) => {
		await page.goto('/');
		await openFilters(page);
		await page.fill('#country-input', 'Poland');
		await page.press('#country-input', 'Enter');
		expect(await visibleIds(page)).toEqual(['big-war-massacre']);
		await page.fill('#country-input', 'france');
		await page.click('#country-add');
		expect(await visibleIds(page)).toEqual(['big-war-raid', 'big-war-massacre', 'big-war']);
		await expect(page).toHaveURL(/\?country=FR,PL$/);
		await page.getByRole('button', { name: 'Remove Poland' }).click();
		expect(await visibleIds(page)).toEqual(['big-war-raid', 'big-war']);
		const options = await page.$$eval('#country-list option', (els) =>
			els.map((o) => (o as HTMLOptionElement).value),
		);
		expect(options).toContain('Ancient Athens');
		expect([...options].sort((a, b) => a.localeCompare(b, 'en'))).toEqual(options);
	});

	test('date range keeps overlapping events, including BCE', async ({ page }) => {
		await page.goto('/');
		await openFilters(page);
		await page.fill('#from-year', '1940');
		await page.fill('#to-year', '1941');
		await page.locator('#to-year').blur();
		expect(await visibleIds(page)).toEqual(['big-war', 'endemic-disease']);
		await page.fill('#from-year', '500');
		await page.selectOption('#from-era', 'bce');
		await page.fill('#to-year', '400');
		await page.selectOption('#to-era', 'bce');
		expect(await visibleIds(page)).toEqual(['ancient-plague']);
		await expect(page).toHaveURL(/\?from=-500&to=-400$/);
	});

	test('search filters on every text field when leaving the field; reset clears it', async ({
		page,
	}) => {
		await page.goto('/');
		await openFilters(page);
		await page.locator('#q').pressSequentially('athens');
		await expect(page.locator('#q-list .opt-t')).toHaveText(['Ancient plague']);
		await page.keyboard.press('Tab');
		await expect(page.locator('#q-list')).toBeHidden();
		expect(await visibleIds(page)).toEqual(['ancient-plague']);
		await expect(page).toHaveURL(/\?q=athens$/);
		await expect(page.locator('#filters-count')).toHaveText('1');
		await expect(page.locator('#totals')).toHaveText('1 event · 75,000 deaths');

		await page.locator('#q').fill('');
		await page.locator('#q').pressSequentially('fixture multi');
		await page.keyboard.press('Escape');
		await expect(page.locator('#panel')).toBeVisible();
		expect(await visibleIds(page)).toEqual(['famine-war']);
		await page.keyboard.press('Escape');
		await expect(page.locator('#panel')).toBeHidden();
		expect(await visibleIds(page)).toEqual(['famine-war']);
		await expect(page).toHaveURL(/\?q=fixture%20multi$/);

		await openFilters(page);
		await page.locator('#panel [data-reset]').click();
		await expect(page.locator('#q')).toHaveValue('');
		expect(await visibleIds(page)).toHaveLength(11);
		await expect(page).toHaveURL(/\/$/);
	});

	test('search filters the list and highlights matches while typing', async ({
		page,
		browserName,
	}) => {
		await page.goto('/');
		await openFilters(page);
		await page.locator('#q').pressSequentially('plague');
		await expect(page.locator('#q')).toBeFocused();
		await expect(page.locator('#q-list')).toBeVisible();
		await expect.poll(() => visibleIds(page)).toEqual(['ancient-plague']);
		await expect(page).toHaveURL(/\?q=plague$/);
		await expect(page.locator('#q-list .opt-t mark')).toHaveText(['plague']);

		const highlighted = () =>
			page.evaluate(() => [...(CSS.highlights?.get('search') ?? [])].map((r) => String(r)));
		const supported = await page.evaluate(
			() => typeof Highlight !== 'undefined' && !!CSS.highlights,
		);
		test.skip(!supported, `${browserName} has no CSS Custom Highlight API`);
		await expect.poll(highlighted).toContain('plague');

		await page.locator('#q').fill('');
		await expect.poll(() => visibleIds(page)).toHaveLength(11);
		await expect.poll(highlighted).toEqual([]);
	});

	test('search restores from the URL and ignores accents and case', async ({ page }) => {
		await page.goto('/fr/?q=PANDEMIE%20cours');
		expect(await visibleIds(page)).toEqual(['ongoing-pandemic']);
		await openFilters(page);
		await expect(page.locator('#q')).toHaveValue('PANDEMIE cours');
	});

	test('swaps an inverted range and shows an empty state with reset', async ({ page }) => {
		await page.goto('/?from=2025&to=2020');
		await expect(page).toHaveURL(/\?from=2020&to=2025$/);
		expect(await visibleIds(page)).toEqual(['ongoing-pandemic']);
		await onlyCategories(page, []);
		expect(await visibleIds(page)).toEqual([]);
		await expect(page.locator('#empty')).toBeVisible();
		await page.keyboard.press('Escape');
		await page.locator('#empty [data-reset]').click();
		expect(await visibleIds(page)).toHaveLength(11);
		await expect(page.locator('#empty')).toBeHidden();
		await expect(page).toHaveURL(/\/$/);
	});
});

test.describe('URL state', () => {
	test('restores state on load without painting the default order', async ({ page }) => {
		await page.goto('/?sort=date&order=desc&cat=epidemic');
		expect(await visibleIds(page)).toEqual([
			'ongoing-pandemic',
			'endemic-disease',
			'ancient-plague',
		]);
		await expect(page.locator('#sort')).toHaveValue('date-desc');
		await expect(page.locator('input[value="war"]')).not.toBeChecked();
		await expect(page.locator('html')).not.toHaveClass(/pending/);
	});

	test('drops invalid params one by one without errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto('/?sort=foo&cat=bogus,war&country=ZZ&from=abc');
		await expect(page).toHaveURL(/\/\?cat=war$/);
		expect(await visibleIds(page)).toEqual([
			'big-war-raid',
			'big-war-battle',
			'famine-war',
			'big-war',
		]);
		expect(errors).toEqual([]);
	});

	test('deep links reveal hidden events by resetting filters', async ({ page }) => {
		await page.goto('/?cat=epidemic#big-war');
		await expect(page.locator('#big-war')).toBeVisible();
		await expect(page.locator('#big-war')).toBeInViewport();
		await expect(page).toHaveURL(/\/#big-war$/);
	});

	test('unknown hash leaves the page at the top', async ({ page }) => {
		await page.goto('/#does-not-exist');
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});

	test('language switch keeps the query and hash', async ({ page }) => {
		await page.goto('/?sort=date');
		await expect(page.locator('#lang-link')).toHaveAttribute('href', '/fr/?sort=date');
		await page.click('#lang-link');
		await expect(page).toHaveURL(/\/fr\/\?sort=date$/);
		await expect(page.locator('#sort')).toHaveValue('date-asc');
	});
});
