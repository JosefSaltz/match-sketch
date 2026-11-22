<script lang="ts">
	import { worldToScreen } from '#lib/geometry/viewport.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor }: { editor: EditorState } = $props();
</script>

<g class="annotations">
	{#each editor.doc.annotations as a (a.id)}
		{@const selected = editor.selection.includes(a.id)}
		{#if a.type === 'text'}
			{@const at = worldToScreen(a, editor.viewport)}
			<g
				data-testid="annotation"
				data-annotation-id={a.id}
				data-annotation-type="text"
				class={['annotation', { selected }]}
				transform="translate({at.x} {at.y})"
			>
				<text data-testid="annotation-text" class="text" dy="0.35em">{a.text}</text>
			</g>
		{/if}
	{/each}
</g>

<style>
	.annotation {
		cursor: move;
	}
	.text {
		fill: var(--color-text);
		font-size: 13px;
		font-weight: 600;
		text-anchor: middle;
		paint-order: stroke;
		stroke: #fff;
		stroke-width: 3px;
		stroke-linejoin: round;
	}
	.selected .text {
		fill: var(--color-selection);
		text-decoration: underline dashed;
	}
</style>
