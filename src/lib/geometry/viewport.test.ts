import { describe, it, expect } from 'vitest';
import {
	worldToScreen,
	screenToWorld,
	fitViewport,
	zoomAt,
	zoomLimitsFor,
	ZOOM_LIMITS
} from './viewport';

const vp = { scale: 10, offsetX: 50, offsetY: 400 };

describe('viewport', () => {
	it('maps world feet to screen pixels with downrange drawn upward', () => {
		expect(worldToScreen({ x: 0, y: 0 }, vp)).toEqual({ x: 50, y: 400 });
		expect(worldToScreen({ x: 10, y: 5 }, vp)).toEqual({ x: 150, y: 350 });
		expect(screenToWorld({ x: 150, y: 350 }, vp)).toEqual({ x: 10, y: 5 });
	});

	it('fits the bay centered inside the padding', () => {
		expect(fitViewport({ widthFt: 150, depthFt: 75 }, { width: 1000, height: 600 }, 50)).toEqual({
			scale: 6,
			offsetX: 50,
			offsetY: 525
		});
	});

	it('zooms about a screen point, keeping the world point under it', () => {
		const z = zoomAt(vp, { x: 150, y: 350 }, 2);
		expect(z.scale).toBe(20);
		expect(screenToWorld({ x: 150, y: 350 }, z)).toEqual({ x: 10, y: 5 });
	});

	it('clamps zoom to the limits', () => {
		expect(zoomAt(vp, { x: 0, y: 0 }, 1000).scale).toBe(200);
	});
});

describe('zoomLimitsFor', () => {
	it('lets a tiny bay zoom in past its fit scale', () => {
		expect(zoomLimitsFor(430).max).toBeGreaterThanOrEqual(430 * 4);
	});
	it('keeps the default limits for ordinary bays', () => {
		expect(zoomLimitsFor(5)).toEqual(ZOOM_LIMITS);
	});
	it('lets a huge bay zoom out past its fit scale', () => {
		expect(zoomLimitsFor(0.1).min).toBeLessThanOrEqual(0.1 / 4);
	});
});
