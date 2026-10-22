import type { CountryEntry, LocalizedText } from './schema.ts';

/** ISO 3166-3 codes of former states: ICU maps them to successors, so a name is mandatory. */
export const DISSOLVED_CODES = new Set([
	'SU',
	'YU',
	'DD',
	'CS',
	'ZR',
	'TP',
	'BU',
	'AN',
	'VD',
	'YD',
	'DY',
	'HV',
	'NH',
	'RH',
]);

/** Codes ICU accepts that are not ISO 3166-1 countries: unions, organisations, reserved, private-use and unknown codes. */
const NOT_COUNTRIES = new Set([
	'AC',
	'CP',
	'CQ',
	'DG',
	'EA',
	'EU',
	'EZ',
	'FX',
	'IC',
	'QO',
	'TA',
	'UK',
	'UN',
	'XA',
	'XB',
	'ZZ',
]);

const regionNames = {
	en: new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }),
	fr: new Intl.DisplayNames(['fr'], { type: 'region', fallback: 'none' }),
};

/**
 * Tells whether a code names a country: an ISO 3166-1 alpha-2 code, a former state's code, or `XK` (Kosovo).
 *
 * @param code Two-letter code.
 * @returns `true` if the code names a country.
 */
export function isCountryCode(code: string): boolean {
	return !NOT_COUNTRIES.has(code) && regionNames.en.of(code) !== undefined;
}

/**
 * Turns a name into a lowercase ASCII slug: accents removed, words joined by hyphens.
 *
 * @param value Name to convert.
 * @returns The slug.
 */
function slug(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Builds the stable filter key of a country: its ISO code, or `x-<slug>` for entities without
 * one.
 *
 * @param c Country entry from an event file.
 * @returns The filter key.
 */
export function countryKey(c: CountryEntry): string {
	return c.code ?? `x-${slug(c.name?.en ?? '')}`;
}

/**
 * Returns the display names of a country: the explicit name if provided, otherwise ICU's
 * region name.
 *
 * @param c Country entry from an event file.
 * @returns English and French labels.
 */
export function countryLabels(c: CountryEntry): LocalizedText {
	if (c.name) return c.name;

	const code = c.code ?? '';

	return { en: regionNames.en.of(code) ?? code, fr: regionNames.fr.of(code) ?? code };
}
