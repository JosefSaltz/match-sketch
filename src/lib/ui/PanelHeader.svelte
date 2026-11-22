<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { title: string; level?: 2 | 3; id?: string; actions?: Snippet };
	let { title, level = 2, id, actions }: Props = $props();
</script>

<div
	class="bg-theme flex min-h-12 items-center justify-between gap-3 border-b-[3px] border-black px-3 py-2"
>
	<svelte:element
		this={`h${level}`}
		{id}
		class="m-0 font-display text-base tracking-wide uppercase text-outline-sm"
	>
		{title}
	</svelte:element>
	{#if actions}
		<div class="flex items-center gap-2">{@render actions()}</div>
	{/if}
</div>
