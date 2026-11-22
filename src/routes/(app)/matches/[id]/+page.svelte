<script lang="ts">
	import { resolve } from '$app/paths';
	import Dialog from '#lib/components/Dialog.svelte';
	import { formatDimensions } from '#lib/geometry/units.js';
	import { moveItem, reorderIndex } from '#lib/matches/reorder.js';
	import { getDb } from '#lib/store/index.js';
	import {
		assignPlan,
		listMatchPlans,
		reorderMatchPlans,
		updateMatch
	} from '#lib/store/matches.js';
	import { listPlans } from '#lib/store/plans.js';
	import { effectiveStageNumber, planTitle, type PlanRecord } from '#lib/store/records.js';
	import ThemePicker from '#lib/theme/ThemePicker.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Local copies that follow the loaded data and are updated after each change.
	let match = $derived(data.match);
	let plans = $derived(data.plans);

	let pickingTheme = $state(false);
	let adding = $state(false);
	let unassigned = $state<PlanRecord[]>([]);

	const order = $derived(plans.map((p) => p.id));
	const stageNumber = (p: PlanRecord) => effectiveStageNumber(p, order);

	async function refresh() {
		if (!match) return;
		plans = await listMatchPlans(getDb(), match.id);
		if (adding) unassigned = (await listPlans(getDb())).filter((p) => p.matchId === null);
	}

	type FieldEvent = Event & { currentTarget: HTMLInputElement };

	/** Saves the name or date on change; a blank name puts the old one back. */
	async function saveField(e: FieldEvent, key: 'name' | 'date') {
		if (!match) return;
		const value = key === 'name' ? e.currentTarget.value.trim() : e.currentTarget.value;
		if (key === 'name' && !value) {
			e.currentTarget.value = match.name;
			return;
		}
		if (value === match[key]) return;
		match = await updateMatch(getDb(), match.id, {
			name: match.name,
			date: match.date,
			[key]: value
		});
	}

	async function saveOrder(next: PlanRecord[]) {
		if (!match) return;
		plans = next;
		await reorderMatchPlans(
			getDb(),
			match.id,
			next.map((p) => p.id)
		);
	}

	async function openAdd() {
		unassigned = (await listPlans(getDb())).filter((p) => p.matchId === null);
		adding = true;
	}

	async function add(plan: PlanRecord) {
		if (!match) return;
		await assignPlan(getDb(), plan.id, match.id);
		await refresh();
	}

	async function remove(plan: PlanRecord) {
		await assignPlan(getDb(), plan.id, null);
		await refresh();
	}

	/**
	 * A stage being dragged by its handle; rows reorder live and the order saves on release.
	 * Move and release are heard on the window: reordering moves the row in the DOM, which drops
	 * the handle's pointer capture.
	 */
	let drag: { id: string; pointerId: number; moved: boolean } | null = null;

	function onHandleDown(e: PointerEvent, plan: PlanRecord) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		drag = { id: plan.id, pointerId: e.pointerId, moved: false };
	}

	function onHandleMove(e: PointerEvent) {
		if (!drag || drag.pointerId !== e.pointerId) return;
		const from = plans.findIndex((p) => p.id === drag!.id);
		const rows = [...document.querySelectorAll<HTMLElement>('[data-stage-row]')];
		const mids = rows
			.filter((r) => r.dataset.stageRow !== drag!.id)
			.map((r) => {
				const b = r.getBoundingClientRect();
				return b.top + b.height / 2;
			});
		const to = reorderIndex(mids, e.clientY);
		if (from >= 0 && to !== from) {
			plans = moveItem(plans, from, to);
			drag.moved = true;
		}
	}

	async function onHandleUp(e: PointerEvent) {
		if (!drag || drag.pointerId !== e.pointerId) return;
		const moved = drag.moved;
		drag = null;
		if (moved) await saveOrder(plans);
	}
</script>

<svelte:window onpointermove={onHandleMove} onpointerup={onHandleUp} onpointercancel={onHandleUp} />

<svelte:head>
	<title>{match ? `${match.name} · Match Sketch` : 'Match not found · Match Sketch'}</title>
</svelte:head>

