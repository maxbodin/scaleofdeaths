import { parseDate } from '../../shared/dates.ts';
import { formatCompact, formatDate, formatInt, formatPeriod } from '../../shared/format.ts';
import { fill } from '../../shared/text.ts';
import { countryKey, countryLabels } from '../countries.ts';
import type { EventView } from '../model.ts';
import { catVar, eventLink, pickHtml, type RenderContext } from './context.ts';
import { childColors, renderGrid, renderIncludes } from './grid.ts';
import { attrs, esc, join } from './html.ts';

/**
 * Formats the event's dates for the page language.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @returns For example `1939-1945` or `c. 430 BCE - 426 BCE`.
 */
function period(view: EventView, ctx: RenderContext): string {
	const e = view.event;
	const input = {
		start: view.startParts,
		end: view.endParts,
		circa: e.circa,
		ongoing: e.ongoing,
		asOf: view.asOfParts,
	};

	return formatPeriod(input, ctx.locale, ctx.t);
}

/**
 * Renders the event's tags: categories, parent event, endemic-total badge and draft badge.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @returns HTML.
 */
function renderTags(view: EventView, ctx: RenderContext): string {
	const e = view.event;
	const categories = view.categories.map(
		(c) => `<li class="tag" style="--c:${catVar(c.id)}">${pickHtml(ctx, c.label)}</li>`,
	);
	const endemic = esc(fill(ctx.t.endemic, { period: period(view, ctx) }));

	return join([
		'<ul class="tags">',
		...categories,
		view.parent &&
			`<li class="tag tag-plain">${esc(ctx.t.partOf)} ${eventLink(ctx, view.parent)}</li>`,
		e.kind === 'endemic-total' && `<li class="tag tag-plain">${endemic}</li>`,
		!e.reviewed && `<li class="tag tag-draft">${esc(ctx.t.unreviewed)}</li>`,
		'</ul>',
	]);
}

/**
 * Returns the lower and upper estimates of an event. A missing bound is the best estimate.
 *
 * @param view Event view.
 * @returns `[low, high]`, or `null` when the event has a single figure.
 */
function estimateBounds(view: EventView): [number, number] | null {
	const { low, high, best } = view.event.deaths;
	if (low === undefined && high === undefined) return null;

	return [low ?? best, high ?? best];
}

/**
 * Renders the compact range of estimates shown in the header, when the event has one.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @returns HTML, or an empty string.
 */
function renderRange(view: EventView, ctx: RenderContext): string {
	const bounds = estimateBounds(view);
	if (!bounds) return '';

	const range = bounds.map((n) => formatCompact(n, ctx.locale)).join(' - ');

	return `<span class="ev-r">${esc(ctx.t.estimates)} ${esc(range)}</span>`;
}

/**
 * Renders the affected countries, with per-country deaths when known.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @returns HTML.
 */
function renderCountries(view: EventView, ctx: RenderContext): string {
	const items = view.event.countries.map((c) => {
		const deaths = c.deaths
			? ` <span class="num">${esc(formatInt(c.deaths, ctx.locale))}</span>`
			: '';

		return `<li data-country="${esc(countryKey(c))}">${pickHtml(ctx, countryLabels(c))}${deaths}</li>`;
	});

	return join(['<ul class="countries">', ...items, '</ul>']);
}

/**
 * Renders the numbered list of sources. Links open in a new tab.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @returns HTML.
 */
function renderSources(view: EventView, ctx: RenderContext): string {
	const items = view.event.sources.map((s) => {
		const accessed = parseDate(s.accessed);
		const date = accessed ? formatDate(accessed, ctx.locale, ctx.t) : s.accessed;
		const meta = join([
			s.publisher && `<span class="pub">${esc(s.publisher)}</span>, `,
			esc(fill(ctx.t.accessed, { date })),
		]);
		const anchor = attrs({ href: s.url, target: '_blank', rel: 'noopener noreferrer' });

		return `<li><a${anchor}>${esc(s.title)}</a> - ${meta}</li>`;
	});

	return join([`<h3>${esc(ctx.t.sources)}</h3>`, '<ol class="sources">', ...items, '</ol>']);
}

/**
 * Formats the full range of estimates shown in the details, or the single figure when there is no range.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @returns For example `70,000,000 - 85,000,000`.
 */
function estimateRange(view: EventView, ctx: RenderContext): string {
	const bounds = estimateBounds(view) ?? [view.best];

	return bounds.map((n) => formatInt(n, ctx.locale)).join(' - ');
}

/**
 * Renders the expandable details: description, toll note, estimates, countries, parent, related events and sources.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @returns HTML.
 */
function renderDetails(view: EventView, ctx: RenderContext): string {
	const e = view.event;
	const { t } = ctx;
	const note = e.deaths.note;
	const related = view.related.map((r) => eventLink(ctx, r)).join(', ');

	return join([
		'<details class="ev-d">',
		`<summary>${esc(t.details)}</summary>`,
		'<div class="ev-body">',
		`<p>${pickHtml(ctx, e.description)}</p>`,
		note && `<p class="note">${pickHtml(ctx, note)}</p>`,
		'<dl>',
		`<dt>${esc(t.estimates)}</dt><dd>${esc(estimateRange(view, ctx))}</dd>`,
		`<dt>${esc(t.countries)}</dt><dd>${renderCountries(view, ctx)}</dd>`,
		view.parent && `<dt>${esc(t.partOf)}</dt><dd>${eventLink(ctx, view.parent)}</dd>`,
		related && `<dt>${esc(t.seeAlso)}</dt><dd>${related}</dd>`,
		'</dl>',
		renderSources(view, ctx),
		'</div>',
		'</details>',
	]);
}

/**
 * Renders the sticky header of an event: title, period, toll and range of estimates.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @param titleId Id of the title, referenced by the article.
 * @returns HTML.
 */
function renderHeader(view: EventView, ctx: RenderContext, titleId: string): string {
	const count = `<strong>${esc(formatInt(view.best, ctx.locale))}</strong> ${esc(ctx.t.deaths)}`;

	return join([
		'<header class="ev-h">',
		`<h2 class="ev-t" id="${esc(titleId)}">${pickHtml(ctx, view.event.title)}</h2>`,
		'<p class="ev-m">',
		`<span class="ev-y">${esc(period(view, ctx))}</span>`,
		`<span class="ev-n">${count}</span>`,
		renderRange(view, ctx),
		'</p>',
		'</header>',
	]);
}

/**
 * Renders one event entry: sticky header, tags, details, sub-event legend and dot grid. Sort and filter data are stored in `data-*` attributes.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @returns HTML.
 */
export function renderEvent(view: EventView, ctx: RenderContext): string {
	const e = view.event;
	const colors = childColors(view);
	const titleId = `t-${e.id}`;

	const data = attrs({
		id: e.id,
		class: 'ev',
		style: `--c:${catVar(e.categories[0] as string)}`,
		'aria-labelledby': titleId,
		'data-best': view.best,
		'data-start': view.start,
		'data-end': view.end,
		'data-cats': e.categories.join(' '),
		'data-countries': view.countryKeys.join(' '),
		'data-parent': e.partOf,
	});

	return join([
		`<article${data}>`,
		renderHeader(view, ctx, titleId),
		renderTags(view, ctx),
		renderDetails(view, ctx),
		renderIncludes(view, ctx, colors),
		renderGrid(view, ctx, colors),
		'</article>',
	]);
}
