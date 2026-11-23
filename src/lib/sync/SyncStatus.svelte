<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import { syncNow, syncState } from '#lib/sync/loop.svelte.js';
	import { syncLabel, type SyncLabel } from '#lib/sync/status.js';
	import ConflictDialog from '#lib/sync/ConflictDialog.svelte';

	/** The corner dot's colour; the glyph inside the cloud carries the same meaning without colour. */
	const DOT: Record<SyncLabel, string> = {
		Synced: 'bg-green-600',
		'Syncing…': 'bg-amber-500',
		'Changes pending': 'bg-amber-500',
		Offline: 'bg-neutral-400',
		'Sync failed': 'bg-red-600',
		Conflict: 'bg-red-600'
	};

	const ACTION: Record<SyncLabel, string> = {
		Synced: 'Sync now',
		'Syncing…': 'Syncing',
		'Changes pending': 'Sync now',
		Offline: 'Syncs when back online',
		'Sync failed': 'Try again',
		Conflict: 'Show the conflicted copies'
	};

	const label = $derived(
		syncLabel({
			online: syncState.online,
			syncing: syncState.syncing,
			pending: syncState.pending,
			conflicts: syncState.conflicts.length,
			failed: syncState.failed
		})
	);
	const glyph = $derived(
		label === 'Synced'
			? 'check'
			: label === 'Offline'
				? 'off'
				: label === 'Sync failed' || label === 'Conflict'
					? 'alert'
					: 'up'
	);
	// Rounds run every 30 s; announcing each "Syncing…" would be noise, so only outcomes are read out.
	let lastOutcome: SyncLabel = 'Synced';
	const announced = $derived.by(() => {
		if (label !== 'Syncing…') lastOutcome = label;
		return lastOutcome;
	});

	let showingConflicts = $state(false);

	function onclick() {
		if (label === 'Conflict') showingConflicts = true;
		else void syncNow();
	}
</script>

<Button
	variant="icon"
	class="relative"
	data-testid="sync-status"
	data-state={label}
	aria-label="{label}. {ACTION[label]}"
	title="{label} · {ACTION[label]}"
	{onclick}
>
	<svg
		viewBox="0 0 24 24"
		class={['size-6', label === 'Syncing…' && 'motion-safe:animate-pulse']}
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
		{#if glyph === 'check'}
			<path d="m9.5 14.5 2 2 3.5-3.5" />
		{:else if glyph === 'up'}
			<path d="M12 17v-5m-2.5 2.5L12 12l2.5 2.5" />
		{:else if glyph === 'alert'}
			<path d="M12 11.5v3m0 2.5h.01" />
		{:else}
			<path d="m3 3 18 18" />
		{/if}
	</svg>
	<span
		class="absolute top-1 right-1 size-2.5 rounded-full border border-black {DOT[label]}"
		aria-hidden="true"
	></span>
</Button>
<span class="sr-only" role="status">{announced}</span>

{#if showingConflicts}
	<ConflictDialog onclose={() => (showingConflicts = false)} />
{/if}
