<script lang="ts">
	import Dialog from '#lib/components/Dialog.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { applyDraft } from '#lib/draft/apply.js';
	import { draftProblem, requestDraft } from '#lib/draft/client.js';
	import type { DraftResult } from '#lib/draft/contract.js';
	import { syncState } from '#lib/sync/loop.svelte.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor, onclose }: { editor: EditorState; onclose: () => void } = $props();

	const uid = $props.id();

	// Copied once at open; the textarea is editable from here.
	// svelte-ignore state_referenced_locally
	let description = $state(editor.doc.brief.procedure);
	let pending = $state(false);
	let error = $state<string | null>(null);
	let result = $state<DraftResult | null>(null);
	let confirming = $state(false);

	const brief = $derived(editor.doc.brief);
	const missingProcedure = $derived(brief.procedure.trim() === '');
	const problem = $derived(result ? draftProblem(result) : null);
	const objectCount = $derived(editor.doc.objects.length);
	const sentFields = $derived(
		[
			['Start position', brief.startPosition],
			['Gun ready', brief.gunReady],
			['Round count', brief.roundCount],
			['Targets', brief.targetsOverride],
			['Par time', brief.parTime]
		]
			.filter(([, value]) => String(value ?? '').trim() !== '')
			.map(([label]) => label)
	);

	async function draft() {
		error = null;
		result = null;
		pending = true;
		const outcome = await requestDraft({
			planId: editor.plan.id,
			description,
			brief: editor.doc.brief,
			canvas: {
				widthFt: editor.plan.widthFt,
				depthFt: editor.plan.depthFt,
				unit: editor.plan.unit
			},
			symbolSize: editor.doc.display.symbolSize
		});
		pending = false;
		if (outcome.ok) result = outcome.result;
		else error = outcome.message;
	}

	function apply() {
		if (objectCount > 0) confirming = true;
		else commit();
	}

	function commit() {
		if (!result) return;
		editor.commit(applyDraft(editor.doc, result.objects));
		onclose();
	}

	function plural(n: number) {
		return `${n} ${n === 1 ? 'object' : 'objects'}`;
	}
</script>

<Dialog title="Draft from text" {onclose}>
	<Field label="Description" id="{uid}-description">
		{#snippet children({ id, describedby })}
			<textarea
				{id}
				aria-describedby={describedby}
				rows={8}
				class={controlClass}
				bind:value={description}></textarea>
		{/snippet}
	</Field>
	{#if missingProcedure}
		<p role="alert" class="m-0 text-sm text-danger">
			Write the stage procedure first; the draft follows it.
		</p>
	{/if}
	<p class="m-0 text-sm text-muted">
		Sent with the brief: {sentFields.length > 0 ? sentFields.join(', ') : 'the procedure only'}
	</p>
	<div>
		<Button
			variant="primary"
			onclick={draft}
			disabled={missingProcedure || pending || !syncState.online}
		>
			{pending ? 'Drafting…' : 'Draft layout'}
		</Button>
	</div>
	{#if error}
		<p role="alert" class="m-0 text-sm text-danger">{error}</p>
	{/if}
	{#if result}
		{#if problem}
			<p role="alert" class="m-0 text-sm text-danger">{problem}</p>
		{:else}
			<p role="status" class="m-0">Drafted {plural(result.objects.length)}.</p>
			{#each result.unrepresentable as item, i (i)}
				<p class="m-0 text-sm">Not drawn: {item}</p>
			{/each}
			{#each result.dropped as d, i (i)}
				<p class="m-0 text-sm">Dropped: {d.what} — {d.reason}</p>
			{/each}
			<div>
				<Button variant="primary" onclick={apply}>Apply draft</Button>
			</div>
		{/if}
	{/if}
	<div class="flex flex-wrap justify-end gap-3">
		<Button onclick={onclose}>Close</Button>
	</div>
</Dialog>

{#if confirming}
	<ConfirmDialog
		title="Replace the objects?"
		message="Replace the {plural(objectCount)} on this bay with the draft?"
		confirmLabel="Replace"
		onconfirm={commit}
		oncancel={() => (confirming = false)}
	/>
{/if}
