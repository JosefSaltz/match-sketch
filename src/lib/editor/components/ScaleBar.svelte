<script lang="ts">
	import { scaleBar } from '#lib/geometry/grid.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor }: { editor: EditorState } = $props();

	const bar = $derived(scaleBar(editor.viewport.scale, editor.plan.unit));
	const x = 16;
	const y = $derived(editor.screen.height - 16);
</script>

<g data-testid="scale-bar" class="scale-bar">
	<rect
		x={x - 6}
		y={y - 24}
		width={Math.max(bar.px, editor.depth ? 150 : 0) + 12}
		height={32}
		rx="4"
	/>
	<line x1={x} x2={x + bar.px} y1={y} y2={y} />
	<line x1={x} x2={x} y1={y - 5} y2={y + 2} />
	<line x1={x + bar.px} x2={x + bar.px} y1={y - 5} y2={y + 2} />
	<text {x} y={y - 9}>{bar.label}{editor.depth ? ' · outside the strip' : ''}</text>
</g>

<style>
	.scale-bar {
		pointer-events: none;
	}
	.scale-bar rect {
		fill: rgb(255 255 255 / 0.85);
		stroke: none;
	}
	.scale-bar line {
		stroke: var(--color-text);
		stroke-width: 2;
	}
	.scale-bar text {
		fill: var(--color-text);
		font-size: 12px;
	}
</style>
