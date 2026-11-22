<script lang="ts">
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
	<p>{message}</p>
	<div class="actions">
		<button type="button" onclick={oncancel}>Cancel</button>
		<button type="button" class="danger" onclick={onconfirm}>{confirmLabel}</button>
	</div>
</Dialog>

<style>
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.danger {
		background: var(--color-danger);
		color: #fff;
		border: 1px solid var(--color-danger);
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-4);
	}
</style>
