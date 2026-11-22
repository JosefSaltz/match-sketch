<script lang="ts">
	import { untrack } from 'svelte';
	import { getDb } from '#lib/store/index.js';
	import { savePlanDocument } from '#lib/store/plans.js';
	import type { PlanRecord } from '#lib/store/records.js';
	import { EditorState } from '../editor-state.svelte.js';
	import EditorCanvas from './EditorCanvas.svelte';
	import Palette from './Palette.svelte';
	import Toolbar from './Toolbar.svelte';

	let { plan }: { plan: PlanRecord } = $props();

	// The parent keys this component by plan id, so one EditorState per mount is right.
	const editor = untrack(
		() =>
			new EditorState(plan, {
				save: async (doc) => {
					await savePlanDocument(getDb(), plan.id, doc);
				}
			})
	);
</script>

<div class="editor">
	<Toolbar {editor} />
	<div class="workspace">
		<Palette {editor} />
		<EditorCanvas {editor} />
		<aside class="properties" aria-label="Properties"></aside>
	</div>
</div>

<style>
	.editor {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100vh;
	}
	.workspace {
		display: grid;
		grid-template-columns: 16rem 1fr 17rem;
		min-height: 0;
	}
	.properties {
		border-left: 1px solid var(--color-border);
		overflow-y: auto;
	}
</style>
