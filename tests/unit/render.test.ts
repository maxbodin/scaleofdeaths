import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPage, loadModel } from '../../src/build/pages.ts';
import { HEAD_SCRIPT, type PageAssets } from '../../src/build/render/page.ts';
import { buildSite } from '../../src/build/site.ts';
import { EDGE_EVENTS, tempDataset } from '../fixtures/make-edge.ts';

const root = join(import.meta.dirname, '..', '..');
const assets: PageAssets = { css: { inline: '' }, js: { inline: '' }, siteUrl: '' };

/**
 * Builds the site model of a dataset written to a temporary folder.
 *
 * @param events Events to include.
 * @returns The site model.
 */
function edgeModel(events = EDGE_EVENTS) {
	const dir = tempDataset(events);
	return loadModel(dir);
}

describe('page rendering', () => {
	it('escapes data and keeps one article per event', () => {
		const evil = { ...EDGE_EVENTS[9], title: { en: '<script>alert(1)</script>' } } as Record<
			string,
			unknown
		>;
		const html = buildPage(edgeModel([evil]), 'en', assets).html;
		expect(html).not.toContain('<script>alert(1)</script>');
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
	});

	it('renders the default order and pre-computed totals', () => {
		const html = buildPage(edgeModel(), 'en', assets).html;
		const ids = [...html.matchAll(/<article id="([^"]+)"/g)].map((m) => m[1]);
		expect(ids[0]).toBe('big-war-raid');
		expect(ids.at(-1)).toBe('endemic-disease');
		expect(html).toContain('11 events · 315,238,250 deaths');
	});

	it('falls back to English for missing French fields and counts them', () => {
		const page = buildPage(edgeModel(), 'fr', assets);
		expect(page.html).toContain('English-only event');
		expect(page.fallbacks).toBe(2);
		expect(page.html).toContain('<html lang="fr"');
	});

	it('renders events below one dot as a number, without grid or note', () => {
		const html = buildPage(edgeModel(), 'en', assets).html;
		const article = html.slice(
			html.indexOf('<article id="small-accident"'),
			html.indexOf('</article>', html.indexOf('<article id="small-accident"')),
		);
		expect(article).not.toContain('class="grid"');
		expect(article).not.toContain('Fewer than 1,000 deaths');
		expect(article).toContain('<strong>750</strong> deaths');
	});

	it('lists sub-events fewest deaths first, in contrasting shades', () => {
		const html = buildPage(edgeModel(), 'en', assets).html;
		const start = html.indexOf('<article id="big-war"');
		const article = html.slice(start, html.indexOf('</article>', start));
		const legend = [...article.matchAll(/<li><i class="sw[^"]*"[^>]*><\/i><a href="#([^"]+)"/g)];

		expect(legend.map((m) => m[1])).toEqual(['big-war-raid', 'big-war-battle', 'big-war-massacre']);
		expect(article).toContain('--k:color-mix(in oklab, var(--cat-war) 50%, #000)');
		expect(article).toContain('--k:color-mix(in oklab, var(--cat-genocide) 40%, #fff)');
	});

	it('renders events and deaths per primary category, every death counted once', () => {
		const html = buildPage(edgeModel(), 'en', assets).html;
		const rows = [
			...html.matchAll(
				/<tr style="--c:var\(--cat-([a-z-]+)\)"><th scope="row">[^<]+<\/th><td>([\d,]+)<\/td><td><span class="n-full">([\d,]+)<\/span>/g,
			),
		].map((m) => `${m[1]} ${m[2]} ${m[3]}`);

		expect(html.indexOf('class="cats"')).toBeGreaterThan(html.indexOf('class="keys"'));
		expect(html.indexOf('class="cats"')).toBeLessThan(html.indexOf('class="bar"'));
		expect(rows).toEqual([
			'war 3 3,800,000',
			'epidemic 3 307,075,000',
			'natural-disaster 2 162,500',
			'famine 1 3,000,000',
			'genocide 1 1,200,000',
			'accident 1 750',
		]);
		expect(html).toContain('315,238,250 deaths');
	});

	it('renders milestone labels through the uncertainty rings', () => {
		const flu = { ...EDGE_EVENTS[9], deaths: { best: 50_000_000, high: 100_000_000 } } as Record<
			string,
			unknown
		>;
		const html = buildPage(edgeModel([flu]), 'en', assets).html;

		expect(html.match(/class="milestone"/g)).toHaveLength(9);
		expect(html).toContain('<span class="milestone" style="--o:50000">50M</span>');
	});

	it('marks sources as external links', () => {
		const html = buildPage(edgeModel(), 'en', assets).html;
		expect(html).toContain(
			'href="https://example.org/source" target="_blank" rel="noopener noreferrer"',
		);
	});
});

describe('production build', () => {
	it('is deterministic and hashes inline scripts into the CSP', async () => {
		const dir = tempDataset(EDGE_EVENTS);
		const out1 = join(dir, 'out1');
		const out2 = join(dir, 'out2');
		await buildSite({ root, dataRoot: dir, outDir: out1 });
		await buildSite({ root, dataRoot: dir, outDir: out2 });
		for (const page of ['index.html', 'fr/index.html']) {
			expect(readFileSync(join(out1, page), 'utf8')).toBe(readFileSync(join(out2, page), 'utf8'));
		}
		const html = readFileSync(join(out1, 'index.html'), 'utf8');
		const js = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] ?? '';
		/**
		 * Computes a base64 SHA-256 digest.
		 *
		 * @param t Text to hash.
		 * @returns The digest.
		 */
		const hash = (t: string) => createHash('sha256').update(t).digest('base64');
		expect(html).toContain(`'sha256-${hash(js)}'`);
		expect(html).toContain(`'sha256-${hash(HEAD_SCRIPT)}'`);
		expect(html).not.toContain('cloudflareinsights');
	}, 30_000);

	it('injects the analytics beacon only with a token', async () => {
		const dir = tempDataset(EDGE_EVENTS.slice(0, 1));
		await buildSite({ root, dataRoot: dir, outDir: join(dir, 'out'), analyticsToken: 'abc123' });
		const html = readFileSync(join(dir, 'out', 'index.html'), 'utf8');
		expect(html).toContain('static.cloudflareinsights.com/beacon.min.js');
		expect(html).toContain("connect-src 'self' https://cloudflareinsights.com");
	}, 30_000);
});

describe('absolute links', () => {
	it('emits canonical, hreflang and og:image only with a site URL', () => {
		const model = edgeModel(EDGE_EVENTS.slice(0, 1));
		expect(buildPage(model, 'en', assets).html).not.toContain('rel="alternate"');
		const html = buildPage(model, 'fr', { ...assets, siteUrl: 'https://scaleofdeaths.org' }).html;
		expect(html).toContain('<link rel="canonical" href="https://scaleofdeaths.org/fr/">');
		expect(html).toContain('hreflang="en" href="https://scaleofdeaths.org/"');
		expect(html).toContain('<meta property="og:image" content="https://scaleofdeaths.org/og.png">');
	});
});
