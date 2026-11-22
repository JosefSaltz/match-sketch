<script lang="ts">
	import { onMount } from 'svelte';
	import { APP_NAME } from '#lib/app-info.js';
	import CanvasForm from '#lib/components/CanvasForm.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import { formatDimensions, fromFeet } from '#lib/geometry/units.js';
	import { createCanvas, deleteCanvas, listCanvases, updateCanvas } from '#lib/store/canvases.js';
	import { getDb } from '#lib/store/index.js';
	import type { CanvasInput, CanvasRecord } from '#lib/store/records.js';

	let canvases = $state<CanvasRecord[]>([]);
	let canvasDialog = $state<{ mode: 'create' } | { mode: 'edit'; canvas: CanvasRecord } | null>(
		null
	);
	let deletingCanvas = $state<CanvasRecord | null>(null);

	async function refreshCanvases() {
		canvases = await listCanvases(getDb());
	}

	onMount(refreshCanvases);

	async function saveCanvas(input: CanvasInput) {
		const dialog = canvasDialog;
		if (!dialog) return;
		if (dialog.mode === 'create') await createCanvas(getDb(), input);
		else await updateCanvas(getDb(), dialog.canvas.id, input);
		canvasDialog = null;
		await refreshCanvases();
	}

	async function confirmDeleteCanvas() {
		if (!deletingCanvas) return;
		await deleteCanvas(getDb(), deletingCanvas.id);
		deletingCanvas = null;
		await refreshCanvases();
	}
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<main class="home">
	<h1>{APP_NAME}</h1>

	<section aria-labelledby="plans-heading">
		<div class="section-head">
			<h2 id="plans-heading">Plans</h2>
		</div>
	</section>

	<section aria-labelledby="canvases-heading">
		<div class="section-head">
			<h2 id="canvases-heading">Canvases</h2>
			<button type="button" onclick={() => (canvasDialog = { mode: 'create' })}>New canvas</button>
		</div>
		{#if canvases.length}
			<ul class="rows">
				{#each canvases as canvas (canvas.id)}
					<li class="row">
						<span class="name">{canvas.name}</span>
						<span class="meta">
							{formatDimensions(canvas.widthFt, canvas.depthFt, canvas.unit)}
						</span>
						<span class="row-actions">
							<button type="button" onclick={() => (canvasDialog = { mode: 'edit', canvas })}>
								Edit
							</button>
							<button type="button" onclick={() => (deletingCanvas = canvas)}>Delete</button>
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">
				No saved canvases yet. Save a bay's dimensions here to reuse them in plans.
			</p>
		{/if}
	</section>
</main>

{#if canvasDialog}
	{@const editing = canvasDialog.mode === 'edit' ? canvasDialog.canvas : null}
	<Dialog title={editing ? 'Edit canvas' : 'New canvas'} onclose={() => (canvasDialog = null)}>
		<CanvasForm
			submitLabel="Save canvas"
			initial={editing
				? {
						name: editing.name,
						width: fromFeet(editing.widthFt, editing.unit),
						depth: fromFeet(editing.depthFt, editing.unit),
						unit: editing.unit
					}
				: undefined}
			onsubmit={saveCanvas}
			oncancel={() => (canvasDialog = null)}
		/>
	</Dialog>
{/if}

{#if deletingCanvas}
	<ConfirmDialog
		title="Delete canvas"
		message={`Delete canvas "${deletingCanvas.name}"?`}
		confirmLabel="Delete"
		onconfirm={confirmDeleteCanvas}
		oncancel={() => (deletingCanvas = null)}
	/>
{/if}

<style>
	.home {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--space-6) var(--space-4);
	}
	section {
		margin-top: var(--space-8);
	}
	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-border);
	}
	.name {
		font-weight: 600;
	}
	.meta,
	.empty {
		color: var(--color-muted);
	}
	.row-actions {
		display: flex;
		gap: var(--space-2);
	}
</style>
