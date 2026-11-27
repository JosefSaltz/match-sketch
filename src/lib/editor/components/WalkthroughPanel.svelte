<script lang="ts">
	import { getEntry } from '#lib/catalog/index.js';
	import { MEANINGS } from '#lib/model/plan.js';
	import { displaySteps } from '#lib/model/procedure.js';
	import Button from '#lib/ui/Button.svelte';
	import MeaningBadge from '#lib/walkthrough/MeaningBadge.svelte';
	import { MEANING_STYLES } from '#lib/walkthrough/meanings.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor }: { editor: EditorState } = $props();

	const uid = $props.id();
	const steps = $derived(displaySteps(editor.doc.brief.steps));
	const active = $derived(editor.activeStep);
	const number = $derived(steps.findIndex((s) => s.id === active?.id) + 1);
	const objectCount = $derived(editor.selectedObjects.length);
	const arrows = $derived(editor.selectedAnnotations.filter((a) => a.type === 'arrow'));
	const arrowsShown = $derived(
		active !== null && arrows.length > 0 && arrows.every((a) => active.arrows.includes(a.id))
	);

	function nameOf(objectId: string): string {
		const obj = editor.doc.objects.find((o) => o.id === objectId);
		if (!obj) return 'Object';
		return obj.label?.trim() || getEntry(obj.symbolId)?.name || obj.symbolId;
	}
</script>

{#snippet badge(meaning: (typeof MEANINGS)[number])}
	<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" class="shrink-0">
		<MeaningBadge {meaning} x={10} y={10} r={9} />
	</svg>
{/snippet}

<div class="grid gap-4">
	{#if steps.length === 0}
		<p class="m-0 text-muted">Write the stage procedure in the Brief tab. Each line is a step.</p>
	{:else}
		<section class="grid gap-2" aria-labelledby="{uid}-steps">
			<h3 id="{uid}-steps" class="m-0 font-display text-sm tracking-wide uppercase">Steps</h3>
			<ol class="m-0 grid list-none gap-1 p-0">
				{#each steps as step, i (step.id)}
					<li>
						<button
							type="button"
							class={[
								'focus-ring flex min-h-11 w-full items-start gap-2 rounded-lg border-2 px-2 py-2 text-left text-sm',
								step.id === active?.id ? 'border-black bg-surface font-semibold' : 'border-border'
							]}
							aria-pressed={step.id === active?.id}
							onclick={() => (editor.activeStepId = step.id)}
						>
							<span class="font-display">{i + 1}.</span>
							<span class="min-w-0 flex-1">{step.text}</span>
							{#if step.marks.length}
								<span class="text-xs text-muted">{step.marks.length} marked</span>
							{/if}
						</button>
					</li>
				{/each}
			</ol>
		</section>

		{#if !active}
			<p class="m-0 text-sm text-muted">
				Pick a step, select objects on the bay, then choose what the shooter does with them.
			</p>
		{:else}
			<section class="grid gap-3" aria-labelledby="{uid}-mark">
				<h3 id="{uid}-mark" class="m-0 font-display text-sm tracking-wide uppercase">
					Step {number}
				</h3>
				<div class="grid grid-cols-2 gap-2" role="group" aria-label="Mark the selected objects as">
					{#each MEANINGS as meaning (meaning)}
						<Button
							disabled={objectCount === 0}
							onclick={() => editor.markSelected(meaning)}
							class="justify-start"
						>
							{@render badge(meaning)}
							{MEANING_STYLES[meaning].label}
						</Button>
					{/each}
					<Button disabled={objectCount === 0} onclick={() => editor.markSelected(null)}>
						Clear
					</Button>
				</div>
				{#if objectCount === 0}
					<p class="m-0 text-xs text-muted">Select objects on the bay to mark them.</p>
				{/if}
				{#if arrows.length}
					<label class="flex min-h-11 items-center gap-2 text-sm font-semibold">
						<input
							type="checkbox"
							class="focus-ring size-5 accent-black"
							checked={arrowsShown}
							onchange={(e) => editor.setSelectedArrowsInStep(e.currentTarget.checked)}
						/>
						Show selected arrows in this step
					</label>
				{/if}
				{#if active.marks.length}
					<ul class="m-0 grid list-none gap-1 p-0" aria-label="Marked in this step">
						{#each active.marks as mark (mark.objectId)}
							<li class="flex min-h-11 items-center gap-2 text-sm">
								{@render badge(mark.meaning)}
								<span class="min-w-0 flex-1 truncate">
									{nameOf(mark.objectId)} — {MEANING_STYLES[mark.meaning].label}
								</span>
								<Button
									variant="icon"
									aria-label="Remove mark from {nameOf(mark.objectId)}"
									onclick={() => editor.clearMark(mark.objectId)}
								>
									✕
								</Button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	{/if}
</div>
