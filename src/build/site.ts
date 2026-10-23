import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';
import { LOCALES } from '../i18n/index.ts';
import { buildPage, loadModel } from './pages.ts';
import { HEAD_SCRIPT, type PageAssets } from './render/page.ts';

const BROWSERS = ['chrome120', 'edge120', 'firefox118', 'safari16.4'];

export interface SiteOptions {
	/** Project root (sources, public/). */
	root: string;
	/** Directory containing `data/`. */
	dataRoot: string;
	outDir: string;
	siteUrl?: string;
}

export interface SiteReport {
	events: number;
	drafts: number;
	fallbacks: Record<string, number>;
}

/**
 * Bundles and minifies a JS or CSS entry point for the supported browsers.
 *
 * @param root Project root.
 * @param entry Entry path, relative to the root.
 * @returns The minified code.
 */
async function bundle(root: string, entry: string): Promise<string> {
	const result = await build({
		entryPoints: [join(root, entry)],
		bundle: true,
		minify: true,
		format: 'esm',
		target: BROWSERS,
		write: false,
		legalComments: 'none',
		logLevel: 'warning',
	});

	return result.outputFiles[0]?.text.trim() ?? '';
}

/**
 * Computes the CSP source expression that allows one inline script.
 *
 * @param text Exact script content.
 * @returns For example `'sha256-...'`.
 */
const sha = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

/**
 * Builds the Content-Security-Policy: inline scripts are allowed by hash only, inline styles are allowed, and no third-party origin is allowed.
 *
 * @param js Content of the inline module script.
 * @returns The policy.
 */
function contentSecurityPolicy(js: string): string {
	const directives = [
		"default-src 'none'",
		`script-src ${sha(HEAD_SCRIPT)} ${sha(js)}`,
		"style-src 'unsafe-inline'",
		"img-src 'self' data:",
		"connect-src 'self'",
		"base-uri 'none'",
		"form-action 'none'",
	];

	return directives.join('; ');
}

/**
 * Bundles the client script and the stylesheet, and prepares the page assets.
 *
 * @param opts Build options.
 * @returns Inline CSS and JS, CSP and site URL.
 */
async function prepareAssets(opts: SiteOptions): Promise<PageAssets> {
	const script = await bundle(opts.root, 'src/client/main.ts');
	const js = script.replace(/<\/script/gi, '<\\/script');
	const css = await bundle(opts.root, 'src/styles/main.css');

	return {
		css: { inline: css },
		js: { inline: js },
		csp: contentSecurityPolicy(js),
		siteUrl: (opts.siteUrl ?? '').replace(/\/$/, ''),
	};
}

/**
 * Validates the data, bundles CSS and JS, and writes one self-contained HTML page per locale, plus the static files from `public/`.
 *
 * @param opts Source, data and output folders, and the optional site URL.
 * @returns The number of events, of unreviewed events, and of French fallbacks per locale.
 */
export async function buildSite(opts: SiteOptions): Promise<SiteReport> {
	const model = loadModel(opts.dataRoot);
	const assets = await prepareAssets(opts);

	rmSync(opts.outDir, { recursive: true, force: true });
	cpSync(join(opts.root, 'public'), opts.outDir, { recursive: true });

	const fallbacks: Record<string, number> = {};

	for (const locale of LOCALES) {
		const page = buildPage(model, locale, assets);
		const dir = locale === 'en' ? opts.outDir : join(opts.outDir, locale);

		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, 'index.html'), page.html);

		fallbacks[locale] = page.fallbacks;
	}

	return {
		events: model.views.length,
		drafts: model.views.filter((v) => !v.event.reviewed).length,
		fallbacks,
	};
}
