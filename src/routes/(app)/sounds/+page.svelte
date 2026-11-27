<script lang="ts">
	import { resolve } from '$app/paths';
	import { clickTimeline, DEFAULT_CLICK, playClick, type ClickParams } from '#lib/audio/click.js';
	import { sounds } from '#lib/audio/sounds.svelte.js';
	import { getDb } from '#lib/store/index.js';
	import { CLICK_SOUND_SETTING, setSetting } from '#lib/store/settings.js';
	import Button from '#lib/ui/Button.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import Wordmark from '#lib/ui/Wordmark.svelte';

	/**
	 * Tunes the editor's drag click on this device: every change saves and the editor plays it
	 * straight away. Not linked from menus.
	 */
	type NumberKey = Exclude<keyof ClickParams, 'wave'>;
	type Slider = {
		key: NumberKey;
		label: string;
		min: number;
		max: number;
		unit: string;
		log?: boolean;
	};

	const PITCH: Slider[] = [
		{ key: 'startHz', label: 'Start pitch', min: 100, max: 8000, unit: 'Hz', log: true },
		{ key: 'endHz', label: 'End pitch', min: 100, max: 8000, unit: 'Hz', log: true },
		{ key: 'sweepMs', label: 'Sweep time', min: 1, max: 200, unit: 'ms' }
	];
	const ENVELOPE: Slider[] = [
		{ key: 'attackMs', label: 'Attack', min: 0, max: 50, unit: 'ms' },
		{ key: 'holdMs', label: 'Hold', min: 0, max: 100, unit: 'ms' },
		{ key: 'decayMs', label: 'Decay', min: 1, max: 300, unit: 'ms' },
		{ key: 'volume', label: 'Volume', min: 0, max: 0.3, unit: '' }
	];
	const SPACING: Slider[] = [
		{ key: 'minGapMs', label: 'Shortest gap between clicks', min: 0, max: 200, unit: 'ms' }
	];
	const GROUPS = [
		{ id: 'pitch', title: 'Pitch', sliders: PITCH },
		{ id: 'envelope', title: 'Envelope', sliders: ENVELOPE },
		{ id: 'spacing', title: 'Spacing', sliders: SPACING }
	];
	const WAVES: ClickParams['wave'][] = ['sine', 'triangle', 'square', 'sawtooth'];
	/** Slider resolution for log-scaled controls. */
	const LOG_STEPS = 1000;

	let copied = $state(false);

	function toSlider(s: Slider, value: number): number {
		if (!s.log) return value;
		return Math.round((Math.log(value / s.min) / Math.log(s.max / s.min)) * LOG_STEPS);
	}
	function fromSlider(s: Slider, pos: number): number {
		if (!s.log) return pos;
		return Math.round(s.min * (s.max / s.min) ** (pos / LOG_STEPS));
	}
	function step(s: Slider): number {
		if (s.log) return 1;
		return s.max <= 1 ? 0.005 : 1;
	}
	function show(s: Slider, value: number): string {
		const text = s.max <= 1 ? value.toFixed(3) : String(Math.round(value));
		return s.unit ? `${text} ${s.unit}` : text;
	}

	function save() {
		setSetting(getDb(), CLICK_SOUND_SETTING, JSON.stringify(sounds.click)).catch(console.error);
	}
	function set<K extends keyof ClickParams>(key: K, value: ClickParams[K]) {
		sounds.click[key] = value;
		save();
	}
	function reset() {
		sounds.click = { ...DEFAULT_CLICK };
		save();
		playClick(sounds.click);
	}
	async function copy() {
		await navigator.clipboard.writeText(JSON.stringify(sounds.click, null, '\t'));
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	// The graph: volume (filled) and pitch (line) over the click's length.
	const GRAPH = { w: 480, h: 160, pad: 8 };
	const graph = $derived.by(() => {
		const p = sounds.click;
		const t = clickTimeline(p);
		const span = Math.max(t.end, t.sweepEnd, 0.001);
		const x = (s: number) => GRAPH.pad + (s / span) * (GRAPH.w - 2 * GRAPH.pad);
		const vy = (v: number) => GRAPH.h - GRAPH.pad - (v / 0.3) * (GRAPH.h - 2 * GRAPH.pad);
		const fy = (hz: number) =>
			GRAPH.h - GRAPH.pad - (Math.log(hz / 100) / Math.log(80)) * (GRAPH.h - 2 * GRAPH.pad);
		const base = vy(0);
		const volume = [
			`M ${x(0)} ${base}`,
			`L ${x(t.peak)} ${vy(p.volume)}`,
			`L ${x(t.release)} ${vy(p.volume)}`,
			`L ${x(t.end)} ${base}`,
			'Z'
		].join(' ');
		const pitch = `M ${x(0)} ${fy(p.startHz)} L ${x(t.sweepEnd)} ${fy(p.endHz)} L ${x(t.end)} ${fy(p.endHz)}`;
		return { volume, pitch, ms: Math.round(span * 1000) };
	});

	// The pad clicks each time the pointer crosses a grid line, like a drag in the editor.
	const CELL_PX = 24;
	const GRID_LINES =
		'linear-gradient(to right, rgb(0 0 0 / 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.15) 1px, transparent 1px)';
	let cell: string | null = null;
	function padMove(e: PointerEvent) {
		if (e.buttons === 0 && e.pointerType === 'mouse') {
			cell = null;
			return;
		}
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const next = `${Math.floor((e.clientX - r.left) / CELL_PX)},${Math.floor((e.clientY - r.top) / CELL_PX)}`;
		if (cell !== null && next !== cell) playClick(sounds.click);
		cell = next;
	}
	function padDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		cell = null;
		padMove(e);
	}
