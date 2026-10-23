/**
 * Builds the site into `dist/` (or `SOD_OUT_DIR`) from `data/` (or `SOD_DATA_ROOT/data`).
 * Optional: `SITE_URL` enables absolute links.
 */
import { resolve } from 'node:path';
import { buildSite, type SiteReport } from '../src/build/site.ts';
import { fail, ROOT } from './cli.ts';

const env = process.env;

/**
 * Prints what was built, and warns about French fallbacks and unreviewed events.
 *
 * @param report Build summary.
 */
function printReport(report: SiteReport): void {
	const locales = Object.keys(report.fallbacks).length;
	console.log(`Built ${report.events} events in ${locales} languages`);

	for (const [locale, n] of Object.entries(report.fallbacks)) {
		if (n > 0) console.warn(`  ${locale}: ${n} field(s) fell back to English`);
	}

	if (report.drafts > 0) {
		console.warn(`  ${report.drafts} event(s) not yet reviewed (reviewed: false)`);
	}
}

try {
	const report = await buildSite({
		root: ROOT,
		dataRoot: resolve(ROOT, env.SOD_DATA_ROOT ?? '.'),
		outDir: resolve(ROOT, env.SOD_OUT_DIR ?? 'dist'),
		siteUrl: env.SITE_URL,
	});

	printReport(report);
} catch (error) {
	fail(error);
}
