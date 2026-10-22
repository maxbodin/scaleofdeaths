/**
 * Folds text for searching: lowercase, without accents, every run of punctuation or spaces turned into one space, with a space at both ends so terms can be matched at word starts.
 *
 * @param text Text to fold.
 * @returns The folded text, for example ` l hotel dieu 1832 `.
 */
export function foldText(text: string): string {
	const words = text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();

	return ` ${words} `;
}

/**
 * Splits a search query into folded terms.
 *
 * @param query Query as typed.
 * @returns The terms, without empty ones.
 */
export function queryTerms(query: string): string[] {
	return foldText(query).split(' ').filter(Boolean);
}

/**
 * Tells whether a folded text contains every term of a query at the start of a word, so "chol" finds "cholera" but not "scholar". An empty query matches everything.
 *
 * @param folded Text already folded with `foldText`.
 * @param query Query as typed.
 * @returns `true` if every term is found.
 */
export function matchesQuery(folded: string, query: string): boolean {
	return queryTerms(query).every((term) => folded.includes(` ${term}`));
}

/**
 * Folds one character like `foldText`, turning punctuation and spaces into a space.
 *
 * @param ch One character (code point).
 * @returns The folded character(s); empty for a lone combining accent.
 */
function foldChar(ch: string): string {
	const folded = ch
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();

	if (folded === '') return '';

	return /^[\p{L}\p{N}]+$/u.test(folded) ? folded : ' ';
}

/**
 * Folds a text character by character, remembering which original characters each folded one comes from.
 *
 * @param text Original text.
 * @returns The folded text and, for each of its characters, the start and end of the original character.
 */
function foldWithOrigins(text: string): { folded: string; starts: number[]; ends: number[] } {
	let folded = '';
	const starts: number[] = [];
	const ends: number[] = [];
	let index = 0;

	for (const ch of text) {
		const f = foldChar(ch);

		for (let k = 0; k < f.length; k++) {
			starts.push(index);
			ends.push(index + ch.length);
		}

		folded += f;
		index += ch.length;
	}

	return { folded, starts, ends };
}

/**
 * Sorts ranges and merges the ones that overlap or touch.
 *
 * @param ranges `[start, end)` ranges.
 * @returns Disjoint ranges, in text order.
 */
function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
	const merged: Array<[number, number]> = [];

	for (const range of [...ranges].sort((a, b) => a[0] - b[0])) {
		const last = merged.at(-1);

		if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
		else merged.push([...range]);
	}

	return merged;
}

/**
 * Finds where the terms of a query appear at the start of a word in a text, with the same folding as the search.
 *
 * @param text Original text.
 * @param query Query as typed.
 * @returns Disjoint `[start, end)` ranges in the original text, in text order.
 */
export function findMatches(text: string, query: string): Array<[number, number]> {
	const terms = queryTerms(query);
	if (terms.length === 0 || text === '') return [];

	const { folded, starts, ends } = foldWithOrigins(text);
	const ranges: Array<[number, number]> = [];

	for (const term of terms) {
		for (let at = folded.indexOf(term); at !== -1; at = folded.indexOf(term, at + 1)) {
			if (at > 0 && folded[at - 1] !== ' ') continue;

			ranges.push([starts[at] as number, ends[at + term.length - 1] as number]);
		}
	}

	return mergeRanges(ranges);
}
