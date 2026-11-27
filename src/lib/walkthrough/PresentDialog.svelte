<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { ComponentProps } from 'svelte';
	import WalkthroughPlayer from './WalkthroughPlayer.svelte';

	/** The walkthrough full screen over the page, for presenting at the stage briefing. */
	type Props = Omit<ComponentProps<typeof WalkthroughPlayer>, 'onclose'> & { onclose: () => void };
	let { onclose, ...player }: Props = $props();

	const modal: Attachment<HTMLDialogElement> = (dialog) => {
		dialog.showModal();
		return () => {
			if (dialog.open) dialog.close();
		};
	};
</script>

<dialog
	{@attach modal}
	aria-label="Walkthrough"
	class="m-0 h-dvh max-h-none w-dvw max-w-none bg-white p-4 text-text backdrop:bg-black/40 sm:p-6"
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<WalkthroughPlayer {...player} {onclose} />
</dialog>
