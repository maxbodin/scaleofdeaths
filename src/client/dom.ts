/**
 * Finds an element by id.
 *
 * @param id Element id.
 * @returns The element.
 * @throws {Error} If no element has this id.
 */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
	const el = document.getElementById(id);
	if (!el) throw new Error(`#${id} missing`);

	return el as T;
}

/**
 * Measures the sticky control bar.
 *
 * @returns Its height in pixels, or 0 when it is hidden.
 */
export function barHeight(): number {
	return document.querySelector('.bar')?.getBoundingClientRect().height ?? 0;
}

/**
 * Scrolls the window instantly, ignoring smooth scrolling.
 *
 * @param top Target scroll position in pixels.
 */
export function scrollToY(top: number): void {
	window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
}

/**
 * Creates an element and assigns properties to it.
 *
 * @param tag Tag name.
 * @param props Properties to assign.
 * @returns The new element.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	props: Partial<HTMLElementTagNameMap[K]> = {},
) {
	return Object.assign(document.createElement(tag), props);
}
