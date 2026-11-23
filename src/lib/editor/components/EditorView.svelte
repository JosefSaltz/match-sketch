<script lang="ts">
	import { untrack } from 'svelte';
	import { playClick } from '#lib/audio/click.js';
	import { sounds } from '#lib/audio/sounds.svelte.js';
	import { getDb } from '#lib/store/index.js';
	import { clearJournal, writeJournal } from '#lib/store/journal.js';
	import type { PlanRecord } from '#lib/store/records.js';
	import { EditorState, type MatchContext, type NudgeDir } from '../editor-state.svelte.js';
	import { createPlanSaver } from '../plan-saver.js';
	import { commandForKey } from '../shortcuts.js';
	import EditorCanvas from './EditorCanvas.svelte';
	import Palette from './Palette.svelte';
	import SidePanel from './SidePanel.svelte';
	import Toolbar from './Toolbar.svelte';

	let {
		plan,
		match = null,
		onstale
	}: {
		plan: PlanRecord;
		match?: MatchContext | null;
		/** A pull or conflict replaced the plan while it was open; the edit went to a copy. */
		onstale?: () => void;
	} = $props();

	// Saves never write over another device's version (see plan-saver.ts).
	const saver = untrack(() =>
		createPlanSaver({
			db: getDb(),
			planId: plan.id,
			base: plan.updatedAt,
			onStale: () => onstale?.()
		})
	);

	// The parent keys this component by plan id and version, so one EditorState per mount is right.
	const editor = untrack(
		() =>
			new EditorState(
				plan,
				{
					onGridCross: () => {
						if (sounds.on) playClick(sounds.click);
					},
					save: (doc, at) => saver.save(doc, at),
					setShare: (share) => saver.setShare(share),
					journal: {
						write: (doc, at) => writeJournal(localStorage, plan.id, doc, at, saver.bases),
						clear: () => clearJournal(localStorage, plan.id)
					}
				},
				match
			)
	);

	/** Editor shortcuts; keys typed into fields are left to the field (see commandForKey). */
	function onKeydown(e: KeyboardEvent) {
		// While a dialog (e.g. the theme picker) is open, keys belong to it, not the stage.
		if (document.querySelector('dialog:modal')) return;
		// A control that handled the key itself (e.g. the side panel's tabs) keeps it.
		if (e.defaultPrevented) return;
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
	<div class="grid min-h-0 grid-cols-[16rem_1fr_17rem] xl:grid-cols-[16rem_1fr_20rem]">
		<Palette {editor} />
		<EditorCanvas {editor} />
		<SidePanel {editor} />
	</div>
</div>
