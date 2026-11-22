<script lang="ts">
	import { resolve } from '$app/paths';
	import type { SnapSetting } from '#lib/geometry/snap.js';
	import { formatDimensions } from '#lib/geometry/units.js';
	import type { SymbolSize } from '#lib/model/plan.js';
	import { planTitle } from '#lib/store/records.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor }: { editor: EditorState } = $props();

	const uid = $props.id();
	const SAVE_LABEL = { saving: 'Saving…', saved: 'Saved', error: 'Not saved — retrying' } as const;
	const SNAP_OPTIONS: { value: SnapSetting; label: string }[] = [
		{ value: 'off', label: 'Off' },
		{ value: '1ft', label: '1 ft' },
		{ value: '1yd', label: '1 yd' },
		{ value: '5yd', label: '5 yd' }
	];
	const SIZE_OPTIONS: { value: SymbolSize; label: string }[] = [
		{ value: 'small', label: 'Small' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'large', label: 'Large' }
	];

	const title = $derived(planTitle({ document: editor.doc }));
</script>

<header class="toolbar">
	<a class="back" href={resolve('')}>← Plans</a>
	<span class="title">{title}</span>
	<span class="dims">
		{formatDimensions(editor.canvas.widthFt, editor.canvas.depthFt, editor.plan.unit)}
	</span>
	<div class="group" role="group" aria-label="History">
		<button type="button" onclick={() => editor.undo()} disabled={!editor.canUndo}>Undo</button>
		<button type="button" onclick={() => editor.redo()} disabled={!editor.canRedo}>Redo</button>
	</div>
	<span
		class={['save', editor.saveStatus]}
		data-testid="save-status"
		role="status"
		aria-live="polite"
	>
		{SAVE_LABEL[editor.saveStatus]}
	</span>
	<span class="spacer"></span>
	<div class="field">
		<label for="{uid}-snap">Snap</label>
		<select
			id="{uid}-snap"
			value={editor.doc.display.snap}
			onchange={(e) => editor.setDisplay({ snap: e.currentTarget.value as SnapSetting })}
		>
			{#each SNAP_OPTIONS as o (o.value)}
				<option value={o.value}>{o.label}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="{uid}-size">Symbol size</label>
		<select
			id="{uid}-size"
			value={editor.doc.display.symbolSize}
			onchange={(e) => editor.setDisplay({ symbolSize: e.currentTarget.value as SymbolSize })}
		>
			{#each SIZE_OPTIONS as o (o.value)}
				<option value={o.value}>{o.label}</option>
			{/each}
		</select>
	</div>
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
	.save {
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	.save.error {
		color: var(--color-danger);
		font-weight: 600;
	}
	.field {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: 0.875rem;
		color: var(--color-muted);
	}
</style>
