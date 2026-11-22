/** Clicks closer together than this are dropped, so a fast drag doesn't buzz. */
const MIN_GAP_MS = 35;

let ctx: AudioContext | null = null;
let last = -Infinity;

/**
 * A short, quiet "tick" like a phone keyboard's: a triangle tone falling from 2.4 to 1.3 kHz over
 * 18 ms with a 2 ms attack and a 30 ms fade. Synthesized, so it needs no files and works offline.
 */
export function playClick(): void {
	if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return;
	const nowMs = performance.now();
	if (nowMs - last < MIN_GAP_MS) return;
	last = nowMs;
	ctx ??= new AudioContext();
	if (ctx.state === 'suspended') void ctx.resume();
	const t = ctx.currentTime;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'triangle';
	osc.frequency.setValueAtTime(2400, t);
	osc.frequency.exponentialRampToValueAtTime(1300, t + 0.018);
	gain.gain.setValueAtTime(0.0001, t);
	gain.gain.exponentialRampToValueAtTime(0.07, t + 0.002);
	gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
	osc.connect(gain).connect(ctx.destination);
	osc.start(t);
	osc.stop(t + 0.035);
}
