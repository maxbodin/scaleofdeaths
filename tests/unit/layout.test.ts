import { describe, expect, it } from 'vitest';
import { buildSegments, dotCounts, milestones } from '../../src/shared/layout.ts';

describe('dotCounts', () => {
	it.each([
		[1000, 1, 0],
		[1001, 1, 0.001],
		[1999, 1, 0.999],
		[2000, 2, 0],
		[75_000_000, 75_000, 0],
	])('best=%i → %i full dots, fraction %f', (best, full, fraction) => {
		const c = dotCounts(best);
		expect(c.full).toBe(full);
		expect(c.fraction).toBeCloseTo(fraction, 6);
		expect(c.total).toBe(full + (fraction > 0 ? 1 : 0));
	});

	it('draws nothing below 1,000 deaths, even with a high estimate', () => {
		expect(dotCounts(999, 5000)).toEqual({ full: 0, fraction: 0, uncertainty: 0, total: 0 });
	});

	it('adds rounded uncertainty rings for high - best', () => {
		const c = dotCounts(140_000, 166_000);
		expect(c.uncertainty).toBe(26);
		expect(c.total).toBe(166);
	});
});

describe('buildSegments', () => {
	it('places children first, contiguously, then own dots, fraction and rings', () => {
		const segs = buildSegments(5_000_500, 6_000_000, [
			{ id: 'a', best: 1_200_000 },
			{ id: 'b', best: 800_000 },
			{ id: 'tiny', best: 500 },
		]);
		expect(segs).toEqual([
			{ kind: 'child', offset: 0, count: 1200, childId: 'a' },
			{ kind: 'child', offset: 1200, count: 800, childId: 'b' },
			{ kind: 'own', offset: 2000, count: 3000 },
			{ kind: 'fraction', offset: 5000, count: 1, fraction: 0.5 },
			{ kind: 'range', offset: 5001, count: 1000 },
		]);
	});

	it('uses cumulative rounding so shaded dots equal round(Σ children / 1000)', () => {
		const segs = buildSegments(10_000, undefined, [
			{ id: 'a', best: 1_400 },
			{ id: 'b', best: 1_400 },
			{ id: 'c', best: 1_400 },
		]);
		const shaded = segs.filter((s) => s.kind === 'child').reduce((n, s) => n + s.count, 0);
		expect(shaded).toBe(Math.round(4_200 / 1000));
		expect(segs.map((s) => s.count)).toEqual([1, 2, 1, 6]);
	});

	it('never shades more dots than the parent has', () => {
		const segs = buildSegments(2_999, undefined, [{ id: 'a', best: 2_999 }]);
		expect(segs[0]).toEqual({ kind: 'child', offset: 0, count: 2, childId: 'a' });
		expect(segs.some((s) => s.kind === 'own')).toBe(false);
	});

	it('returns no segment for events below one dot', () => {
		expect(buildSegments(750, undefined, [])).toEqual([]);
	});
});

describe('milestones', () => {
	it('marks every 10 million deaths with the dot it falls on', () => {
		expect(milestones(30_000_000)).toEqual([
			{ deaths: 10_000_000, dot: 10_000 },
			{ deaths: 20_000_000, dot: 20_000 },
		]);
	});

	it('has no milestone up to 10 million deaths', () => {
		expect(milestones(10_000_000)).toEqual([]);
		expect(milestones(5_000_000, 9_000_000)).toEqual([]);
	});

	it('continues on the uncertainty rings up to the upper estimate', () => {
		const list = milestones(50_000_000, 100_000_000);

		expect(list.map((m) => m.deaths / 1_000_000)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
		expect(list[4]).toEqual({ deaths: 50_000_000, dot: 50_000 });
	});

	it('skips the partial dot when counting on the rings', () => {
		const [first] = milestones(9_500_500, 12_000_000);

		expect(first).toEqual({ deaths: 10_000_000, dot: 9_500 + 1 + 499 });
	});
});
