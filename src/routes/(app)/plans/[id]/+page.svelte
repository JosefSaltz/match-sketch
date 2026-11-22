<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import EditorView from '#lib/editor/components/EditorView.svelte';
	import { effectiveStageNumber, planTitle } from '#lib/store/records.js';
	import { syncState } from '#lib/sync/loop.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** The last pull revision acted on; plain, so handling it doesn't re-run the effect. */
	let handled = 0;

	$effect(() => {
		const revision = syncState.revision;
		if (revision === handled) return;
		handled = revision;
		const plan = data.plan;
		// Re-read when a pull changed this plan, or when the plan wasn't here yet (a link opened
		// on a device before its first pull).
		const changed = syncState.changed.some((c) => c.table === 'plans' && c.id === plan?.id);
		if (!plan || changed) untrack(() => void invalidateAll());
	});
</script>

<svelte:head>
	<title
		>{data.plan
			? `${planTitle(data.plan, effectiveStageNumber(data.plan, data.match?.order ?? null))} · Match Sketch`
			: 'Plan not found · Match Sketch'}</title
	>
</svelte:head>

{#if data.plan}
	{#key `${data.plan.id}:${data.plan.version}`}
		<EditorView plan={data.plan} match={data.match} />
	{/key}
{:else}
	<main class="mx-auto max-w-2xl px-4 py-8">
		<h1 class="m-0 mb-3 font-display text-2xl tracking-wide uppercase">Plan not found</h1>
		<p><a class="underline" href={resolve('')}>Back to your plans</a></p>
	</main>
{/if}
