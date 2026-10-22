import { findMatches } from '../shared/search.ts';
import { type Entry, SEARCHABLE } from './entries.ts';

/** Name of the CSS highlight, styled with `::highlight(search)`. */
const NAME = 'search';

/** Most highlighted ranges, so a one-letter query cannot slow the page down. */
const MAX_RANGES = 5000;

/**
 * Adds a range for every match of the query in the text nodes under an element.
 *
 * @param root Element to scan.
 * @param query Query as typed.
 * @param ranges Ranges found so far; new ones are appended.
 */
function collectRanges(root: Element, query: string, ranges: Range[]): void {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

	for (let node = walker.nextNode(); node && ranges.length < MAX_RANGES; node = walker.nextNode()) {
		for (const [start, end] of findMatches(node.textContent ?? '', query)) {
			const range = new Range();
			range.setStart(node, start);
			range.setEnd(node, end);
			ranges.push(range);
		}
	}
}

/**
 * Highlights the words matching the search in the visible events: titles, periods, tags, descriptions, notes, countries and sources. Uses the CSS Custom Highlight API, so the DOM is not changed; browsers without it show no highlight.
 *
 * @param visible Visible entries.
 * @param query Active search query; empty removes the highlight.
 */
export function highlightMatches(visible: Entry[], query: string): void {
	if (typeof Highlight === 'undefined' || !CSS.highlights) return;

	CSS.highlights.delete(NAME);
	if (!query.trim()) return;

	const ranges: Range[] = [];

	for (const e of visible) {
		for (const part of e.el.querySelectorAll(SEARCHABLE)) collectRanges(part, query, ranges);
		if (ranges.length >= MAX_RANGES) break;
	}

	CSS.highlights.set(NAME, new Highlight(...ranges));
}
