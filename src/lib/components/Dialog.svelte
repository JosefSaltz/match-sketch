<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';

	type Props = { title: string; onclose: () => void; children: Snippet };
	let { title, onclose, children }: Props = $props();

	const titleId = `dialog-${crypto.randomUUID()}`;

	/** Opens as a modal when mounted; the parent controls visibility with {#if}. */
	const modal: Attachment<HTMLDialogElement> = (dialog) => {
		dialog.showModal();
		return () => {
			if (dialog.open) dialog.close();
		};
	};
</script>

<dialog
	{@attach modal}
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
