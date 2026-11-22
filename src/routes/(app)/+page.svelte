<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import { getSupabase } from '#lib/auth/client.js';
	import { signOutDevice } from '#lib/auth/session.js';
	import { clearStoredSession } from '#lib/auth/stored-session.js';
	import { APP_NAME } from '#lib/app-info.js';
	import CanvasForm from '#lib/components/CanvasForm.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import CreditsDialog from '#lib/theme/CreditsDialog.svelte';
	import ThemePicker from '#lib/theme/ThemePicker.svelte';
	import SyncStatus from '#lib/sync/SyncStatus.svelte';
	import { stopSync, syncNow, syncState, withSyncLock } from '#lib/sync/loop.svelte.js';
	import { clearLocalData, unsyncedCount, unsyncedWarning } from '#lib/sync/device.js';
	import Button from '#lib/ui/Button.svelte';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import Thumbnail from '#lib/print/Thumbnail.svelte';
	import { formatDimensions, fromFeet } from '#lib/geometry/units.js';
	import { formatMatchDate, stageCount } from '#lib/matches/format.js';
	import MatchForm from '#lib/matches/MatchForm.svelte';
	import { createCanvas, deleteCanvas, listCanvases, updateCanvas } from '#lib/store/canvases.js';
	import { createMatch, deleteMatch, listMatches } from '#lib/store/matches.js';
	import { getDb } from '#lib/store/index.js';
	import { deletePlan, duplicatePlan, listPlans } from '#lib/store/plans.js';
	import {
		planTitle,
		type CanvasInput,
		type CanvasRecord,
		type MatchInput,
		type MatchRecord,
		type PlanRecord
	} from '#lib/store/records.js';
	import { resolve } from '$app/paths';

	let { data }: PageProps = $props();

	let pickingTheme = $state(false);
	let showingCredits = $state(false);

	let plans = $state<PlanRecord[]>([]);
	let matches = $state<MatchRecord[]>([]);
	let creatingMatch = $state(false);
	let deletingMatch = $state<MatchRecord | null>(null);
	/** Plans not in a match; plans in a match are listed on its screen. */
	const unassigned = $derived(plans.filter((p) => p.matchId === null));
	/** How many stages a match has (its plans that aren't deleted). */
	const stagesIn = (matchId: string) => plans.filter((p) => p.matchId === matchId).length;
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

	async function refreshMatches() {
		matches = await listMatches(getDb());
	}

	let isAdmin = $state(false);

	/** Shows the Admin link. RLS lets a user read only their own profile; errors leave it hidden. */
	async function checkAdmin(id: string) {
		try {
			const { data: profile } = await getSupabase()
				.from('profiles')
				.select('role')
				.eq('id', id)
				.maybeSingle();
			isAdmin = profile?.role === 'admin';
		} catch {
			// Offline: the link stays hidden.
		}
	}

	onMount(() => {
		if (data.account.id) void checkAdmin(data.account.id);
		void refreshPlans();
		void refreshCanvases();
		void refreshMatches();
	});

	$effect(() => {
		void syncState.revision;
		untrack(() => {
			void refreshPlans();
			void refreshCanvases();
			void refreshMatches();
		});
	});

	let signingOut = $state(false);
	let signOutWarning = $state<string | null>(null);

	/** Gives pending changes a chance to sync, then warns if any remain before clearing the device. */
	async function signOut() {
		signingOut = true;
		try {
			await Promise.race([syncNow(), new Promise((r) => setTimeout(r, 3000))]);
		} catch {
			// Offline or failed sync: the unsynced count below decides whether to warn.
		}
		const count = await unsyncedCount(getDb());
		if (count > 0) {
			signOutWarning = unsyncedWarning(count);
			return;
		}
		await finishSignOut();
	}

	/** Clears this device's local data and session, then does a full page load so no account state survives. */
	async function finishSignOut() {
		await stopSync();
		// Holding the sync lock means no tab is mid-round, so nothing writes the account's records
		// back after the clear; once the session is gone, other tabs' rounds are refused.
		await withSyncLock(async () => {
			try {
				// Local scope signs out only this device; offline, the stored session is cleared directly.
				await signOutDevice(
					() => getSupabase().auth.signOut({ scope: 'local' }),
					() => clearStoredSession(document)
				);
			} catch {
				// Signing out must always finish.
			}
			await clearLocalData(getDb(), localStorage);
		});
		location.assign(resolve('/sign-in'));
	}

	async function saveMatch(input: MatchInput) {
		const match = await createMatch(getDb(), input);
		creatingMatch = false;
		await goto(resolve('/(app)/matches/[id]', { id: match.id }));
	}

	function deleteMatchMessage(m: MatchRecord): string {
		const n = stagesIn(m.id);
		const rest =
			n === 0
				? ''
				: n === 1
					? ' Its 1 stage stays as an unassigned plan.'
					: ` Its ${n} stages stay as unassigned plans.`;
		return `Delete match "${m.name}"?${rest}`;
	}

	async function confirmDeleteMatch() {
		if (!deletingMatch) return;
		await deleteMatch(getDb(), deletingMatch.id);
		deletingMatch = null;
		await Promise.all([refreshMatches(), refreshPlans()]);
	}

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
			<Button onclick={() => (creatingMatch = true)}>New match</Button>
			<Button onclick={() => (canvasDialog = { mode: 'create' })}>New canvas</Button>
			{#if isAdmin}
				<Button href={resolve('/admin')}>Admin</Button>
			{/if}
			<Button onclick={() => (pickingTheme = true)}>Theme</Button>
			<SyncStatus />
			{#if data.account.email}
				<span class="text-sm text-muted">{data.account.email}</span>
			{/if}
			<Button onclick={signOut} disabled={signingOut}>Sign out</Button>
		</div>
	</header>
	<ThemePicker bind:open={pickingTheme} />

	{#if syncState.notice}
		<p role="status" class="mx-auto m-0 flex max-w-6xl items-center gap-3 px-4 pt-4 text-sm">
			<span>{syncState.notice}</span>
			<button
				type="button"
				class="focus-ring cursor-pointer underline"
				onclick={() => (syncState.notice = null)}
			>
				Dismiss
			</button>
		</p>
	{/if}

	<main class="mx-auto grid max-w-6xl gap-10 px-4 py-8">
		<section aria-labelledby="matches-heading" class="grid gap-4">
			<h2 id="matches-heading" class="m-0 font-display text-2xl tracking-wide uppercase">
				My matches
			</h2>
			{#if matches.length}
				<ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-5 p-0">
					{#each matches as match (match.id)}
						<li
							class="overflow-hidden rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#000]"
						>
							<header class="bg-theme border-b-[3px] border-black px-3 py-2.5">
								<h3 class="m-0 font-display text-base tracking-wide uppercase text-outline-sm">
									{match.name}
								</h3>
							</header>
							<div class="grid gap-3 p-3">
								<p class="m-0 grid text-sm text-muted">
									<span>{formatMatchDate(match.date)}</span>
									<span>{stageCount(stagesIn(match.id))}</span>
								</p>
								<div class="flex flex-wrap gap-2">
									<Button variant="primary" href={resolve('/(app)/matches/[id]', { id: match.id })}>
										Open
									</Button>
									<Button variant="danger" onclick={() => (deletingMatch = match)}>Delete</Button>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="m-0 text-muted">No matches yet. Group stages into a match with “New match”.</p>
			{/if}
		</section>

		<section aria-labelledby="plans-heading" class="grid gap-4">
			<h2 id="plans-heading" class="m-0 font-display text-2xl tracking-wide uppercase">
				Unassigned plans
			</h2>
			{#if unassigned.length}
				<ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-5 p-0">
					{#each unassigned as plan (plan.id)}
						<li
							class="overflow-hidden rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#000]"
						>
							<header class="bg-theme border-b-[3px] border-black px-3 py-2.5">
								<h3 class="m-0 font-display text-base tracking-wide uppercase text-outline-sm">
									{planTitle(plan)}
								</h3>
							</header>
							<div class="grid gap-3 p-3">
								<Thumbnail {plan} />
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
				<p class="m-0 text-muted">
					{plans.length ? 'No unassigned plans.' : 'No plans yet. Start one with “New plan”.'}
				</p>
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

	<footer class="mx-auto flex max-w-6xl justify-end px-4 pb-8">
		<Button onclick={() => (showingCredits = true)}>About & credits</Button>
	</footer>
</div>
<CreditsDialog bind:open={showingCredits} />

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

{#if creatingMatch}
	<Dialog title="New match" onclose={() => (creatingMatch = false)}>
		<MatchForm
			submitLabel="Create match"
			onsubmit={saveMatch}
			oncancel={() => (creatingMatch = false)}
		/>
	</Dialog>
{/if}

{#if deletingMatch}
	<ConfirmDialog
		title="Delete match"
		message={deleteMatchMessage(deletingMatch)}
		confirmLabel="Delete"
		onconfirm={confirmDeleteMatch}
		oncancel={() => (deletingMatch = null)}
	/>
{/if}

{#if signOutWarning}
	<ConfirmDialog
		title="Sign out?"
		message={signOutWarning}
		confirmLabel="Sign out anyway"
		onconfirm={finishSignOut}
		oncancel={() => {
			signOutWarning = null;
			signingOut = false;
		}}
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
