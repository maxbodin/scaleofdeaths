/** One dot represents this many deaths. */
export const SCALE = 1000;

export interface DotCounts {
	/** Fully-opaque dots. */
	full: number;
	/** Opacity of the trailing partial dot (0 = none). */
	fraction: number;
	/** Hollow rings for `high - best`. */
	uncertainty: number;
	/** All dot slots in the grid. */
	total: number;
}

export type SegmentKind = 'child' | 'own' | 'fraction' | 'range';

export interface Segment {
	kind: SegmentKind;
	offset: number;
	count: number;
	childId?: string;
	fraction?: number;
}

export interface ChildToll {
	id: string;
	best: number;
}

/**
 * Splits a death toll into dots: full dots, the opacity of the partial last dot, and uncertainty rings. Tolls below one dot get no dot at all.
 *
 * @param best Best estimate.
 * @param high Upper estimate, if any.
 * @returns The dot counts.
 */
export function dotCounts(best: number, high?: number): DotCounts {
	if (best < SCALE) return { full: 0, fraction: 0, uncertainty: 0, total: 0 };

	const full = Math.floor(best / SCALE);
	const fraction = (best % SCALE) / SCALE;
	const uncertainty = high !== undefined && high > best ? Math.round((high - best) / SCALE) : 0;
	const total = full + (fraction > 0 ? 1 : 0) + uncertainty;

	return { full, fraction, uncertainty, total };
}

/**
 * Splits the dots of the sub-events into contiguous runs, in the given order. Sub-events below one dot get no run, and run sizes come from rounded cumulative sums so they never exceed the parent's full dots.
 *
 * @param children Sub-events, in display order.
 * @param fullDots Full dots of the parent.
 * @returns The runs, starting at the first dot.
 */
function childSegments(children: ChildToll[], fullDots: number): Segment[] {
	const segments: Segment[] = [];
	let start = 0;
	let cumulative = 0;

	for (const child of children) {
		if (child.best < SCALE) continue;

		cumulative += child.best;
		const end = Math.min(fullDots, Math.round(cumulative / SCALE));

		if (end > start) {
			segments.push({ kind: 'child', offset: start, count: end - start, childId: child.id });
		}

		start = Math.max(start, end);
	}

	return segments;
}

/**
 * Splits an event's dots into contiguous runs: sub-events, the event's own remainder, the partial dot and the uncertainty rings.
 *
 * @param best Best estimate of the event.
 * @param high Upper estimate, if any.
 * @param children Sub-events, in display order.
 * @returns The runs, in drawing order.
 */
export function buildSegments(
	best: number,
	high: number | undefined,
	children: ChildToll[],
): Segment[] {
	const counts = dotCounts(best, high);
	if (counts.total === 0) return [];

	const segments = childSegments(children, counts.full);
	const shaded = segments.reduce((sum, s) => sum + s.count, 0);

	if (counts.full > shaded) {
		segments.push({ kind: 'own', offset: shaded, count: counts.full - shaded });
	}

	let next = counts.full;

	if (counts.fraction > 0) {
		segments.push({ kind: 'fraction', offset: next, count: 1, fraction: counts.fraction });
		next += 1;
	}

	if (counts.uncertainty > 0) {
		segments.push({ kind: 'range', offset: next, count: counts.uncertainty });
	}

	return segments;
}

/** A milestone label is shown every this many deaths. */
const MILESTONE_STEP = 10_000_000;

export interface Milestone {
	/** Deaths reached at this milestone. */
	deaths: number;
	/** Index of the dot the milestone falls on. */
	dot: number;
}

/**
 * Lists the milestones (every 10 million deaths) inside an event's dots, uncertainty rings included, with the dot each one falls on. Past the best estimate, milestones are counted on the rings, which start after the partial dot.
 *
 * @param best Best estimate of the event.
 * @param high Upper estimate, if any.
 * @returns The milestones, empty when the event has 10 million deaths or fewer.
 */
export function milestones(best: number, high?: number): Milestone[] {
	const counts = dotCounts(best, high);
	const ringStart = counts.full + (counts.fraction > 0 ? 1 : 0);
	const upper = Math.max(best, high ?? best);
	const result: Milestone[] = [];

	for (let deaths = MILESTONE_STEP; deaths < upper; deaths += MILESTONE_STEP) {
		const dot =
			deaths < best ? Math.floor(deaths / SCALE) : ringStart + Math.floor((deaths - best) / SCALE);

		result.push({ deaths, dot: Math.min(dot, counts.total - 1) });
	}

	return result;
}
