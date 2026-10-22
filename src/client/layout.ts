import { barHeight } from './dom.ts';
import type { Entry } from './entries.ts';

export interface Box {
	entry: Entry;
	top: number;
	height: number;
}

export interface Layout {
	listTop: number;
	listHeight: number;
	boxes: Box[];
	bar: number;
}

export interface Anchor {
	id: string;
	ratio: number;
}

/**
 * Measures the document position of every visible entry.
 *
 * @param list The list element.
 * @param visible Visible entries, in display order.
 * @returns The layout.
 */
export function measure(list: HTMLElement, visible: Entry[]): Layout {
	const scrollY = window.scrollY;
	const listRect = list.getBoundingClientRect();

	const boxes = visible.map((entry) => {
		const rect = entry.el.getBoundingClientRect();

		return { entry, top: rect.top + scrollY, height: rect.height };
	});

	return { listTop: listRect.top + scrollY, listHeight: listRect.height, boxes, bar: barHeight() };
}

/**
 * Finds the entry at a document position and how far into it the position is.
 *
 * @param layout Current layout.
 * @param y Document position in pixels.
 * @returns The anchor, or `null` outside the list.
 */
export function anchorAt(layout: Layout, y: number): Anchor | null {
	const box = layout.boxes.find((b) => b.top + b.height > y);
	if (!box || box.top > y) return null;

	return { id: box.entry.id, ratio: (y - box.top) / box.height };
}

/**
 * Computes the scroll position that brings an anchor back under the sticky bar.
 *
 * @param layout Layout after the change.
 * @param anchor Anchor saved before the change.
 * @returns The scroll position, or `null` if the entry is no longer visible.
 */
export function anchorTarget(layout: Layout, anchor: Anchor): number | null {
	const box = layout.boxes.find((b) => b.entry.id === anchor.id);
	if (!box) return null;

	return box.top + anchor.ratio * box.height - layout.bar;
}
