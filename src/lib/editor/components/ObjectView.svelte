<script lang="ts">
	import { getEntry } from '#lib/catalog/index.js';
	import FootprintShape from '#lib/ui/FootprintShape.svelte';
	import { formatLength } from '#lib/geometry/units.js';
	import { worldToScreen } from '#lib/geometry/viewport.js';
	import { SYMBOL_PX, type PlanObject } from '#lib/model/plan.js';
	import type { EditorState } from '../editor-state.svelte.js';
	import { localBox, rotatedBounds } from '../object-geometry.js';

	let { editor, obj }: { editor: EditorState; obj: PlanObject } = $props();

	/** Copies drawn behind the front glyph when one object stands for several targets. */
	const CLUSTER_COPIES = 2;
	const LABEL_GAP_PX = 12;

	const entry = $derived(getEntry(obj.symbolId));
	const at = $derived(worldToScreen(obj, editor.viewport));
	const symbolPx = $derived(SYMBOL_PX[editor.doc.display.symbolSize]);
	const box = $derived(localBox(obj, entry, editor.viewport.scale, symbolPx));
	const count = $derived(obj.count ?? 1);
	/** Back copies shift right and up by a quarter of the glyph each, so the cluster stays compact. */
	const cluster = $derived(
		count > 1
			? Array.from({ length: Math.min(count - 1, CLUSTER_COPIES) }, (_, i) => {
					const k = CLUSTER_COPIES - i;
					return { k, dx: k * box.width * 0.25, dy: -k * box.height * 0.12 };
				})
			: []
	);
	const drawn = $derived(
		cluster.length
			? {
					...box,
					y: box.y + cluster[0].dy,
					width: box.width + cluster[0].dx,
					height: box.height - cluster[0].dy
				}
			: box
	);
	const bounds = $derived(rotatedBounds(drawn, obj.rotation));
	const badgeWidth = $derived(10 + 6 * String(count).length);
	/** Inside the not-to-scale strip, an object shows its true distance downrange. */
	const distance = $derived(
		editor.depth && obj.y > editor.depth.fromFt ? formatLength(obj.y, editor.plan.unit) : null
	);
</script>

<g
	data-testid="object"
	data-object-id={obj.id}
	data-symbol-id={obj.symbolId}
	class="object"
	transform="translate({at.x} {at.y})"
>
	<g transform="rotate({obj.rotation})">
		{#if entry?.kind === 'footprint'}
			<FootprintShape style={entry.footprint.style} width={box.width} height={box.height} />
		{:else if entry}
			{#each cluster as copy (copy.k)}
				<svg
					class="glyph behind"
					x={box.x + copy.dx}
					y={box.y + copy.dy}
					width={box.width}
					height={box.height}
					overflow="visible"
				>
					<!-- Catalog SVG is bundled with the app, never user input. -->
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html entry.svg}
				</svg>
			{/each}
			<svg
				class="glyph"
				x={box.x}
				y={box.y}
				width={box.width}
				height={box.height}
				overflow="visible"
			>
				<!-- Catalog SVG is bundled with the app, never user input. -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html entry.svg}
			</svg>
		{:else}
			<circle class="unknown" r={box.width / 2} />
			<text class="unknown-mark" dy="0.35em">?</text>
		{/if}
	</g>
	{#if count > 1}
		<g class="badge" transform="translate({bounds.x + bounds.width} {bounds.y})">
			<rect x={-badgeWidth / 2} y="-7" width={badgeWidth} height="14" rx="7" />
			<text data-testid="object-count" dy="0.35em">×{count}</text>
		</g>
	{/if}
	{#if distance}
		<text
			data-testid="object-distance"
			class="distance"
			x={bounds.x + bounds.width + 4}
			y={bounds.y + bounds.height / 2}
			dy="0.35em"
		>
			{distance}
		</text>
	{/if}
	{#if obj.label}
		<text data-testid="object-label" class="label" y={bounds.y + bounds.height + LABEL_GAP_PX}>
			{obj.label}
		</text>
	{/if}
</g>

<style>
	.object {
		color: var(--color-text);
		cursor: move;
	}
	.glyph.behind {
		opacity: 0.55;
	}
	.unknown {
		fill: none;
		stroke: var(--color-danger);
		stroke-dasharray: 3 2;
	}
	.unknown-mark {
		fill: var(--color-danger);
		font-size: 12px;
		text-anchor: middle;
	}
	.badge rect {
		fill: var(--color-text);
	}
	.badge text {
		fill: var(--color-bg);
		font-size: 10px;
		font-weight: 700;
		text-anchor: middle;
	}
	.distance {
		fill: var(--color-text);
		font-size: 11px;
		font-weight: 700;
		paint-order: stroke;
		stroke: #fff;
		stroke-width: 3px;
		stroke-linejoin: round;
	}
	.label {
		fill: var(--color-text);
		font-size: 11px;
		font-weight: 600;
		text-anchor: middle;
		paint-order: stroke;
		stroke: var(--color-bg);
		stroke-width: 3px;
		stroke-linejoin: round;
	}
</style>
