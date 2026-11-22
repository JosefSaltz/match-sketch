import type { Point } from './types';

export type SnapSetting = 'off' | '1ft' | '1yd' | '5yd';

const STEP_FEET: Record<SnapSetting, number | null> = { off: null, '1ft': 1, '1yd': 3, '5yd': 15 };

export function snapStepFeet(setting: SnapSetting): number | null {
	return STEP_FEET[setting];
}

export function snapValue(value: number, step: number | null): number {
	if (step === null) return value;
	return Math.round(value / step) * step;
}

export function snapPoint(p: Point, step: number | null): Point {
	return { x: snapValue(p.x, step), y: snapValue(p.y, step) };
}
