import { byId } from '../dom.ts';

export interface Panels {
	/**
	 * Shows how many filter types are active.
	 *
	 * @param n Number of active filter types. 0 hides the badge.
	 */
	setBadge: (n: number) => void;

	/**
	 * Closes the filters panel.
	 */
	close: () => void;
}

/**
 * Wires the filters panel. Its button toggles it; Escape, outside clicks and the close button close it.
 *
 * @returns Controls for the badge and for closing the panel.
 */
export function initPanels(): Panels {
	const panel = byId('panel');
	const button = byId('filters-btn');
	const badge = byId('filters-count');

	/**
	 * Shows or hides the panel and updates `aria-expanded`.
	 *
	 * @param open Whether to show it.
	 */
	const setOpen = (open: boolean) => {
		panel.hidden = !open;
		button.setAttribute('aria-expanded', String(open));
	};

	/**
	 * Closes the panel and gives the focus back to its button.
	 */
	const closeAndFocus = () => {
		setOpen(false);
		button.focus();
	};

	button.addEventListener('click', () => setOpen(!!panel.hidden));
	byId('panel-close').addEventListener('click', closeAndFocus);

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !panel.hidden) closeAndFocus();
	});

	document.addEventListener('click', (e) => {
		if (!panel.hidden && !(e.target as Element).closest('.bar')) setOpen(false);
	});

	return {
		/**
		 * Shows how many filter types are active.
		 *
		 * @param n Number of active filter types. 0 hides the badge.
		 */
		setBadge: (n) => {
			badge.hidden = n === 0;
			badge.textContent = String(n);
		},

		/**
		 * Closes the filters panel.
		 */
		close: () => setOpen(false),
	};
}
