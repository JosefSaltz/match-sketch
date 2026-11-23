<svelte:options namespace="svg" />

<script lang="ts">
	import type { Meaning } from '#lib/model/plan.js';
	import { MEANING_STYLES } from './meanings.js';

	/** A meaning's round badge centred on (x, y): SVG attributes only, so it prints to PDF. */
	let { meaning, x, y, r }: { meaning: Meaning; x: number; y: number; r: number } = $props();
	const style = $derived(MEANING_STYLES[meaning]);
	/** The 24-unit glyph fills about 70% of the badge. */
	const k = $derived((r * 1.4) / 24);
</script>

<g data-meaning-badge={meaning}>
	<circle cx={x} cy={y} {r} fill={style.color} stroke="#fff" stroke-width={Math.max(1, r / 6)} />
	<path
		transform="translate({x - 12 * k} {y - 12 * k}) scale({k})"
		d={style.glyph.d}
		fill={style.glyph.filled ? style.ink : 'none'}
		stroke={style.glyph.filled ? 'none' : style.ink}
		stroke-width={style.glyph.filled ? 0 : 2.4}
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</g>
