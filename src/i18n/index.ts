import { type Dictionary, en } from './en.ts';
import { fr } from './fr.ts';

export type Locale = 'en' | 'fr';
export const LOCALES: readonly Locale[] = ['en', 'fr'];
export const dictionaries: Record<Locale, Dictionary> = { en, fr };

/** Keys shipped to the browser (kept small on purpose). */
export const CLIENT_KEYS = [
	'eventsOne',
	'eventsOther',
	'totals',
	'removeItem',
	'deaths',
	'noMatch',
] as const satisfies ReadonlyArray<keyof Dictionary>;

export type ClientStrings = Record<(typeof CLIENT_KEYS)[number], string>;
