<script lang="ts">
	import type { StageBrief } from '#lib/model/plan.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor }: { editor: EditorState } = $props();

	const uid = $props.id();
	const brief = $derived(editor.doc.brief);

	type TextKey = Exclude<keyof StageBrief, 'targetsOverride' | 'notes'>;
	type Row = { key: TextKey; label: string; rows?: number };

	/** Spec §7.2 order; Targets sits between Round count and Par time. */
	const BEFORE_TARGETS: Row[] = [
		{ key: 'matchName', label: 'Match name' },
		{ key: 'stageNumber', label: 'Stage number' },
		{ key: 'stageName', label: 'Stage name' },
		{ key: 'startPosition', label: 'Start position' },
		{ key: 'gunReady', label: 'Gun ready condition' },
		{ key: 'procedure', label: 'Stage procedure', rows: 8 },
		{ key: 'roundCount', label: 'Round count' }
	];
	const AFTER_TARGETS: Row[] = [{ key: 'parTime', label: 'Par time' }];

	type InputEvent = Event & { currentTarget: HTMLInputElement | HTMLTextAreaElement };

	/** Every keystroke is saved; one field visit is one undo step (EditorState.setBrief). */
	function typeInto(key: TextKey, e: InputEvent) {
		editor.setBrief({ [key]: e.currentTarget.value }, key);
	}
</script>

{#snippet textRow(row: Row)}
	<Field label={row.label} id="{uid}-{row.key}">
		{#snippet children({ id })}
			{#if row.rows}
				<textarea
					{id}
					rows={row.rows}
					class="{controlClass} py-2"
					value={brief[row.key]}
					oninput={(e) => typeInto(row.key, e)}
					onblur={() => editor.endTyping()}></textarea>
			{:else}
				<input
					{id}
					type="text"
					class={controlClass}
					value={brief[row.key]}
					oninput={(e) => typeInto(row.key, e)}
					onblur={() => editor.endTyping()}
				/>
			{/if}
		{/snippet}
	</Field>
{/snippet}

<div class="grid gap-3">
	{#each BEFORE_TARGETS as row (row.key)}
		{@render textRow(row)}
	{/each}
	{#each AFTER_TARGETS as row (row.key)}
		{@render textRow(row)}
	{/each}

	<section class="grid gap-3" aria-labelledby="{uid}-notes">
		<h3 id="{uid}-notes" class="m-0 font-display text-sm tracking-wide uppercase">Notes</h3>
		{#each brief.notes as note, i (note.id)}
			<fieldset class="m-0 grid gap-2 rounded-lg border-2 border-border p-2">
				<legend class="px-1 text-xs text-muted">Notes section {i + 1}</legend>
				<Field label="Title" id="{uid}-note-{note.id}-title">
					{#snippet children({ id })}
						<input
							{id}
							type="text"
							class={controlClass}
							value={note.title}
							oninput={(e) =>
								editor.updateNoteSection(
									note.id,
									{ title: e.currentTarget.value },
									`note-${note.id}-title`
								)}
							onblur={() => editor.endTyping()}
						/>
					{/snippet}
				</Field>
				<Field label="Text" id="{uid}-note-{note.id}-body">
					{#snippet children({ id })}
						<textarea
							{id}
							rows="4"
							class="{controlClass} py-2"
							value={note.body}
							oninput={(e) =>
								editor.updateNoteSection(
									note.id,
									{ body: e.currentTarget.value },
									`note-${note.id}-body`
								)}
							onblur={() => editor.endTyping()}></textarea>
					{/snippet}
				</Field>
				<Button variant="danger" onclick={() => editor.removeNoteSection(note.id)}>
					Remove section
				</Button>
			</fieldset>
		{/each}
		<Button onclick={() => editor.addNoteSection()}>Add notes section</Button>
	</section>
</div>
