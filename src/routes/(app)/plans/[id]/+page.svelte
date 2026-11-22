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
	<main class="mx-auto max-w-2xl px-4 py-8">
		<h1 class="m-0 mb-3 font-display text-2xl tracking-wide uppercase">Plan not found</h1>
		<p><a class="underline" href={resolve('')}>Back to your plans</a></p>
	</main>
{/if}
