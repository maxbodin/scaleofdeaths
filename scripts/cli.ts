/** Helpers shared by the command-line scripts. */
import { join } from 'node:path';
import { DataError } from '../src/build/load-data.ts';

/** Project root. */
export const ROOT = join(import.meta.dirname, '..');

/**
 * Prints an error and stops the script with a failure exit code. Data errors are printed as their list of problems.
 *
 * @param error Error or message to print.
 */
export function fail(error: unknown): never {
	console.error(error instanceof DataError ? error.message : error);
	process.exit(1);
}
