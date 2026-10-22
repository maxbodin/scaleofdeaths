import { CLIENT_KEYS, type ClientStrings } from '../../i18n/index.ts';
import { formatInt } from '../../shared/format.ts';
import { fill } from '../../shared/text.ts';
import type { SiteModel } from '../model.ts';
import type { RenderContext } from './context.ts';
import { renderBar } from './controls.ts';
import { renderEvent } from './event.ts';
import { esc, join } from './html.ts';
import { categoryTable, dotLegend } from './legend.ts';
import { credit, githubLink } from './links.ts';

/**
 * Runs before the first paint: marks the page as scripted and hides the list while a state from the URL is applied, so the default order never flashes.
 */
export const HEAD_SCRIPT =
	"(function(h){h.classList.remove('no-js');h.classList.add('js');if(location.search.length>1){h.classList.add('pending');setTimeout(function(){h.classList.remove('pending')},1000)}})(document.documentElement)";

export interface PageAssets {
	/** Inline CSS (production) or a stylesheet URL (dev). */
	css: { inline: string } | { href: string };
	js: { inline: string } | { src: string };
	csp?: string;
	analyticsToken?: string;
	siteUrl: string;
}

const PATHS = { en: '/', fr: '/fr/' } as const;

/**
 * Declares one CSS custom property per category colour.
 *
 * @param model Site model.
 * @returns A `:root` CSS rule.
 */
function categoryVars(model: SiteModel): string {
	const declarations = model.categories.map((c) => `--cat-${c.id}:${c.color}`);

	return `:root{${declarations.join(';')}}`;
}

/**
 * Formats the totals line of the default view. Sub-events are not counted, because their parents are visible.
 *
 * @param model Site model.
 * @param ctx Render context.
 * @returns For example `5 events, 155,227,898 deaths`, in the page language.
 */
function defaultTotals(model: SiteModel, ctx: RenderContext): string {
	const deaths = model.views.filter((v) => !v.parent).reduce((sum, v) => sum + v.best, 0);
	const n = model.views.length;
	const events = fill(n === 1 ? ctx.t.eventsOne : ctx.t.eventsOther, {
		n: formatInt(n, ctx.locale),
	});

	return fill(ctx.t.totals, { events, deaths: formatInt(deaths, ctx.locale) });
}

/**
 * Renders the canonical link, the `hreflang` alternates and `og:image`. They need absolute URLs, so nothing is rendered without a site URL.
 *
 * @param ctx Render context.
 * @param siteUrl Public origin, without a trailing slash.
 * @returns HTML, or an empty string.
 */
function absoluteLinks(ctx: RenderContext, siteUrl: string): string {
	if (!siteUrl) return '';

	/**
	 * Builds an escaped absolute URL.
	 *
	 * @param path Path starting with `/`.
	 * @returns The absolute URL.
	 */
	const abs = (path: string) => esc(`${siteUrl}${path}`);

	return join([
		`<link rel="canonical" href="${abs(PATHS[ctx.locale])}">`,
		`<link rel="alternate" hreflang="en" href="${abs(PATHS.en)}">`,
		`<link rel="alternate" hreflang="fr" href="${abs(PATHS.fr)}">`,
		`<link rel="alternate" hreflang="x-default" href="${abs(PATHS.en)}">`,
		`<meta property="og:image" content="${abs('/og.png')}">`,
	]);
}

/**
 * Renders the Content-Security-Policy meta tag. Only `&` and `"` are escaped, so the single quotes of the policy stay readable.
 *
 * @param csp Policy, or `undefined` in development.
 * @returns HTML, or an empty string.
 */
function cspMeta(csp: string | undefined): string {
	if (!csp) return '';

	const value = csp.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

	return `<meta http-equiv="Content-Security-Policy" content="${value}">`;
}

/**
 * Renders the styles: category colours, then the stylesheet (inline in production, linked in development).
 *
 * @param model Site model.
 * @param assets Page assets and options.
 * @returns HTML.
 */
function styles(model: SiteModel, assets: PageAssets): string {
	if ('inline' in assets.css) return `<style>${categoryVars(model)}${assets.css.inline}</style>`;

	return `<style>${categoryVars(model)}</style><link rel="stylesheet" href="${esc(assets.css.href)}">`;
}

/**
 * Renders the document head: metadata, CSP, the script that prevents a flash of the default order, and the styles.
 *
 * @param model Site model.
 * @param ctx Render context.
 * @param assets Page assets and options.
 * @returns HTML.
 */
function head(model: SiteModel, ctx: RenderContext, assets: PageAssets): string {
	const { t, locale } = ctx;

	return join([
		'<head>',
		'<meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width,initial-scale=1">',
		cspMeta(assets.csp),
		`<title>${esc(t.htmlTitle)}</title>`,
		`<meta name="description" content="${esc(t.metaDescription)}">`,
		absoluteLinks(ctx, assets.siteUrl),
		'<meta property="og:type" content="website">',
		`<meta property="og:title" content="${esc(t.siteTitle)}">`,
		`<meta property="og:description" content="${esc(t.metaDescription)}">`,
		`<meta property="og:locale" content="${locale === 'fr' ? 'fr_FR' : 'en_US'}">`,
		'<meta name="twitter:card" content="summary_large_image">',
		'<meta name="theme-color" content="#ffffff">',
		'<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
		`<script>${HEAD_SCRIPT}</script>`,
		styles(model, assets),
		'</head>',
	]);
}

