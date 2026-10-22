import { formatCompact, formatInt } from '../../shared/format.ts';
import type { EventView, SiteModel } from '../model.ts';
import type { Category } from '../schema.ts';
import { catVar, pickHtml, type RenderContext } from './context.ts';
import { esc, join } from './html.ts';

interface CategoryStats {
	category: Category;
	events: number;
	deaths: number;
}

/**
 * Renders the dot legend shown under the intro.
 *
 * @param ctx Render context.
 * @returns HTML.
 */
export function dotLegend(ctx: RenderContext): string {
	const { t } = ctx;

	return join([
		'<ul class="keys">',
		`<li><i class="k k-dot" aria-hidden="true"></i>${esc(t.legendDot)}</li>`,
		`<li><i class="k k-part" aria-hidden="true"></i>${esc(t.legendPartial)}</li>`,
		`<li><i class="k k-ring" aria-hidden="true"></i>${esc(t.legendRing)}</li>`,
		`<li><i class="k k-shade" aria-hidden="true"></i>${esc(t.legendShade)}</li>`,
		'</ul>',
	]);
}

/**
 * Counts the deaths an event adds in its own category: its best estimate, minus the deaths of its sub-events, which count in their own categories. Every death is so counted exactly once.
 *
 * @param view Event view.
 * @returns Deaths counted for the event's primary category.
 */
function ownDeaths(view: EventView): number {
	const inChildren = view.children.reduce((sum, c) => sum + c.deaths.best, 0);

	return view.best - inChildren;
}

/**
 * Counts the events and deaths of each category, by primary category, so every event and every death is counted once.
 *
 * @param model Site model.
 * @returns Categories with at least one event, most events first.
 */
function categoryStats(model: SiteModel): CategoryStats[] {
	const stats = new Map(
		model.categories.map((category) => [category.id, { category, events: 0, deaths: 0 }]),
	);

	for (const v of model.views) {
		const entry = stats.get(v.event.categories[0] as string);
		if (!entry) continue;

		entry.events += 1;
		entry.deaths += ownDeaths(v);
	}

	return [...stats.values()].filter((c) => c.events > 0).sort((a, b) => b.events - a.events);
}

/**
 * Renders the table of events and deaths per category, shown between the dot legend and the controls.
 *
 * @param model Site model.
 * @param ctx Render context.
 * @returns HTML.
 */
export function categoryTable(model: SiteModel, ctx: RenderContext): string {
	const { t, locale } = ctx;
	const rows = categoryStats(model).map(({ category, events, deaths }) =>
		join([
			`<tr style="--c:${catVar(category.id)}">`,
			`<th scope="row">${pickHtml(ctx, category.label)}</th>`,
			`<td>${esc(formatInt(events, locale))}</td>`,
			'<td>',
			`<span class="n-full">${esc(formatInt(deaths, locale))}</span>`,
			`<span class="n-short">${esc(formatCompact(deaths, locale))}</span>`,
			'</td>',
			'</tr>',
		]),
	);

	return join([
		'<table class="cats">',
		`<caption>${esc(t.categoryCounts)}</caption>`,
		'<thead><tr>',
		`<th scope="col">${esc(t.categories)}</th>`,
		`<th scope="col">${esc(t.events)}</th>`,
		`<th scope="col">${esc(t.deathsHeading)}</th>`,
		'</tr></thead>',
		'<tbody>',
		...rows,
		'</tbody>',
		'</table>',
		`<p class="cats-n">${esc(t.categoryNote)}</p>`,
	]);
}
