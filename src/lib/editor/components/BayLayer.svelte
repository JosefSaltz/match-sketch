<script lang="ts">
	import { gridSpacing, visibleGridLines } from '#lib/geometry/grid.js';
	import { formatLength, formatNumber, toFeet } from '#lib/geometry/units.js';
	import { worldToScreen } from '#lib/geometry/viewport.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor }: { editor: EditorState } = $props();

	const topLeft = $derived(worldToScreen({ x: 0, y: editor.canvas.depthFt }, editor.viewport));
	const w = $derived(editor.canvas.widthFt * editor.viewport.scale);
	/** Drawn height: with a scale break, the far zone is squeezed (spec §7.4). */
	const h = $derived(worldToScreen({ x: 0, y: 0 }, editor.viewport).y - topLeft.y);
	const lines = $derived.by(() => {
		if (!editor.doc.display.showGrid) return { xs: [], ys: [] };
		const spacing = gridSpacing(editor.snapStep() ?? 1, editor.viewport.scale);
		const all = visibleGridLines(editor.canvas, editor.viewport, editor.screen, spacing);
		const from = editor.depth?.fromFt;
		// No grid inside the not-to-scale strip.
		return { xs: all.xs, ys: from === undefined ? all.ys : all.ys.filter((y) => y < from) };
	});

	const sy = (y: number) => worldToScreen({ x: 0, y }, editor.viewport).y;
	const unit = $derived(editor.plan.unit);

	/** The strip: from the break line (bottom) to the end of the bay (top), in screen px. */
	const strip = $derived(
		editor.depth ? { top: topLeft.y, bottom: sy(editor.depth.fromFt), map: editor.depth } : null
	);

	/** A torn, map-style edge across the bay at screen y. */
	function tear(y: number): string {
		const x0 = topLeft.x - 8;
		const x1 = topLeft.x + w + 8;
		let d = `M${x0} ${y}`;
		for (let x = x0 + 8, up = true; x <= x1; x += 8, up = !up) d += ` L${x} ${y + (up ? -3 : 3)}`;
		return d;
	}

	const TICK_STEPS = [5, 10, 25, 50, 100, 250, 500, 1000];
	/** True-distance ticks down the strip's edge, at a round step at least 24 px apart. */
	const ticks = $derived.by(() => {
		if (!strip) return [];
		const { fromFt, toFt, drawnFt } = strip.map;
		const pxPerFt = (editor.viewport.scale * drawnFt) / (toFt - fromFt);
		const step = TICK_STEPS.find((v) => toFeet(v, unit) * pxPerFt >= 24);
		if (!step) return [];
		const out: { v: number; y: number }[] = [];
		const stepFt = toFeet(step, unit);
		for (let ft = Math.floor(fromFt / stepFt + 1) * stepFt; ft <= toFt + 1e-9; ft += stepFt) {
			out.push({ v: Math.round(ft / toFeet(1, unit)), y: sy(ft) });
		}
		return out;
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
{#if strip}
	<g data-testid="scale-break" class="scale-break">
		<rect class="strip" x={topLeft.x} y={strip.top} width={w} height={strip.bottom - strip.top} />
		<path class="tear" d={tear(strip.bottom)} />
		<text
			data-testid="scale-break-label"
			class="strip-label"
			x={topLeft.x + w - 8}
			y={strip.bottom - 10}
		>
			Not to scale beyond {formatLength(strip.map.fromFt, unit)}
		</text>
		{#each ticks as t (t.v)}
			<line class="tick" x1={topLeft.x - 6} x2={topLeft.x} y1={t.y} y2={t.y} />
			<text class="tick-label" x={topLeft.x - 9} y={t.y} dy="0.35em">
				{formatNumber(t.v)}
				{unit}
			</text>
		{/each}
	</g>
{/if}
<g class="downrange" aria-label="Downrange">
	<line x1={arrowX} x2={arrowX} y1={topLeft.y - 8} y2={topLeft.y - 30} />
	<path
		d={`M${arrowX - 6} ${topLeft.y - 24} L${arrowX} ${topLeft.y - 34} L${arrowX + 6} ${topLeft.y - 24}`}
	/>
	<text x={arrowX + 10} y={topLeft.y - 20}>Downrange</text>
</g>

<style>
	.scale-break,
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
	.strip {
		fill: #eef1f5;
		fill-opacity: 0.85;
	}
	.tear,
	.tick {
		fill: none;
		stroke: var(--color-text);
		stroke-width: 1.5;
	}
	.strip-label {
		fill: var(--color-text);
		font-size: 12px;
		font-weight: 700;
		text-anchor: end;
		paint-order: stroke;
		stroke: #eef1f5;
		stroke-width: 4px;
	}
	.tick-label {
		fill: var(--color-muted);
		font-size: 10px;
		text-anchor: end;
	}
</style>
