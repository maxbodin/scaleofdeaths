import { z } from 'zod';

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Em dashes are not used anywhere in the project: write a hyphen instead. */
const EM_DASH = '\u2014';

const text = z
	.string()
	.trim()
	.min(1)
	.refine((value) => !value.includes(EM_DASH), 'must not contain an em dash, use a hyphen');
const localized = z.strictObject({ en: text, fr: text.optional() });
const description = z.strictObject({ en: text.max(600), fr: text.max(600).optional() });
const partialDate = z
	.string()
	.regex(
		/^-?\d{4}(?:-\d{2}(?:-\d{2})?)?$/,
		'expected YYYY, YYYY-MM or YYYY-MM-DD (negative = BCE)',
	);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const count = z.number().int().min(1);

const countrySchema = z.strictObject({
	code: z
		.string()
		.regex(/^[A-Z]{2}$/, 'expected an ISO 3166-1 alpha-2 code')
		.optional(),
	name: localized.optional(),
	deaths: count.optional(),
});

const sourceSchema = z.strictObject({
	title: text,
	url: z.string().regex(/^https:\/\/\S+$/, 'must be an https:// URL'),
	publisher: text.optional(),
	accessed: isoDay,
});

export const eventSchema = z.strictObject({
	id: z.string().regex(KEBAB, 'expected kebab-case'),
	title: localized,
	description,
	categories: z.array(z.string()).min(1, 'at least one category'),
	kind: z.enum(['event', 'endemic-total']).default('event'),
	start: partialDate,
	end: partialDate.optional(),
	circa: z.boolean().optional(),
	ongoing: z.boolean().optional(),
	asOf: isoDay.optional(),
	deaths: z.strictObject({
		best: count,
		low: count.optional(),
		high: count.optional(),
		note: localized.optional(),
	}),
	countries: z.array(countrySchema).min(1, 'at least one country'),
	partOf: z.string().optional(),
	related: z.array(z.string()).optional(),
	sources: z.array(sourceSchema).min(1, 'at least one source'),
	reviewed: z.boolean(),
	lastReviewed: isoDay.optional(),
});

export const categorySchema = z.strictObject({
	id: z.string().regex(KEBAB, 'expected kebab-case'),
	order: z.number().int(),
	color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'expected #RRGGBB'),
	label: localized,
});

export type DeathEvent = z.output<typeof eventSchema>;
export type CountryEntry = z.output<typeof countrySchema>;
export type Category = z.output<typeof categorySchema>;
export type LocalizedText = z.output<typeof localized>;
