<script lang="ts">
	import { worldToScreen } from '#lib/geometry/viewport.js';
	import type { Point } from '#lib/geometry/types.js';
	import {
		bayRect,
		clipPolygon,
		clipPolyline,
		densify,
		groupTags,
		toPathData,
		zoneTags,
		type BayEdge
	} from '#lib/safety/paths.js';
	import { DASH } from '#lib/safety/dash.js';
	import { SPLASH_SOURCES } from '#lib/safety/sources.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor }: { editor: EditorState } = $props();

	/** The carried-on part of a minimum reach: visibly different from the layer's own pattern. */
	const BEYOND_DASH = '2 4';
	const STEP_FT = 2;

	const rect = $derived(bayRect(editor.canvas));
	const vp = $derived(editor.viewport);

	const lines = (line: Point[]): string[] =>
		clipPolyline(line, rect).map((piece) => toPathData(densify(piece, STEP_FT), vp, false));
	const fill = (poly: Point[]): string => {
		const clipped = clipPolygon(poly, rect);
		return clipped.length < 3 ? '' : toPathData(densify(clipped, STEP_FT, true), vp, true);
	};

	const ARROW_PX = 8;

	/** Outward triangle with its tip at the bay edge; direction taken from two points since screen y is flipped. */
	const arrow = (at: Point, dir: Point): string => {
		const tip = worldToScreen(at, vp);
		const ahead = worldToScreen({ x: at.x + dir.x, y: at.y + dir.y }, vp);
		const len = Math.hypot(ahead.x - tip.x, ahead.y - tip.y) || 1;
		const ux = (ahead.x - tip.x) / len;
		const uy = (ahead.y - tip.y) / len;
		const bx = tip.x - ux * ARROW_PX;
		const by = tip.y - uy * ARROW_PX;
		const h = ARROW_PX / 2;
		return `${tip.x},${tip.y} ${bx - uy * h},${by + ux * h} ${bx + uy * h},${by - ux * h}`;
	};

	const FONT_PX = 10;
	const LINE_PX = 12;
	/** Text sits this far inside the bay edge, clear of the arrowhead. */
	const GAP_PX = ARROW_PX + 4;
	/** Screen x follows world x; downrange is up on screen, so the downrange edge is the top one. */
	const ANCHOR: Record<BayEdge, 'start' | 'end' | 'middle'> = {
		left: 'start',
		right: 'end',
		uprange: 'middle',
		downrange: 'middle'
	};

	/** Where the first line's baseline goes, keeping the whole stack inside the bay. */
	function placeText(edge: BayEdge, tip: Point, count: number): Point {
		const stack = (count - 1) * LINE_PX;
		switch (edge) {
			case 'left':
				return { x: tip.x + GAP_PX, y: tip.y - stack / 2 + FONT_PX * 0.35 };
			case 'right':
				return { x: tip.x - GAP_PX, y: tip.y - stack / 2 + FONT_PX * 0.35 };
			case 'downrange':
				return { x: tip.x, y: tip.y + GAP_PX + FONT_PX };
			case 'uprange':
				return { x: tip.x, y: tip.y - GAP_PX - stack };
		}
	}

	const tags = $derived(
		groupTags(zoneTags(editor.zones, rect, editor.plan.unit), rect).map((g) => {
			const text = placeText(g.edge, worldToScreen(g.at, vp), g.lines.length);
			return {
				key: g.key,
				lines: g.lines,
				anchor: ANCHOR[g.edge],
				arrow: arrow(g.at, g.dir),
				...text
			};
		})
	);
</script>

<g data-testid="danger-zones" class="zones">
	{#each editor.zones.splash as z (z.key)}
		{@const dash = DASH[z.sourceId]}
		<g data-testid="danger-splash" data-source={z.sourceId} data-object-id-ref={z.objectId}>
			{#each [z.left, z.right] as side, i (i)}
				{@const f = fill(side.wedge)}
				{#if f}<path class="fill" d={f} />{/if}
				{#each lines([z.origin, side.rayEnd]) as d, j (j)}
					<path class="line" {d} stroke-dasharray={dash} />
				{/each}
				{#if side.beyond && SPLASH_SOURCES[z.sourceId].reachKind === 'minimum'}
					{#each lines([side.rayEnd, side.beyond]) as d, j (j)}
						<path class="line" {d} stroke-dasharray={BEYOND_DASH} />
					{/each}
				{/if}
			{/each}
		</g>
	{/each}
	{#each editor.zones.fans as z (z.key)}
		{@const dash = DASH[z.sourceId]}
		<g data-testid="danger-fan" data-source={z.sourceId}>
			{#each z.dispersion as end, i (i)}
				{#each lines([z.origin, end]) as d, j (j)}
					<path class="line light" {d} />
				{/each}
			{/each}
			{#each [z.left, z.right] as side, i (i)}
				{#each lines(side.outline) as d, j (j)}
					<path class="line" {d} stroke-dasharray={dash} />
				{/each}
			{/each}
		</g>
	{/each}
	{#each tags as t (t.key)}
		<polygon data-testid="danger-exit" class="exit" points={t.arrow} />
		<text data-testid="danger-tag" class="tag" text-anchor={t.anchor} font-size={FONT_PX}>
			{#each t.lines as line, i (i)}
				<tspan x={t.x} y={t.y + i * LINE_PX}>{line}</tspan>
			{/each}
		</text>
	{/each}
</g>

<style>
	.zones {
		pointer-events: none;
	}
	.fill {
		fill: var(--color-danger);
		fill-opacity: 0.1;
		stroke: none;
	}
	.line {
		fill: none;
		stroke: var(--color-danger);
		stroke-width: 2;
	}
	.line.light {
		stroke-width: 1;
		stroke-opacity: 0.45;
	}
	.exit {
		fill: var(--color-danger);
		stroke: none;
	}
	.tag {
		fill: var(--color-danger);
		font-weight: 700;
		paint-order: stroke;
		stroke: #fff;
		stroke-width: 3px;
	}
</style>
