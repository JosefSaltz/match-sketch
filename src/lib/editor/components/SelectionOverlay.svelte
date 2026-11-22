<script lang="ts">
	import { getEntry } from '#lib/catalog/index.js';
	import type { Corner } from '#lib/geometry/transform.js';
	import { worldToScreen } from '#lib/geometry/viewport.js';
	import { SYMBOL_PX } from '#lib/model/plan.js';
	import type { EditorState } from '../editor-state.svelte.js';
	import { localBox } from '../object-geometry.js';

	let { editor }: { editor: EditorState } = $props();

	const PAD_PX = 4;
	/** The rotate handle sits this far beyond the object's top, in its rotated frame. */
	const ROTATE_GAP_PX = 24;
	/** Touch target radius: 26 px across, above the 24 px minimum. */
	const HIT_R = 13;

	const outlines = $derived(
		editor.selectedObjects.map((obj) => {
			const entry = getEntry(obj.symbolId);
			return {
				id: obj.id,
				footprint: entry?.kind === 'footprint',
				at: worldToScreen(obj, editor.viewport),
				rotation: obj.rotation,
				box: localBox(obj, entry, editor.viewport.scale, SYMBOL_PX[editor.doc.display.symbolSize])
			};
		})
	);

	/** Handles show for a single selection only. */
	const single = $derived(outlines.length === 1 ? outlines[0] : null);

	const corners = $derived.by(() => {
		if (!single?.footprint) return [];
		const { x, y, width, height } = single.box;
		const list: { corner: Corner; x: number; y: number }[] = [
			{ corner: 'nw', x, y },
			{ corner: 'ne', x: x + width, y },
			{ corner: 'sw', x, y: y + height },
			{ corner: 'se', x: x + width, y: y + height }
		];
		return list;
	});
</script>

<g class="selection-layer">
	{#each outlines as o (o.id)}
		<rect
			data-testid="selection"
			class="outline"
			transform="{editor.swing.transformFor(o.id)} translate({o.at.x} {o.at
				.y}) rotate({o.rotation})"
			x={o.box.x - PAD_PX}
			y={o.box.y - PAD_PX}
			width={o.box.width + PAD_PX * 2}
			height={o.box.height + PAD_PX * 2}
		/>
	{/each}
	{#if single}
		{@const topY = single.box.y - PAD_PX}
		<g
			transform="{editor.swing.transformFor(single.id)} translate({single.at.x} {single.at
				.y}) rotate({single.rotation})"
		>
			<line class="stem" x1="0" x2="0" y1={topY} y2={topY - ROTATE_GAP_PX} />
			<g
				class="handle rotate"
				data-testid="handle-rotate"
				data-handle="rotate"
				transform="translate(0 {topY - ROTATE_GAP_PX})"
			>
				<circle class="hit" r={HIT_R} />
				<circle class="dot" r="6" />
			</g>
			{#each corners as c (c.corner)}
				<g
					class={['handle', 'corner', c.corner]}
					data-testid="handle-{c.corner}"
					data-handle={c.corner}
					transform="translate({c.x} {c.y})"
				>
					<circle class="hit" r={HIT_R} />
					<rect class="dot" x="-5" y="-5" width="10" height="10" />
				</g>
			{/each}
		</g>
	{/if}
</g>

<style>
	.selection-layer {
		pointer-events: none;
	}
	.outline {
		fill: none;
		stroke: var(--color-selection);
		stroke-width: 1.5;
		stroke-dasharray: 5 3;
	}
	.stem {
		stroke: var(--color-selection);
		stroke-width: 1.5;
	}
	.handle {
		pointer-events: all;
	}
	.hit {
		fill: transparent;
	}
	.dot {
		fill: #fff;
		stroke: var(--color-selection);
		stroke-width: 2;
	}
	.rotate {
		cursor: grab;
	}
	.nw,
	.se {
		cursor: nwse-resize;
	}
	.ne,
	.sw {
		cursor: nesw-resize;
	}
</style>
