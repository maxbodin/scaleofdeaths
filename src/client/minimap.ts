import { formatInt } from '../shared/format.ts';
import { byId, el, scrollToY } from './dom.ts';
import type { Box, Layout } from './layout.ts';

/**
 * Formats a ratio as a CSS percentage.
 *
 * @param value Ratio between 0 and 1.
 * @returns For example `12.5000%`.
 */
const pct = (value: number) => `${(value * 100).toFixed(4)}%`;

/**
 * Keeps a ratio between 0 and 1.
 *
 * @param value Ratio to clamp.
 * @returns The clamped ratio.
 */
const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Creates the mini-map segment of one entry, sized in proportion to its height.
 *
 * @param box Measured entry.
 * @param layout Current layout.
 * @param locale Page language, used in the tooltip.
 * @returns The segment element.
 */
function createSegment(box: Box, layout: Layout, locale: string): HTMLElement {
	const segment = el('li', { title: `${box.entry.title} - ${formatInt(box.entry.best, locale)}` });

	segment.style.top = pct((box.top - layout.listTop) / layout.listHeight);
	segment.style.height = pct(box.height / layout.listHeight);
	segment.style.setProperty('--c', box.entry.el.style.getPropertyValue('--c'));

	return segment;
}

/**
 * Draws the mini-map rail: one segment per visible entry. The rail is a pointer shortcut; the
 * jump select is its accessible equivalent.
 *
 * @param layout Current layout.
 * @param locale Page language, used in the tooltips.
 */
export function renderMinimap(layout: Layout, locale: string): void {
	const segments = layout.boxes.map((box) => createSegment(box, layout, locale));

	byId('minimap-list').replaceChildren(...segments);
}

/**
 * Moves the viewport indicator of the mini-map to match the scroll position.
 *
 * @param layout Current layout.
 */
export function updateMinimapView(layout: Layout): void {
	const view = byId('mm-view');
	const listHeight = layout.listHeight || 1;
	const top = (window.scrollY + layout.bar - layout.listTop) / listHeight;
	const height = (window.innerHeight - layout.bar) / listHeight;

	view.style.top = pct(clamp(top));
	view.style.height = pct(Math.min(1, height));
}

/**
 * Lets a click or drag on the rail scroll to the matching position in the list.
 *
 * @param current Returns the current layout.
 */
export function initMinimapScrub(current: () => Layout | null): void {
	const rail = byId('mm-in');

	/**
	 * Scrolls to the list position that matches a point on the rail.
	 *
	 * @param clientY Pointer position in viewport pixels.
	 */
	const go = (clientY: number) => {
		const layout = current();
		if (!layout) return;

		const rect = rail.getBoundingClientRect();
		const ratio = clamp((clientY - rect.top) / rect.height);

		scrollToY(layout.listTop + ratio * layout.listHeight - layout.bar);
	};

	rail.addEventListener('pointerdown', (e) => {
		rail.setPointerCapture(e.pointerId);
		go(e.clientY);
	});

	rail.addEventListener('pointermove', (e) => {
		if (rail.hasPointerCapture(e.pointerId)) go(e.clientY);
	});
}
