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
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import Wordmark from '#lib/ui/Wordmark.svelte';

	let canvases = $state<CanvasRecord[]>([]);
	let loaded = $state(false);
	let mode = $state<'saved' | 'new'>('new');
	let selectedId = $state('');
	const selected = $derived(canvases.find((c) => c.id === selectedId));

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
		const canvas = selected;
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

<div class="min-h-full bg-surface">
	<header class="bg-theme border-b-[3px] border-black">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
			<a href={resolve('')} class="focus-ring inline-flex min-h-11 items-center rounded-lg">
				<Wordmark />
			</a>
		</div>
	</header>

	<main class="mx-auto grid max-w-xl gap-5 px-4 py-8">
		<h1 class="m-0 font-display text-2xl tracking-wide uppercase">New plan</h1>

		{#if loaded}
			<div
				class="grid gap-5 rounded-xl border-[3px] border-black bg-white p-4 shadow-[3px_3px_0_#000]"
			>
				<fieldset class="m-0 grid gap-1 border-0 p-0">
					<legend class="mb-1 text-sm text-muted">Canvas for this stage</legend>
					<label class="inline-flex min-h-11 items-center gap-3">
						<input
							type="radio"
							name="mode"
							value="saved"
							class="focus-ring size-5 accent-black"
							bind:group={mode}
							disabled={!canvases.length}
						/>
						<span>Use a saved canvas</span>
					</label>
					<label class="inline-flex min-h-11 items-center gap-3">
						<input
							type="radio"
							name="mode"
							value="new"
							class="focus-ring size-5 accent-black"
							bind:group={mode}
						/>
						<span>New canvas</span>
					</label>
				</fieldset>

				{#if mode === 'saved'}
					<form class="grid gap-4" onsubmit={createFromSaved}>
						<Field label="Canvas" id="saved-canvas">
							{#snippet children({ id })}
								<select {id} class={controlClass} bind:value={selectedId}>
									{#each canvases as canvas (canvas.id)}
										<option value={canvas.id}>{canvas.name}</option>
									{/each}
								</select>
							{/snippet}
						</Field>
						{#if selected}
							<p class="m-0 text-muted">
								{formatDimensions(selected.widthFt, selected.depthFt, selected.unit)}
							</p>
						{/if}
						<div class="flex justify-end">
							<Button type="submit" variant="primary">Create plan</Button>
						</div>
					</form>
				{:else}
					<CanvasForm submitLabel="Create plan" showSaveToLibrary onsubmit={createFromNew} />
				{/if}
			</div>
		{/if}
	</main>
</div>
