<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';

	type Props = { title: string; onclose: () => void; children: Snippet };
	let { title, onclose, children }: Props = $props();

	const uid = $props.id();
	const titleId = `${uid}-title`;

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
	class="m-auto max-h-[90dvh] w-[min(32rem,92vw)] overflow-y-auto rounded-[14px] border-[3px] border-black bg-white p-0 text-text shadow-[5px_5px_0_#000] backdrop:bg-black/40"
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<!-- A div, not a <header>: a header here would read as a second page banner. -->
	<div class="bg-theme border-b-[3px] border-black px-4 py-3">
		<h2 id={titleId} class="m-0 font-display text-lg tracking-wide uppercase text-outline-sm">
			{title}
		</h2>
	</div>
	<div class="grid gap-4 p-4">
		{@render children()}
	</div>
</dialog>
