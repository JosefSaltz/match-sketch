<script lang="ts">
	import { onMount } from 'svelte';
	import { APP_NAME } from '#lib/app-info.js';
	import CanvasForm from '#lib/components/CanvasForm.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import ThemePicker from '#lib/theme/ThemePicker.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import { formatDimensions, fromFeet } from '#lib/geometry/units.js';
	import { createCanvas, deleteCanvas, listCanvases, updateCanvas } from '#lib/store/canvases.js';
	import { getDb } from '#lib/store/index.js';
	import { deletePlan, duplicatePlan, listPlans } from '#lib/store/plans.js';
	import {
		planTitle,
		type CanvasInput,
		type CanvasRecord,
		type PlanRecord
	} from '#lib/store/records.js';
	import { resolve } from '$app/paths';

	let pickingTheme = $state(false);

	let plans = $state<PlanRecord[]>([]);
	let deletingPlan = $state<PlanRecord | null>(null);
	let canvases = $state<CanvasRecord[]>([]);
	let canvasDialog = $state<{ mode: 'create' } | { mode: 'edit'; canvas: CanvasRecord } | null>(
		null
	);
	let deletingCanvas = $state<CanvasRecord | null>(null);

	async function refreshCanvases() {
		canvases = await listCanvases(getDb());
	}

	async function refreshPlans() {
		plans = await listPlans(getDb());
	}

	onMount(() => {
		void refreshPlans();
		void refreshCanvases();
	});

	async function duplicate(plan: PlanRecord) {
		await duplicatePlan(getDb(), plan.id);
		await refreshPlans();
	}

	async function confirmDeletePlan() {
		if (!deletingPlan) return;
		await deletePlan(getDb(), deletingPlan.id);
		deletingPlan = null;
		await refreshPlans();
	}

	const edited = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});

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

<div class="min-h-full bg-surface">
	<header class="bg-theme border-b-[3px] border-black">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
			<h1 class="m-0 mr-auto"><Wordmark /></h1>
			<Button href={resolve('plans/new')}>New plan</Button>
			<Button onclick={() => (canvasDialog = { mode: 'create' })}>New canvas</Button>
			<Button onclick={() => (pickingTheme = true)}>Theme</Button>
		</div>
	</header>
	<ThemePicker bind:open={pickingTheme} />

	<main class="mx-auto grid max-w-6xl gap-10 px-4 py-8">
		<section aria-labelledby="plans-heading" class="grid gap-4">
			<h2 id="plans-heading" class="m-0 font-display text-2xl tracking-wide uppercase">Plans</h2>
			{#if plans.length}
				<ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-5 p-0">
					{#each plans as plan (plan.id)}
						<li
							class="overflow-hidden rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#000]"
						>
							<header class="bg-theme border-b-[3px] border-black px-3 py-2.5">
								<h3 class="m-0 font-display text-base tracking-wide uppercase text-outline-sm">
									{planTitle(plan)}
								</h3>
							</header>
							<div class="grid gap-3 p-3">
								<p class="m-0 grid text-sm text-muted">
									<span>{formatDimensions(plan.widthFt, plan.depthFt, plan.unit)}</span>
									<span>Edited {edited(plan.updatedAt)}</span>
								</p>
								<div class="flex flex-wrap gap-2">
									<Button variant="primary" href={resolve('/(app)/plans/[id]', { id: plan.id })}>
										Open
									</Button>
									<Button onclick={() => duplicate(plan)}>Duplicate</Button>
									<Button variant="danger" onclick={() => (deletingPlan = plan)}>Delete</Button>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="m-0 text-muted">No plans yet. Start one with “New plan”.</p>
			{/if}
		</section>

		<section aria-labelledby="canvases-heading" class="grid gap-4">
			<h2 id="canvases-heading" class="m-0 font-display text-2xl tracking-wide uppercase">
				Canvases
			</h2>
			{#if canvases.length}
				<ul
					class="m-0 list-none divide-y-2 divide-border overflow-hidden rounded-xl border-[3px] border-black bg-white p-0 shadow-[3px_3px_0_#000]"
				>
					{#each canvases as canvas (canvas.id)}
						<li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
							<span class="font-semibold">{canvas.name}</span>
							<span class="mr-auto text-muted">
								{formatDimensions(canvas.widthFt, canvas.depthFt, canvas.unit)}
							</span>
							<Button onclick={() => (canvasDialog = { mode: 'edit', canvas })}>Edit</Button>
							<Button variant="danger" onclick={() => (deletingCanvas = canvas)}>Delete</Button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="m-0 text-muted">
					No saved canvases yet. Save a bay's dimensions here to reuse them in plans.
				</p>
			{/if}
		</section>
	</main>
</div>

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

{#if deletingPlan}
	<ConfirmDialog
		title="Delete plan"
		message={`Delete plan "${planTitle(deletingPlan)}"?`}
		confirmLabel="Delete"
		onconfirm={confirmDeletePlan}
		oncancel={() => (deletingPlan = null)}
	/>
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
