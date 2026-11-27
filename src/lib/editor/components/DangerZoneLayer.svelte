<script lang="ts">
	import { worldToScreen } from '#lib/geometry/viewport.js';
	import type { Point } from '#lib/geometry/types.js';
	import {
		bayRect,
		clipPolygon,
		clipPolyline,
		densify,
		toPathData,
		zoneTags
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

	const tags = $derived(
		zoneTags(editor.zones, rect, editor.plan.unit).map((t) => ({
			key: t.key,
			text: t.text,
			...worldToScreen(t.at, vp)
		}))
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
		<text data-testid="danger-tag" class="tag" x={t.x} y={t.y} dy="-0.4em">{t.text}</text>
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
	.tag {
		fill: var(--color-danger);
		font-size: 10px;
		font-weight: 700;
		text-anchor: middle;
		paint-order: stroke;
		stroke: #fff;
		stroke-width: 3px;
	}
</style>
