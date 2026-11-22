import { describe, expect, it } from 'vitest';
import { atRest, feed, REST, step, SWING, type SwingState } from './swing';

/** Runs the swing for `ms` in 16 ms frames. */
function run(s: SwingState, ms: number): SwingState {
	for (let t = 0; t < ms; t += 16) s = step(s, 16);
	return s;
}

describe('drag swing', () => {
	it('swings the trailing way: moving right turns it clockwise (positive)', () => {
		let s = REST;
		for (let i = 0; i < 6; i++) s = step(feed(s, 12, 16), 16);
		expect(s.angle).toBeGreaterThan(1);
	});

	it('and moving left turns it the other way', () => {
		let s = REST;
		for (let i = 0; i < 6; i++) s = step(feed(s, -12, 16), 16);
		expect(s.angle).toBeLessThan(-1);
	});

	it('never tips past the limit, however fast the whip', () => {
		let s = REST;
		let most = 0;
		for (let i = 0; i < 60; i++) {
			s = step(feed(s, 400, 4), 16);
			most = Math.max(most, Math.abs(s.angle));
		}
		expect(most).toBeLessThanOrEqual(SWING.maxDeg * 1.25);
	});

	it('overshoots once the pointer stops, then settles at rest', () => {
		let s = REST;
		for (let i = 0; i < 10; i++) s = step(feed(s, 15, 16), 16);
		let crossed = false;
		for (let t = 0; t < 600; t += 16) {
			s = step(s, 16);
			if (s.angle < -0.2) crossed = true;
		}
		expect(crossed).toBe(true);
		expect(atRest(run(s, 2000))).toBe(true);
	});

	it('stays stable over a long frame (a stalled tab)', () => {
		let s = step(feed(REST, 30, 16), 16);
		s = step(s, 5000);
		expect(Number.isFinite(s.angle)).toBe(true);
		expect(Math.abs(s.angle)).toBeLessThanOrEqual(SWING.maxDeg * 1.25);
	});
});
