<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CanvasForm from '#lib/components/CanvasForm.svelte';
	import { formatDimensions } from '#lib/geometry/units.js';
	import { createCanvas, listCanvases } from '#lib/store/canvases.js';
	import { getDb } from '#lib/store/index.js';
	import { createPlan } from '#lib/store/plans.js';
	import type { CanvasInput, CanvasRecord } from '#lib/store/records.js';

	let canvases = $state<CanvasRecord[]>([]);
	let loaded = $state(false);
	let mode = $state<'saved' | 'new'>('new');
	let selectedId = $state('');

	onMount(async () => {
		canvases = await listCanvases(getDb());
		if (canvases.length) {
			mode = 'saved';
			selectedId = canvases[0].id;
		}
		loaded = true;
	});

	async function open(planId: string) {
		await goto(resolve('/(app)/plans/[id]', { id: planId }));
	}

	async function createFromSaved(event: SubmitEvent) {
		event.preventDefault();
		const canvas = canvases.find((c) => c.id === selectedId);
		if (!canvas) return;
		const plan = await createPlan(getDb(), { canvas, sourceCanvasId: canvas.id });
		await open(plan.id);
	}

	async function createFromNew(input: CanvasInput, saveToLibrary: boolean) {
		const db = getDb();
		const saved = saveToLibrary ? await createCanvas(db, input) : null;
		const plan = await createPlan(db, { canvas: input, sourceCanvasId: saved?.id ?? null });
		await open(plan.id);
	}
</script>

<svelte:head>
	<title>New plan · Match Sketch</title>
</svelte:head>

<main class="new-plan">
	<p><a href={resolve('')}>← Plans</a></p>
	<h1>New plan</h1>

	{#if loaded}
		<fieldset>
			<legend>Canvas for this stage</legend>
			<label class="choice">
				<input
					type="radio"
					name="mode"
					value="saved"
					bind:group={mode}
					disabled={!canvases.length}
				/>
				<span>Use a saved canvas</span>
			</label>
			<label class="choice">
				<input type="radio" name="mode" value="new" bind:group={mode} />
				<span>New canvas</span>
			</label>
		</fieldset>

		{#if mode === 'saved'}
			<form class="saved" onsubmit={createFromSaved}>
				<label>
					<span>Canvas</span>
					<select bind:value={selectedId}>
						{#each canvases as canvas (canvas.id)}
							<option value={canvas.id}>{canvas.name}</option>
						{/each}
					</select>
				</label>
				{#if canvases.find((c) => c.id === selectedId)}
					{@const c = canvases.find((c) => c.id === selectedId)!}
					<p class="meta">{formatDimensions(c.widthFt, c.depthFt, c.unit)}</p>
				{/if}
				<div class="actions"><button type="submit" class="primary">Create plan</button></div>
			</form>
		{:else}
			<CanvasForm submitLabel="Create plan" showSaveToLibrary onsubmit={createFromNew} />
		{/if}
	{/if}
</main>

<style>
	.new-plan {
		max-width: 36rem;
		margin: 0 auto;
		padding: var(--space-6) var(--space-4);
		display: grid;
		gap: var(--space-4);
	}
	h1 {
		margin: 0;
	}
	fieldset {
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		display: grid;
		gap: var(--space-2);
	}
	.choice {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.saved {
		display: grid;
		gap: var(--space-3);
	}
	.saved label {
		display: grid;
		gap: var(--space-1);
	}
	select {
		padding: var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}
	.meta {
		margin: 0;
		color: var(--color-muted);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.primary {
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-4);
	}
</style>
