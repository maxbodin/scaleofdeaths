export interface DateParts {
	year: number;
	month?: number;
	day?: number;
}

const DATE_RE = /^(-?)(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/**
 * Parses a date written as `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. A leading `-` means BCE; year 0 does not exist.
 *
 * @param input Date string.
 * @returns The date parts, or `null` if the date is invalid.
 */
export function parseDate(input: string): DateParts | null {
	const m = DATE_RE.exec(input);
	if (!m) return null;

	const year = Number(m[2]) * (m[1] ? -1 : 1);
	const parts: DateParts = { year };
	if (m[3]) parts.month = Number(m[3]);
	if (m[4]) parts.day = Number(m[4]);

	return isValidDate(parts) ? parts : null;
}

/**
 * Counts the days in a month of the proleptic Gregorian calendar.
 *
 * @param year Year (negative for BCE).
 * @param month Month, from 1 to 12.
 * @returns A number from 28 to 31.
 */
function daysInMonth(year: number, month: number): number {
	const d = new Date(0);
	d.setUTCFullYear(year, month, 0);

	return d.getUTCDate();
}

/**
 * Checks that a date exists: no year 0, a valid month and a valid day for that month.
 *
 * @param parts Date parts.
 * @returns `true` if the date is valid.
 */
function isValidDate(parts: DateParts): boolean {
	const { year, month, day } = parts;

	if (year === 0 || Math.abs(year) > 9999) return false;
	if (month === undefined) return day === undefined;
	if (month < 1 || month > 12) return false;

	return day === undefined || (day >= 1 && day <= daysInMonth(year, month));
}

/**
 * Builds a sortable integer key (year * 10000 + month * 100 + day) that stays ordered across BCE and CE. Partial dates expand to their earliest (`start`) or latest (`end`) day.
 *
 * @param p Date parts.
 * @param edge Which end of a partial date to use.
 * @returns The key.
 */
export function dateKey(p: DateParts, edge: 'start' | 'end' = 'start'): number {
	const month = p.month ?? (edge === 'start' ? 1 : 12);
	const day = p.day ?? (edge === 'start' ? 1 : daysInMonth(p.year, month));

	return p.year * 10000 + month * 100 + day;
}

/**
 * Builds the key of 1 January of a year.
 *
 * @param year Year (negative for BCE).
 * @returns The key.
 */
export function yearStartKey(year: number): number {
	return year * 10000 + 101;
}

/**
 * Builds the key of 31 December of a year.
 *
 * @param year Year (negative for BCE).
 * @returns The key.
 */
export function yearEndKey(year: number): number {
	return year * 10000 + 1231;
}
