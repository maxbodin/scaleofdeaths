import { formatCompact, formatInt } from '../../shared/format.ts';
import { buildSegments, dotCounts, milestones, SCALE, type Segment } from '../../shared/layout.ts';
import type { EventView } from '../model.ts';
import type { DeathEvent } from '../schema.ts';
import { catVar, eventLink, type RenderContext } from './context.ts';
import { esc, join } from './html.ts';

/**
 * Darkens a colour strongly.
 *
 * @param color CSS colour.
 * @returns The dark shade.
 */
const dark = (color: string) => `color-mix(in oklab, ${color} 50%, #000)`;

/**
 * Lightens a colour strongly.
 *
 * @param color CSS colour.
 * @returns The light shade.
 */
const light = (color: string) => `color-mix(in oklab, ${color} 40%, #fff)`;

/**
 * Assigns a dot colour to each sub-event drawn in the parent's grid. Neighbouring runs alternate between a strong and a light shade, so they never blend; the strong shade is the sub-event's category colour, darkened when it is the parent's own colour.
 *
 * @param view Parent event view.
 * @returns Sub-event id to CSS colour, for sub-events with at least one dot.
 */
export function childColors(view: EventView): Map<string, string> {
	const parentCategory = view.event.categories[0];
	const drawn = view.children.filter((c) => c.deaths.best >= SCALE);
	const colors = new Map<string, string>();

	drawn.forEach((child, i) => {
		const category = child.categories[0] as string;
		const color = catVar(category);
		const strong = category === parentCategory ? dark(color) : color;

		colors.set(child.id, i % 2 === 0 ? strong : light(color));
	});

	return colors;
}

/**
 * Renders one run of dots as an element positioned by CSS custom properties.
 *
 * @param s Run to render.
 * @param colors Sub-event colours.
 * @returns HTML.
 */
function renderSegment(s: Segment, colors: Map<string, string>): string {
	const position = `--o:${s.offset};--n:${s.count}`;

	switch (s.kind) {
		case 'child':
			return `<i class="s" style="${position};--k:${esc(colors.get(s.childId ?? '') ?? '')}"></i>`;

		case 'own':
			return `<i class="s" style="${position}"></i>`;

		case 'fraction':
			return `<i class="f" style="--o:${s.offset};--f:${(s.fraction ?? 0).toFixed(3)}"></i>`;

		case 'range':
			return `<i class="s u" style="${position}"></i>`;
	}
}

/**
 * Renders the milestone labels (every 10 million deaths) shown in the margin of a dot grid.
 * Each label carries the index of its dot; CSS turns it into a row, like the dots themselves.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @returns HTML, or an empty string when the event has 10 million deaths or fewer.
 */
function renderMilestones(view: EventView, ctx: RenderContext): string {
	const { best, high } = view.event.deaths;
	const labels = milestones(best, high).map(
		(m) =>
			`<span class="milestone" style="--o:${m.dot}">${esc(formatCompact(m.deaths, ctx.locale))}</span>`,
	);

	if (labels.length === 0) return '';

	return join(['<div class="milestones" aria-hidden="true">', ...labels, '</div>']);
}

/**
 * Renders the dot grid of an event and its milestone labels. Events with fewer than 1,000 deaths have no grid: their toll is shown as a number in the header.
 *
 * @param view Event view.
 * @param ctx Render context.
 * @param colors Sub-event colours.
 * @returns HTML, or an empty string when the event has no dot.
 */
export function renderGrid(
	view: EventView,
	ctx: RenderContext,
	colors: Map<string, string>,
): string {
	const { best, high } = view.event.deaths;
	const children = view.children.map((c) => ({ id: c.id, best: c.deaths.best }));
	const segments = buildSegments(best, high, children);

	if (segments.length === 0) return '';

	return join([
		'<div class="gw">',
		`<div class="grid" style="--t:${dotCounts(best, high).total}" aria-hidden="true">`,
		...segments.map((s) => renderSegment(s, colors)),
		'</div>',
		renderMilestones(view, ctx),
		'</div>',
	]);
}

/**
 * Renders one line of the sub-event legend: colour swatch, link and toll.
 *
 * @param child Sub-event.
 * @param ctx Render context.
 * @param colors Sub-event colours.
 * @returns HTML.
 */
function renderInclude(child: DeathEvent, ctx: RenderContext, colors: Map<string, string>): string {
	const swatch =
		child.deaths.best >= SCALE
			? `<i class="sw" style="--k:${esc(colors.get(child.id) ?? '')}" aria-hidden="true"></i>`
			: '<i class="sw sw-none" aria-hidden="true"></i>';
	const deaths = `${formatInt(child.deaths.best, ctx.locale)} ${ctx.t.deaths}`;

	return join([
		'<li>',
		swatch,
		eventLink(ctx, child),
		` <span class="incl-n">${esc(deaths)}</span>`,
		'</li>',
	]);
}

/**
 * Renders the legend of sub-events shown above a parent's grid.
 *
 * @param view Parent event view.
 * @param ctx Render context.
 * @param colors Sub-event colours.
 * @returns HTML, or an empty string when the event has no sub-events.
 */
export function renderIncludes(
	view: EventView,
	ctx: RenderContext,
	colors: Map<string, string>,
): string {
	if (view.children.length === 0) return '';

	return join([
		'<div class="incl">',
		`<p class="incl-h">${esc(ctx.t.includes)}</p>`,
		'<ul class="incl-l">',
		...view.children.map((child) => renderInclude(child, ctx, colors)),
		'</ul>',
		'</div>',
	]);
}
