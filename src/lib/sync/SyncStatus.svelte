<script lang="ts">
	import { syncState } from '#lib/sync/loop.svelte.js';
	import { syncLabel } from '#lib/sync/status.js';
	import ConflictDialog from '#lib/sync/ConflictDialog.svelte';

	const DOT = {
		Synced: 'bg-green-600',
		'Syncing…': 'bg-amber-500',
		'Changes pending': 'bg-amber-500',
		Offline: 'bg-neutral-400',
		'Sync failed': 'bg-red-600',
		Conflict: 'bg-red-600'
	} as const;

	const PILL =
		'inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-white px-2.5 py-0.5 text-xs font-display uppercase tracking-wide';

	const label = $derived(
		syncLabel({
			online: syncState.online,
			syncing: syncState.syncing,
			pending: syncState.pending,
			conflicts: syncState.conflicts.length,
			failed: syncState.failed
		})
	);

	let showingConflicts = $state(false);
</script>

{#if label === 'Conflict'}
	<button
		type="button"
		class="{PILL} focus-ring cursor-pointer"
		data-testid="sync-status"
		onclick={() => (showingConflicts = true)}
	>
		<span class="size-2 rounded-full {DOT[label]}" aria-hidden="true"></span>{label}
	</button>
{:else}
	<span class={PILL} role="status" aria-live="polite" data-testid="sync-status">
		<span class="size-2 rounded-full {DOT[label]}" aria-hidden="true"></span>{label}
	</span>
{/if}

{#if showingConflicts}
	<ConflictDialog onclose={() => (showingConflicts = false)} />
{/if}