<div class="min-h-full bg-surface">
	<header class="bg-theme border-b-[3px] border-black">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
			<a href={resolve('')} class="focus-ring mr-auto inline-flex min-h-11 items-center rounded-lg">
				<Wordmark />
			</a>
			<Button onclick={() => (pickingTheme = true)}>Theme</Button>
		</div>
	</header>
	<ThemePicker bind:open={pickingTheme} />

	<main class="mx-auto grid max-w-3xl gap-6 px-4 py-8">
		{#if match}
			{@const m = match}
			<h1 class="m-0 font-display text-2xl tracking-wide uppercase">{m.name}</h1>
			<div
				class="grid gap-4 rounded-xl border-[3px] border-black bg-white p-4 shadow-[3px_3px_0_#000] sm:grid-cols-[1fr_12rem]"
			>
				<Field label="Name" id="match-name">
					{#snippet children({ id })}
						<input
							{id}
							type="text"
							maxlength="80"
							class={controlClass}
							value={m.name}
							onchange={(e) => saveField(e, 'name')}
						/>
					{/snippet}
				</Field>
				<Field label="Date" id="match-date">
					{#snippet children({ id })}
						<input
							{id}
							type="date"
							class={controlClass}
							value={m.date}
							onchange={(e) => saveField(e, 'date')}
						/>
					{/snippet}
				</Field>
			</div>

			<section aria-labelledby="stages-heading" class="grid gap-3">
				<div class="flex flex-wrap items-center gap-3">
					<h2 id="stages-heading" class="m-0 mr-auto font-display text-xl tracking-wide uppercase">
						Stages
					</h2>
					<Button href={`${resolve('/(app)/plans/new')}?match=${m.id}`}>New stage</Button>
					<Button onclick={openAdd}>Add existing plan</Button>
				</div>
				{#if plans.length}
					<ol
						class="m-0 list-none divide-y-2 divide-border overflow-hidden rounded-xl border-[3px] border-black bg-white p-0 shadow-[3px_3px_0_#000]"
					>
						{#each plans as plan, i (plan.id)}
							{@const n = stageNumber(plan)}
							<li
								data-stage-row={plan.id}
								class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2"
							>
								<button
									type="button"
									class="focus-ring inline-flex min-h-11 w-11 cursor-grab touch-none items-center justify-center rounded-lg text-xl text-muted select-none hover:bg-surface"
									aria-label="Reorder stage {i + 1}"
									title="Drag to reorder"
									onpointerdown={(e) => onHandleDown(e, plan)}
								>
									⠿
								</button>
								<span class="mr-auto grid min-w-0">
									<span class="truncate font-semibold">{planTitle(plan, n)}</span>
									<span class="text-sm text-muted">
										{formatDimensions(plan.widthFt, plan.depthFt, plan.unit)}
									</span>
								</span>
								<Button variant="primary" href={resolve('/(app)/plans/[id]', { id: plan.id })}>
									Open
								</Button>
								<Button
									variant="icon"
									aria-label="Move stage {i + 1} up"
									title="Move up"
									disabled={i === 0}
									onclick={() => saveOrder(moveItem(plans, i, i - 1))}
								>
									↑
								</Button>
								<Button
									variant="icon"
									aria-label="Move stage {i + 1} down"
									title="Move down"
									disabled={i === plans.length - 1}
									onclick={() => saveOrder(moveItem(plans, i, i + 1))}
								>
									↓
								</Button>
								<Button onclick={() => remove(plan)}>Remove</Button>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="m-0 text-muted">
						No stages yet. Start one with “New stage” or add a plan you already have.
					</p>
				{/if}
			</section>
		{:else}
			<h1 class="m-0 mb-3 font-display text-2xl tracking-wide uppercase">Match not found</h1>
			<p><a class="underline" href={resolve('')}>Back to your plans</a></p>
		{/if}
	</main>
</div>

{#if adding}
	<Dialog title="Add existing plan" onclose={() => (adding = false)}>
		<div class="grid gap-4">
			{#if unassigned.length}
				<ul class="m-0 grid list-none gap-2 p-0">
					{#each unassigned as plan (plan.id)}
						<li class="flex items-center gap-3">
							<span class="mr-auto grid min-w-0">
								<span class="truncate font-semibold">{planTitle(plan)}</span>
								<span class="text-sm text-muted">
									{formatDimensions(plan.widthFt, plan.depthFt, plan.unit)}
								</span>
							</span>
							<Button onclick={() => add(plan)}>Add</Button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="m-0 text-muted">No unassigned plans.</p>
			{/if}
			<div class="flex justify-end">
				<Button variant="primary" onclick={() => (adding = false)}>Done</Button>
			</div>
		</div>
	</Dialog>
{/if}
