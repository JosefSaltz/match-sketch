<svelte:options namespace="svg" />

<script lang="ts">
	import { footprintShapes, type FootprintStyle } from '#lib/catalog/footprint-shapes.js';

	/** A footprint drawn to its box (px), centered on the origin; line widths stay fixed in px. */
	let { style, width, height }: { style: FootprintStyle; width: number; height: number } = $props();

	const shapes = $derived(footprintShapes(style, width, height));
	/**
	 * A clear hit area over the whole box, at least this thick, so footprints drawn as lines
	 * (a door, a low barrier, a wall's port) can be clicked anywhere inside them.
	 */
	const HIT_MIN_PX = 12;
	const pad = $derived({ w: Math.max(width, HIT_MIN_PX), h: Math.max(height, HIT_MIN_PX) });
</script>

<rect class="pad" x={-pad.w / 2} y={-pad.h / 2} width={pad.w} height={pad.h} />
{#each shapes as s, i (i)}
	<svelte:element this={s.el} {...s.attrs} class={['fp', s.paint]} />
{/each}

<style>
	.pad {
		fill: transparent;
		stroke: none;
	}
	.fp {
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.fill {
		fill: currentColor;
		fill-opacity: 0.75;
		stroke-width: 1.5;
	}
	.tint {
		fill: #e9ecef;
		stroke-width: 2;
	}
	.hit {
		/* Transparent, not none, so the inside of a box can be clicked to select it. */
		fill: transparent;
		stroke-width: 2;
	}
	.ink {
		fill: none;
		stroke-width: 2;
	}
	.detail {
		fill: none;
		stroke-width: 1.25;
	}
</style>
