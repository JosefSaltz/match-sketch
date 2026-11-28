<script lang="ts">
	/**
	 * The varsity wordmark: Graduate, a thick round-joined black outline, white letters thickened
	 * by a thin white stroke, and an offset block shadow. Drawn as SVG because thick outlines on
	 * HTML text grow spikes at sharp corners. `compact` is the same mark at two-thirds size.
	 *
	 * Easter egg: under the Fudd Orange theme the Fudd rides along beside the mark.
	 */
	import { currentTheme } from '#lib/theme/current.svelte.js';

	let { size = 'full' }: { size?: 'full' | 'compact' } = $props();

	const WIDTH = 288;
	const HEIGHT = 45;
	const scale = $derived(size === 'full' ? 1 : 2 / 3);
	const fudd = $derived(currentTheme.id === 'blaze');
	// The lettering (with its shadow) ends near x = 258; the badge tucks in over the last letter.
	const TEXT_END = 258;
</script>

{#snippet word(color: string, strokeWidth: number, offset: number)}
	<text
		x={6.5 + offset}
		y={34 + offset}
		font-family="Graduate, serif"
		font-size="30"
		letter-spacing="1.2"
		stroke-linejoin="round"
		fill={color}
		stroke={color}
		stroke-width={strokeWidth}
	>
		MATCH SKETCH
	</text>
{/snippet}

<svg
	class="wordmark"
	role="img"
	aria-label="Match Sketch"
	viewBox="0 0 {WIDTH} {HEIGHT}"
	width={WIDTH * scale}
	height={HEIGHT * scale}
>
	{@render word('#000', 9, 5)}
	{@render word('#000', 9, 0)}
	{@render word('#fff', 1.6, 0)}
</svg>
{#if fudd}
	<img
		class="fudd"
		src="/easter-eggs/fudd.webp"
		alt=""
		width={HEIGHT * scale}
		height={HEIGHT * scale}
		style:margin-left="{(TEXT_END - WIDTH) * scale}px"
		data-testid="fudd"
	/>
{/if}

<style>
	.wordmark {
		display: inline-block;
		overflow: visible;
	}

	.fudd {
		position: relative;
		display: inline-block;
		vertical-align: middle;
		border: 3px solid #000;
		border-radius: 9999px;
		background: #fff;
		box-shadow: 3px 3px 0 #000;
		rotate: -8deg;
	}

	@media (prefers-reduced-motion: no-preference) {
		.fudd {
			transition: rotate 150ms ease-out;
		}

		.fudd:hover {
			rotate: 8deg;
		}
	}
</style>
