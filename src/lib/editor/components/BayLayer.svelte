<script lang="ts">
	import { gridSpacing, visibleGridLines } from '#lib/geometry/grid.js';
	import { worldToScreen } from '#lib/geometry/viewport.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor }: { editor: EditorState } = $props();

	const topLeft = $derived(worldToScreen({ x: 0, y: editor.canvas.depthFt }, editor.viewport));
	const w = $derived(editor.canvas.widthFt * editor.viewport.scale);
	const h = $derived(editor.canvas.depthFt * editor.viewport.scale);
	const lines = $derived.by(() => {
		if (!editor.doc.display.showGrid) return { xs: [], ys: [] };
		const spacing = gridSpacing(editor.snapStep() ?? 1, editor.viewport.scale);
		return visibleGridLines(editor.canvas, editor.viewport, editor.screen, spacing);
	});
	const arrowX = $derived(topLeft.x + w / 2);
</script>

<rect data-testid="bay" class="bay" x={topLeft.x} y={topLeft.y} width={w} height={h} />
<g data-testid="grid" class="grid">
	{#each lines.xs as x (x)}
		{@const sx = worldToScreen({ x, y: 0 }, editor.viewport).x}
		<line x1={sx} x2={sx} y1={topLeft.y} y2={topLeft.y + h} />
	{/each}
	{#each lines.ys as y (y)}
		{@const sy = worldToScreen({ x: 0, y }, editor.viewport).y}
		<line x1={topLeft.x} x2={topLeft.x + w} y1={sy} y2={sy} />
	{/each}
</g>
<g class="downrange" aria-label="Downrange">
	<line x1={arrowX} x2={arrowX} y1={topLeft.y - 8} y2={topLeft.y - 30} />
	<path
		d={`M${arrowX - 6} ${topLeft.y - 24} L${arrowX} ${topLeft.y - 34} L${arrowX + 6} ${topLeft.y - 24}`}
	/>
	<text x={arrowX + 10} y={topLeft.y - 20}>Downrange</text>
</g>

<style>
	.bay,
	.grid,
	.downrange {
		pointer-events: none;
	}
	.bay {
		fill: #fff;
		stroke: var(--color-text);
		stroke-width: 1.5;
	}
	.grid line {
		stroke: var(--color-border);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}
	.downrange line,
	.downrange path {
		stroke: var(--color-muted);
		stroke-width: 2;
		fill: none;
	}
	.downrange text {
		fill: var(--color-muted);
		font-size: 12px;
	}
</style>
