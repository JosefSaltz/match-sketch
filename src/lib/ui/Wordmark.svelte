<script lang="ts">
	/**
	 * The varsity wordmark: Graduate, a thick round-joined black outline, white letters thickened
	 * by a thin white stroke, and an offset block shadow. Drawn as SVG because thick outlines on
	 * HTML text grow spikes at sharp corners. `compact` is the same mark at two-thirds size.
	 */
	let { size = 'full' }: { size?: 'full' | 'compact' } = $props();

	const WIDTH = 288;
	const HEIGHT = 45;
	const scale = $derived(size === 'full' ? 1 : 2 / 3);
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

<style>
	.wordmark {
		display: inline-block;
		overflow: visible;
	}
</style>
