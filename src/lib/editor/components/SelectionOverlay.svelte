<script lang="ts">
	import { getEntry } from '#lib/catalog/index.js';
	import { worldToScreen } from '#lib/geometry/viewport.js';
	import { SYMBOL_PX } from '#lib/model/plan.js';
	import type { EditorState } from '../editor-state.svelte.js';
	import { localBox } from '../object-geometry.js';

	let { editor }: { editor: EditorState } = $props();

	const PAD_PX = 4;

	const outlines = $derived(
		editor.selectedObjects.map((obj) => ({
			id: obj.id,
			at: worldToScreen(obj, editor.viewport),
			rotation: obj.rotation,
			box: localBox(
				obj,
				getEntry(obj.symbolId),
				editor.viewport.scale,
				SYMBOL_PX[editor.doc.display.symbolSize]
			)
		}))
	);
</script>

<g class="selection-layer">
	{#each outlines as o (o.id)}
		<rect
			data-testid="selection"
			transform="translate({o.at.x} {o.at.y}) rotate({o.rotation})"
			x={o.box.x - PAD_PX}
			y={o.box.y - PAD_PX}
			width={o.box.width + PAD_PX * 2}
			height={o.box.height + PAD_PX * 2}
		/>
	{/each}
</g>

<style>
	.selection-layer {
		pointer-events: none;
	}
	rect {
		fill: none;
		stroke: var(--color-selection);
		stroke-width: 1.5;
		stroke-dasharray: 5 3;
	}
</style>
