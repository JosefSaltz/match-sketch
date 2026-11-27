import { z } from 'zod';

/** Exponential ramps can't reach zero, so silence is this gain. */
const SILENT = 0.0001;

/**
 * How the drag click sounds: an oscillator swept from `startHz` to `endHz` over `sweepMs`, shaped
 * by an attack / hold / decay envelope that peaks at `volume`. Clicks closer together than
 * `minGapMs` are dropped, so a fast drag doesn't buzz.
 */
export const ClickParamsSchema = z.object({
	wave: z.enum(['sine', 'triangle', 'square', 'sawtooth']),
	startHz: z.number().min(50).max(10000),
	endHz: z.number().min(50).max(10000),
	sweepMs: z.number().min(1).max(500),
	attackMs: z.number().min(0).max(200),
	holdMs: z.number().min(0).max(200),
	decayMs: z.number().min(1).max(1000),
	volume: z.number().min(0).max(0.5),
	minGapMs: z.number().min(0).max(500)
});
export type ClickParams = z.infer<typeof ClickParamsSchema>;

/** A short, quiet "tick" like a phone keyboard's. */
export const DEFAULT_CLICK: ClickParams = {
	wave: 'triangle',
	startHz: 2400,
	endHz: 1300,
	sweepMs: 18,
	attackMs: 2,
	holdMs: 0,
	decayMs: 28,
	volume: 0.07,
	minGapMs: 35
};

/** Saved click settings, or the defaults when there are none or they don't parse. */
export function parseClickParams(raw: string | undefined): ClickParams {
	if (!raw) return { ...DEFAULT_CLICK };
	try {
		const parsed = ClickParamsSchema.safeParse({ ...DEFAULT_CLICK, ...JSON.parse(raw) });
		return parsed.success ? parsed.data : { ...DEFAULT_CLICK };
	} catch {
		return { ...DEFAULT_CLICK };
	}
}

/** Seconds from the click's start to the end of each envelope stage. */
export function clickTimeline(p: ClickParams) {
	const peak = p.attackMs / 1000;
	const release = peak + p.holdMs / 1000;
	const end = release + p.decayMs / 1000;
	return { peak, release, end, sweepEnd: Math.min(p.sweepMs / 1000, end) };
}

let ctx: AudioContext | null = null;
let last = -Infinity;

/** Plays one click. Synthesized, so it needs no files and works offline. */
export function playClick(p: ClickParams = DEFAULT_CLICK): void {
	if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return;
	const nowMs = performance.now();
	if (nowMs - last < p.minGapMs) return;
	last = nowMs;
	ctx ??= new AudioContext();
	if (ctx.state === 'suspended') void ctx.resume();
	const t = ctx.currentTime;
	const { peak, release, end, sweepEnd } = clickTimeline(p);
	const level = Math.max(p.volume, SILENT);
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = p.wave;
	osc.frequency.setValueAtTime(p.startHz, t);
	osc.frequency.exponentialRampToValueAtTime(p.endHz, t + Math.max(sweepEnd, 0.001));
	gain.gain.setValueAtTime(peak > 0 ? SILENT : level, t);
	if (peak > 0) gain.gain.exponentialRampToValueAtTime(level, t + peak);
	gain.gain.setValueAtTime(level, t + release);
	gain.gain.exponentialRampToValueAtTime(SILENT, t + end);
	osc.connect(gain).connect(ctx.destination);
	osc.start(t);
	osc.stop(t + end + 0.005);
}
