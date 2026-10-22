import { dictionaries, type Locale } from '../i18n/index.ts';
import { DataError, formatIssue, loadDataset } from './load-data.ts';
import { buildModel, type SiteModel } from './model.ts';
import type { RenderContext } from './render/context.ts';
import { esc } from './render/html.ts';
import { type PageAssets, renderPage } from './render/page.ts';

export interface BuiltPage {
	html: string;
	fallbacks: number;
}

/**
 * Loads, validates and models the data under `<root>/data/`.
 *
 * @param root Directory that contains `data/`.
 * @returns The site model.
 * @throws {DataError} If the data is invalid.
 */
export function loadModel(root: string): SiteModel {
	return buildModel(loadDataset(root));
}

/**
 * Renders one locale page.
 *
 * @param model Site model.
 * @param locale Page language.
 * @param assets Inline or linked CSS and JS, CSP and site options.
 * @returns The HTML and the number of French fields that fell back to English.
 */
export function buildPage(model: SiteModel, locale: Locale, assets: PageAssets): BuiltPage {
	const ctx: RenderContext = { locale, t: dictionaries[locale], fallbacks: { count: 0 } };
	const html = renderPage(model, ctx, assets);

	return { html, fallbacks: ctx.fallbacks.count };
}

/**
 * Renders a page for the dev server from the current data, linking the CSS and JS sources. Data errors are shown as a readable error page instead of failing.
 *
 * @param root Project root.
 * @param locale Page language.
 * @returns The HTML page.
 */
export function renderDevPage(root: string, locale: Locale): string {
	try {
		const assets: PageAssets = {
			css: { href: '/src/styles/main.css' },
			js: { src: '/src/client/main.ts' },
			siteUrl: '',
		};

		return buildPage(loadModel(root), locale, assets).html;
	} catch (error) {
		const text =
			error instanceof DataError ? error.issues.map(formatIssue).join('\n') : String(error);

		return `<!doctype html><title>Data error</title><h1>Data error</h1><pre>${esc(text)}</pre>`;
	}
}
