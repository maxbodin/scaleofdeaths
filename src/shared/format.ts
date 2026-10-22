import type { DateParts } from './dates.ts';
import { fill } from './text.ts';

export interface PeriodStrings {
	bce: string;
	circa: string;
	ongoing: string;
	asOf: string;
}

export interface PeriodInput {
	start: DateParts;
	end?: DateParts;
	circa?: boolean;
	ongoing?: boolean;
	asOf?: DateParts;
}

/**
 * Formats an integer with the locale's digit grouping.
 *
 * @param n Number to format.
 * @param locale BCP 47 language tag.
 * @returns For example `75,000,000` or `75 000 000`.
 */
export function formatInt(n: number, locale: string): string {
	return new Intl.NumberFormat(locale).format(n);
}

/**
 * Formats a number in compact notation.
 *
 * @param n Number to format.
 * @param locale BCP 47 language tag.
 * @returns For example `85M` or `85 M`.
 */
export function formatCompact(n: number, locale: string): string {
	return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/**
 * Formats a year, with the BCE suffix when it is negative.
 *
 * @param year Year (negative for BCE).
 * @param t Localized strings.
 * @returns For example `1945` or `430 BCE`.
 */
function formatYear(year: number, t: Pick<PeriodStrings, 'bce'>): string {
	return year > 0 ? String(year) : `${-year} ${t.bce}`;
}

/**
 * Formats a date as precisely as it is known: full date, month and year, or year only. BCE dates are shown by year only.
 *
 * @param p Date parts.
 * @param locale BCP 47 language tag.
 * @param t Localized strings.
 * @returns The formatted date.
 */
export function formatDate(p: DateParts, locale: string, t: Pick<PeriodStrings, 'bce'>): string {
	if (p.year < 0 || p.month === undefined) return formatYear(p.year, t);

	const date = new Date(0);
	date.setUTCFullYear(p.year, p.month - 1, p.day ?? 1);

	const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', timeZone: 'UTC' };
	if (p.day !== undefined) options.day = 'numeric';

	return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Formats an event's period, for example `1939-1945`, `6 August 1945`, `c. 541`, `430 BCE` or `2019 - ongoing (as of 1 May 2026)`.
 *
 * @param input Dates and flags of the event.
 * @param locale BCP 47 language tag.
 * @param t Localized strings.
 * @returns The formatted period.
 */
export function formatPeriod(input: PeriodInput, locale: string, t: PeriodStrings): string {
	const prefix = input.circa ? `${t.circa} ` : '';
	const startYear = formatYear(input.start.year, t);

	if (input.ongoing) {
		const asOf = input.asOf
			? ` (${fill(t.asOf, { date: formatDate(input.asOf, locale, t) })})`
			: '';

		return `${prefix}${startYear} - ${t.ongoing}${asOf}`;
	}

	if (!input.end) return prefix + formatDate(input.start, locale, t);
	if (input.end.year === input.start.year) return prefix + startYear;

	const separator = input.start.year < 0 || input.end.year < 0 ? ' - ' : '-';

	return `${prefix}${startYear}${separator}${formatYear(input.end.year, t)}`;
}
