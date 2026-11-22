<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDimensions } from '#lib/geometry/units.js';
	import { planTitle } from '#lib/store/records.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor }: { editor: EditorState } = $props();

	const title = $derived(planTitle({ document: editor.doc }));
</script>

<header class="toolbar">
	<a class="back" href={resolve('')}>← Plans</a>
	<span class="title">{title}</span>
	<span class="dims">
		{formatDimensions(editor.canvas.widthFt, editor.canvas.depthFt, editor.plan.unit)}
	</span>
	<span class="spacer"></span>
	<div class="group" role="group" aria-label="View">
		<button type="button" onclick={() => editor.zoomBy(1 / 1.25)}>Zoom out</button>
		<button type="button" onclick={() => editor.zoomBy(1.25)}>Zoom in</button>
		<button type="button" onclick={() => editor.fit()}>Fit</button>
	</div>
</header>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-bg);
		min-height: 48px;
	}
	.back {
		color: var(--color-text);
		text-decoration: none;
	}
	.title {
		font-weight: 600;
	}
	.dims {
		color: var(--color-muted);
	}
	.spacer {
		flex: 1;
	}
	.group {
		display: flex;
		gap: var(--space-1);
	}
</style>
