import type { Dictionary } from '../../i18n/en.ts';
import type { Locale } from '../../i18n/index.ts';
import type { DeathEvent, LocalizedText } from '../schema.ts';
import { esc } from './html.ts';

export interface RenderContext {
	locale: Locale;
	t: Dictionary;
	/** Counts FR fields that fell back to EN. */
	fallbacks: { count: number };
}

/**
 * Picks the text for the page language. Missing French text falls back to English, and the fallback is counted.
 *
 * @param ctx Render context.
 * @param text Localized text.
 * @returns The text to display.
 */
export function pick(ctx: RenderContext, text: LocalizedText): string {
	if (ctx.locale === 'en') return text.en;
	if (text.fr) return text.fr;

	ctx.fallbacks.count += 1;

	return text.en;
}

/**
 * Picks the text for the page language and escapes it for HTML.
 *
 * @param ctx Render context.
 * @param text Localized text.
 * @returns Escaped text.
 */
export function pickHtml(ctx: RenderContext, text: LocalizedText): string {
	return esc(pick(ctx, text));
}

/**
 * Renders a link to an event's entry in the list.
 *
 * @param ctx Render context.
 * @param e Target event.
 * @returns HTML.
 */
export function eventLink(ctx: RenderContext, e: DeathEvent): string {
	return `<a href="#${esc(e.id)}">${pickHtml(ctx, e.title)}</a>`;
}

/**
 * Builds the CSS variable reference that holds a category colour.
 *
 * @param id Category id.
 * @returns For example `var(--cat-war)`.
 */
export function catVar(id: string): string {
	return `var(--cat-${id})`;
}