</script>

<svelte:head>
	<title>Drag sound · Match Sketch</title>
</svelte:head>

<div class="min-h-full bg-surface">
	<header class="bg-theme border-b-[3px] border-black">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
			<a href={resolve('')} class="focus-ring mr-auto inline-flex min-h-11 items-center rounded-lg">
				<Wordmark />
			</a>
		</div>
	</header>
	<main class="mx-auto grid max-w-6xl gap-6 px-4 py-8">
		<div class="flex flex-wrap items-center gap-3">
			<h1 class="m-0 mr-auto font-display text-2xl tracking-wide uppercase">Drag sound</h1>
			<Button variant="primary" onclick={() => playClick(sounds.click)}>Play</Button>
			<Button onclick={reset}>Reset</Button>
			<Button onclick={copy}>{copied ? 'Copied' : 'Copy values'}</Button>
		</div>
		{#if !sounds.on}
			<p class="m-0 rounded-lg border-2 border-black bg-white p-3 text-text">
				Drag clicks are off in the editor on this device. This page still plays them.
			</p>
		{/if}

		<div class="grid gap-6 lg:grid-cols-2">
			<div class="grid content-start gap-6">
				{#each GROUPS as g (g.id)}
					<section
						aria-labelledby="snd-{g.id}"
						class="grid gap-4 rounded-xl border-2 border-black bg-white p-4 text-text"
					>
						<h2 id="snd-{g.id}" class="m-0 font-display text-xl tracking-wide uppercase">
							{g.title}
						</h2>
						{#if g.id === 'pitch'}
							<div class="grid gap-1">
								<label for="snd-wave" class="text-sm text-muted">Waveform</label>
								<select
									id="snd-wave"
									class={controlClass}
									value={sounds.click.wave}
									onchange={(e) => {
										set('wave', e.currentTarget.value as ClickParams['wave']);
										playClick(sounds.click);
									}}
								>
									{#each WAVES as w (w)}
										<option value={w}>{w}</option>
									{/each}
								</select>
							</div>
						{/if}
						{#each g.sliders as s (s.key)}
							<div class="grid gap-1">
								<div class="flex items-baseline justify-between gap-2">
									<label for="snd-{s.key}" class="text-sm text-muted">{s.label}</label>
									<output for="snd-{s.key}" class="font-mono text-sm tabular-nums">
										{show(s, sounds.click[s.key])}
									</output>
								</div>
								<input
									id="snd-{s.key}"
									type="range"
									class="focus-ring min-h-11 w-full accent-black"
									min={s.log ? 0 : s.min}
									max={s.log ? LOG_STEPS : s.max}
									step={step(s)}
									value={toSlider(s, sounds.click[s.key])}
									oninput={(e) => set(s.key, fromSlider(s, e.currentTarget.valueAsNumber))}
									onchange={() => playClick(sounds.click)}
								/>
							</div>
						{/each}
					</section>
				{/each}
			</div>

			<div class="grid content-start gap-6">
				<section
					aria-labelledby="snd-shape"
					class="grid gap-3 rounded-xl border-2 border-black bg-white p-4 text-text"
				>
					<h2 id="snd-shape" class="m-0 font-display text-xl tracking-wide uppercase">Shape</h2>
					<svg
						viewBox="0 0 {GRAPH.w} {GRAPH.h}"
						class="w-full rounded-lg border-2 border-black bg-surface"
						role="img"
						aria-label="Volume and pitch over {graph.ms} ms"
					>
						<path
							d={graph.volume}
							fill="currentColor"
							fill-opacity="0.2"
							stroke="currentColor"
							stroke-width="2"
						/>
						<path
							d={graph.pitch}
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-dasharray="6 4"
						/>
					</svg>
					<p class="m-0 text-sm text-muted">
						Filled: volume. Dashed: pitch (100 Hz to 8 kHz, log). {graph.ms} ms long.
					</p>
				</section>

				<section
					aria-labelledby="snd-pad"
					class="grid gap-3 rounded-xl border-2 border-black bg-white p-4 text-text"
				>
					<h2 id="snd-pad" class="m-0 font-display text-xl tracking-wide uppercase">Try a drag</h2>
					<div
						role="presentation"
						class="h-64 touch-none rounded-lg border-2 border-black bg-surface"
						style:background-image={GRID_LINES}
						style:background-size="{CELL_PX}px {CELL_PX}px"
						onpointerdown={padDown}
						onpointermove={padMove}
						onpointerup={() => (cell = null)}
					></div>
					<p class="m-0 text-sm text-muted">
						Press and drag: it clicks at each grid line, as a drag in the editor does.
					</p>
				</section>
			</div>
		</div>
	</main>
</div>
