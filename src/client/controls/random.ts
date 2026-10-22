import { byId } from '../dom.ts';
import type { Entry } from '../entries.ts';

/**
 * Wires the "random event" button. It picks among the visible events, so it follows the active filters and search, and never picks the same event twice in a row.
 *
 * @param onJump Called with the id of the picked event.
 * @returns A function that receives the visible events; the button is disabled when there are none.
 */
export function initRandom(onJump: (id: string) => void): (visible: Entry[]) => void {
	const button = byId<HTMLButtonElement>('random-btn');
	let visible: Entry[] = [];
	let last = '';

	button.addEventListener('click', () => {
		const pool = visible.length > 1 ? visible.filter((e) => e.id !== last) : visible;
		const pick = pool[Math.floor(Math.random() * pool.length)];
		if (!pick) return;

		last = pick.id;
		onJump(pick.id);
	});

	return (entries) => {
		visible = entries;
		button.disabled = entries.length === 0;
	};
}