/**
 * Renders the site header: language switch, title, intro, dot legend, events per category and no-JavaScript note.
 *
 * @param model Site model.
 * @param ctx Render context.
 * @returns HTML.
 */
function siteHeader(model: SiteModel, ctx: RenderContext): string {
	const { t, locale } = ctx;
	const other = locale === 'en' ? 'fr' : 'en';

	return join([
		'<header class="site">',
		`<a class="skip" href="#list">${esc(t.skipToList)}</a>`,
		'<p class="lang">',
		`<a href="${PATHS[other]}" hreflang="${other}" lang="${other}" id="lang-link" aria-label="${esc(t.otherLanguageLabel)}">`,
		esc(t.otherLanguage),
		'</a>',
		githubLink(ctx),
		'</p>',
		`<h1>${esc(t.siteTitle)}</h1>`,
		`<p class="intro">${esc(t.intro)}</p>`,
		dotLegend(ctx),
		categoryTable(model, ctx),
		`<noscript><p class="noscript">${esc(t.noscript)}</p></noscript>`,
		'</header>',
	]);
}

/**
 * Renders the totals line, the empty state and the list of events.
 *
 * @param model Site model.
 * @param ctx Render context.
 * @returns HTML.
 */
function main(model: SiteModel, ctx: RenderContext): string {
	const events = model.views.map((v) => renderEvent(v, ctx));

	return join([
		'<main class="main">',
		`<p class="totals" id="totals" aria-live="polite">${esc(defaultTotals(model, ctx))}</p>`,
		'<div class="empty" id="empty" hidden>',
		`<p>${esc(ctx.t.empty)}</p>`,
		`<button type="button" class="btn" data-reset>${esc(ctx.t.reset)}</button>`,
		'</div>',
		'<div class="list" id="list">',
		...events,
		'</div>',
		'</main>',
	]);
}

/**
 * Renders the empty mini-map rail. The browser script fills it in.
 *
 * @returns HTML.
 */
function minimap(): string {
	return join([
		'<div class="minimap" id="minimap" aria-hidden="true" data-js>',
		'<div class="mm-in" id="mm-in">',
		'<ol id="minimap-list"></ol>',
		'<div class="mm-view" id="mm-view"></div>',
		'</div>',
		'</div>',
	]);
}

/**
 * Renders the footer: method note, licences, link to the source code and author credit.
 *
 * @param ctx Render context.
 * @returns HTML.
 */
function footer(ctx: RenderContext): string {
	return join([
		'<footer class="foot">',
		`<p>${esc(ctx.t.footerMethod)}</p>`,
		`<p>${esc(ctx.t.footerLicences)}</p>`,
		`<p class="foot-gh">${githubLink(ctx)}</p>`,
		credit(ctx),
		'</footer>',
	]);
}

/**
 * Serializes the UI strings used by the browser script, safe to embed in a script tag.
 *
 * @param ctx Render context.
 * @returns JSON.
 */
function clientStrings(ctx: RenderContext): string {
	const strings = Object.fromEntries(CLIENT_KEYS.map((k) => [k, ctx.t[k]])) as ClientStrings;

	return JSON.stringify(strings).replace(/</g, '\\u003c');
}

/**
 * Renders the UI strings, the main script (inline or linked) and the optional analytics beacon.
 *
 * @param ctx Render context.
 * @param assets Page assets and options.
 * @returns HTML.
 */
function scripts(ctx: RenderContext, assets: PageAssets): string {
	const main =
		'inline' in assets.js
			? `<script type="module">${assets.js.inline}</script>`
			: `<script type="module" src="${esc(assets.js.src)}"></script>`;

	const beaconConfig = esc(JSON.stringify({ token: assets.analyticsToken }));
	const beacon = assets.analyticsToken
		? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${beaconConfig}'></script>`
		: '';

	return join([
		`<script type="application/json" id="i18n">${clientStrings(ctx)}</script>`,
		main,
		beacon,
	]);
}

/**
 * Renders a complete locale page.
 *
 * @param model Site model.
 * @param ctx Render context.
 * @param assets Page assets and options.
 * @returns The HTML document.
 */
export function renderPage(model: SiteModel, ctx: RenderContext, assets: PageAssets): string {
	return join([
		'<!doctype html>',
		`<html lang="${ctx.locale}" class="no-js">`,
		head(model, ctx, assets),
		'<body>',
		siteHeader(model, ctx),
		renderBar(model, ctx),
		main(model, ctx),
		minimap(),
		footer(ctx),
		scripts(ctx, assets),
		'</body>',
		'</html>',
	]);
}
