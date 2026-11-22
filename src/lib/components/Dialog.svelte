<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { title: string; onclose: () => void; children: Snippet };
	let { title, onclose, children }: Props = $props();

	let el: HTMLDialogElement;
	const titleId = `dialog-${crypto.randomUUID()}`;

	$effect(() => {
		el.showModal();
		return () => {
			if (el.open) el.close();
		};
	});
</script>

<!-- Mounted only while open; the parent controls visibility with {#if}. -->
<dialog
	bind:this={el}
	aria-labelledby={titleId}
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<h2 id={titleId}>{title}</h2>
	{@render children()}
</dialog>

<style>
	dialog {
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: var(--space-6);
		min-width: min(28rem, 90vw);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.35);
	}
	h2 {
		margin: 0 0 var(--space-4);
		font-size: 1.15rem;
	}
</style>
