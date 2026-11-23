import { describe, expect, it } from 'vitest';
import { clickTimeline, DEFAULT_CLICK, parseClickParams } from './click';

describe('parseClickParams', () => {
	it('falls back to the defaults when nothing is saved', () => {
		expect(parseClickParams(undefined)).toEqual(DEFAULT_CLICK);
	});

	it('keeps saved values and fills in ones added since', () => {
		const saved = JSON.stringify({ startHz: 800, decayMs: 60 });
		expect(parseClickParams(saved)).toEqual({ ...DEFAULT_CLICK, startHz: 800, decayMs: 60 });
	});

	it('falls back to the defaults on bad JSON or out-of-range values', () => {
		expect(parseClickParams('{oops')).toEqual(DEFAULT_CLICK);
		expect(parseClickParams(JSON.stringify({ volume: 3 }))).toEqual(DEFAULT_CLICK);
		expect(parseClickParams(JSON.stringify({ wave: 'noise' }))).toEqual(DEFAULT_CLICK);
	});
});

describe('clickTimeline', () => {
	it('runs attack, hold, then decay', () => {
		const t = clickTimeline({ ...DEFAULT_CLICK, attackMs: 5, holdMs: 10, decayMs: 40 });
		expect(t.peak).toBeCloseTo(0.005);
		expect(t.release).toBeCloseTo(0.015);
		expect(t.end).toBeCloseTo(0.055);
	});

	it('stops the pitch sweep when the sound ends', () => {
		const t = clickTimeline({
			...DEFAULT_CLICK,
			sweepMs: 400,
			attackMs: 0,
			holdMs: 0,
			decayMs: 50
		});
		expect(t.sweepEnd).toBeCloseTo(0.05);
	});
});
