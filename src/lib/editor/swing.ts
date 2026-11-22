/**
 * A small swing for things being dragged, as if they hung from the pointer: a damped spring
 * pulls the angle toward a tilt that grows with the pointer's sideways speed, so a quick whip
 * swings the object and it overshoots a little before settling. Visual only.
 */
export const SWING = {
	/** Largest tilt the speed asks for, in degrees. */
	maxDeg: 14,
	/** Tilt per unit of sideways speed (degrees per px/ms). */
	degPerSpeed: 9,
	/** Spring stiffness (1/s²) and damping (1/s): about a 0.45 s swing, lightly damped. */
	stiffness: 180,
	damping: 9,
	/** Time constant for smoothing the pointer's speed, and for it fading once it stops (ms). */
	smoothingMs: 45,
	fadeMs: 90
} as const;

/** `angle` in degrees (positive = clockwise on screen), `spin` in degrees/s, `vx` in px/ms. */
export type SwingState = { angle: number; spin: number; vx: number };
export const REST: SwingState = { angle: 0, spin: 0, vx: 0 };

const clamp = (v: number, lim: number) => Math.min(lim, Math.max(-lim, v));

/** Takes in one pointer step: `dxPx` sideways over `dtMs`. */
export function feed(s: SwingState, dxPx: number, dtMs: number): SwingState {
	if (!(dtMs > 0)) return s;
	const k = 1 - Math.exp(-dtMs / SWING.smoothingMs);
	return { ...s, vx: s.vx + (dxPx / dtMs - s.vx) * k };
}

/** Advances the swing by `dtMs` (long frames are capped and split, so it stays stable). */
export function step(s: SwingState, dtMs: number): SwingState {
	let { angle, spin, vx } = s;
	let left = Math.min(Math.max(dtMs, 0), 100);
	while (left > 0) {
		const ms = Math.min(left, 8);
		const h = ms / 1000;
		vx *= Math.exp(-ms / SWING.fadeMs);
		// Hanging from the pointer, the object trails it: moving right turns it clockwise.
		const target = clamp(vx * SWING.degPerSpeed, SWING.maxDeg);
		spin += (SWING.stiffness * (target - angle) - SWING.damping * spin) * h;
		angle = clamp(angle + spin * h, SWING.maxDeg * 1.25);
		left -= ms;
	}
	return { angle, spin, vx };
}

/** Still enough to stop animating. */
export function atRest(s: SwingState): boolean {
	return Math.abs(s.angle) < 0.05 && Math.abs(s.spin) < 0.5 && Math.abs(s.vx) < 0.002;
}
