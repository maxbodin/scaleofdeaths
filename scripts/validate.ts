/** Validates `data/` without building, and lists every problem found. */
import { loadDataset } from '../src/build/load-data.ts';
import { fail, ROOT } from './cli.ts';

try {
	const data = loadDataset(ROOT);
	const drafts = data.events.filter((e) => !e.reviewed).length;

	console.log(`✓ ${data.events.length} events and ${data.categories.length} categories are valid`);

	if (drafts > 0) console.warn(`  ${drafts} event(s) not yet reviewed (reviewed: false)`);
} catch (error) {
	fail(error);
}
