<script lang="ts">
	import { untrack } from 'svelte';
	import { getDb } from '#lib/store/index.js';
	import { clearJournal, writeJournal } from '#lib/store/journal.js';
	import { savePlanDocument } from '#lib/store/plans.js';
	import type { PlanRecord } from '#lib/store/records.js';
	import { EditorState, type NudgeDir } from '../editor-state.svelte.js';
	import { commandForKey } from '../shortcuts.js';
	import EditorCanvas from './EditorCanvas.svelte';
	import Palette from './Palette.svelte';
	import PropertiesPanel from './PropertiesPanel.svelte';
	import Toolbar from './Toolbar.svelte';

	let { plan }: { plan: PlanRecord } = $props();

	// The parent keys this component by plan id, so one EditorState per mount is right.
	const editor = untrack(
		() =>
			new EditorState(plan, {
				save: async (doc, at) => {
					await savePlanDocument(getDb(), plan.id, doc, at);
				},
				journal: {
					write: (doc, at) => writeJournal(localStorage, plan.id, doc, at),
					clear: () => clearJournal(localStorage, plan.id)
				}
			})
	);

	/** Editor shortcuts; keys typed into fields are left to the field (see commandForKey). */
	function onKeydown(e: KeyboardEvent) {
		// While a dialog (e.g. the theme picker) is open, keys belong to it, not the stage.
		if (document.querySelector('dialog:modal')) return;
		const active = document.activeElement as HTMLElement | null;
		const command = commandForKey(e, {
			tagName: active?.tagName ?? 'BODY',
			isContentEditable: active?.isContentEditable ?? false
		});
		if (!command) return;
		if (e.repeat && command === 'duplicate') {
			e.preventDefault(); // Holding Ctrl+D makes one copy, not one per key repeat.
			return;
		}
		switch (command) {
			case 'delete':
				if (!editor.selection.length) return;
				editor.deleteSelected();
				break;
			case 'duplicate':
				editor.duplicateSelected();
				break;
			case 'deselect':
				editor.clearSelection();
				return;
			case 'undo':
				editor.undo();
				break;
			case 'redo':
				editor.redo();
				break;
			default:
				if (!editor.selection.length) return;
				editor.nudge(command.slice('nudge-'.length) as NudgeDir);
		}
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="grid h-dvh grid-rows-[auto_1fr]">
	<Toolbar {editor} />
	<div class="grid min-h-0 grid-cols-[16rem_1fr_17rem]">
		<Palette {editor} />
		<EditorCanvas {editor} />
		<PropertiesPanel {editor} />
	</div>
</div>
