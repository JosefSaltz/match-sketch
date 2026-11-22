import { describe, it, expect } from 'vitest';
import { snapStepFeet, snapPoint, snapValue } from './snap';

describe('snap', () => {
	it('maps snap settings to steps in feet', () => {
		expect(snapStepFeet('off')).toBeNull();
		expect(snapStepFeet('1ft')).toBe(1);
		expect(snapStepFeet('1yd')).toBe(3);
		expect(snapStepFeet('5yd')).toBe(15);
	});

	it('snaps points to the nearest step', () => {
		expect(snapPoint({ x: 4.4, y: 7.6 }, 3)).toEqual({ x: 3, y: 9 });
		expect(snapValue(4.4, 3)).toBe(3);
	});

	it('leaves points alone when snapping is off', () => {
		expect(snapPoint({ x: 4.4, y: 7.6 }, null)).toEqual({ x: 4.4, y: 7.6 });
	});
});
