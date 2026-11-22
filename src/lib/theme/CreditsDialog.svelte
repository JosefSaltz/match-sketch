<script lang="ts">
	import Dialog from '#lib/components/Dialog.svelte';
	import Button from '#lib/ui/Button.svelte';
	import { CREDITS } from './credits.js';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

{#if open}
	<Dialog title="About & credits" onclose={() => (open = false)}>
		<p class="m-0">
			Match Sketch draws stage plans for practical shooting matches. The camo themes are traced from
			the references below; the plaid themes are original designs.
		</p>
		<ul class="m-0 grid list-none gap-3 p-0 text-sm">
			{#each CREDITS as c (c.id)}
				<li class="grid gap-0.5">
					{#if c.url}
						<!-- External source pages, not app routes, so resolve() doesn't apply. -->
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a class="font-semibold underline" href={c.url} target="_blank" rel="noreferrer">
							{c.title}
						</a>
					{:else}
						<span class="font-semibold">{c.title}</span>
					{/if}
					<span class="text-muted">{c.author} · {c.license}</span>
					{#if c.note}<span>{c.note}</span>{/if}
				</li>
			{/each}
		</ul>
		<div class="flex justify-end">
			<Button onclick={() => (open = false)}>Close</Button>
		</div>
	</Dialog>
{/if}
