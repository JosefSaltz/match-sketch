<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import Dialog from './Dialog.svelte';

	type Props = {
		title: string;
		message: string;
		confirmLabel: string;
		onconfirm: () => void;
		oncancel: () => void;
	};
	let { title, message, confirmLabel, onconfirm, oncancel }: Props = $props();
</script>

<Dialog {title} onclose={oncancel}>
	<p class="m-0">{message}</p>
	<div class="flex flex-wrap justify-end gap-3">
		<Button onclick={oncancel}>Cancel</Button>
		<Button variant="danger" onclick={onconfirm}>{confirmLabel}</Button>
	</div>
</Dialog>
