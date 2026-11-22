<script lang="ts">
	import { resolve } from '$app/paths';
	import EditorView from '#lib/editor/components/EditorView.svelte';
	import { planTitle } from '#lib/store/records.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title
		>{data.plan ? `${planTitle(data.plan)} · Match Sketch` : 'Plan not found · Match Sketch'}</title
	>
</svelte:head>

{#if data.plan}
	{#key data.plan.id}
		<EditorView plan={data.plan} />
	{/key}
{:else}
	<main class="missing">
		<h1>Plan not found</h1>
		<p><a href={resolve('')}>Back to your plans</a></p>
	</main>
{/if}

<style>
	.missing {
		max-width: 40rem;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4);
	}
</style>
