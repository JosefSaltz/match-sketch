<script lang="ts">
	import { resolve } from '$app/paths';
	import { stageLink } from '#lib/print/input.js';
	import PlanPrintView from '#lib/print/PlanPrintView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	{#if !data.plan}<title>Plan not found · Match Sketch</title>{/if}
</svelte:head>

{#if data.plan}
	<PlanPrintView
		plan={data.plan}
		match={data.match}
		link={stageLink(location.origin, data.plan, data.match)}
		homeHref={resolve('')}
		back={{ href: resolve('/(app)/plans/[id]', { id: data.plan.id }), label: 'Back to plan' }}
	/>
{:else}
	<main class="mx-auto max-w-2xl px-4 py-8">
		<h1 class="m-0 mb-3 font-display text-2xl tracking-wide uppercase">Plan not found</h1>
		<p><a class="underline" href={resolve('')}>Back to your plans</a></p>
	</main>
{/if}
