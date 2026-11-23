<script lang="ts">
	import { resolve } from '$app/paths';
	import { shareUrl } from '#lib/model/share.js';
	import PlanPrintView from '#lib/print/PlanPrintView.svelte';
	import { asPlanRecord, sharedStage } from '#lib/share/client.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const stage = $derived(data.view ? sharedStage(data.view, data.stageId) : null);
	/** The stage number the server worked out (typed, or from the match order) prints as typed. */
	const plan = $derived.by(() => {
		if (!stage) return null;
		const record = asPlanRecord(stage.plan);
		const brief = { ...record.document.brief, stageNumber: stage.plan.stageNumber };
		return { ...record, document: { ...record.document, brief } };
	});
	const match = $derived(
		stage && (stage.matchName || stage.date)
			? { name: stage.matchName, date: stage.date, order: [] }
			: null
	);
	const viewer = $derived(
		`${resolve('/s/[token]', { token: data.token })}${data.stageId ? `?stage=${encodeURIComponent(data.stageId)}` : ''}`
	);
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
	{#if !plan}<title>This link isn't shared · Match Sketch</title>{/if}
</svelte:head>

{#if plan}
	<PlanPrintView
		{plan}
		{match}
		link={shareUrl(location.origin, data.token, data.stageId ?? undefined)}
		homeHref={null}
		back={{ href: viewer, label: 'Back to stage' }}
	/>
{:else}
	<main class="mx-auto max-w-2xl px-4 py-8">
		<h1 class="m-0 mb-3 font-display text-2xl tracking-wide uppercase">This link isn't shared</h1>
		<p class="m-0">Ask the person who shared it for a new link.</p>
	</main>
{/if}
