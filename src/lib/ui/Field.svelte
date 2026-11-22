<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A label above its control. The control gets `id` and `describedby` from the snippet so
	 * the error text is read out with it.
	 */
	type Props = {
		label: string;
		id: string;
		error?: string;
		children: Snippet<[{ id: string; describedby: string | undefined }]>;
	};
	let { label, id, error, children }: Props = $props();

	const errorId = $derived(`${id}-error`);
</script>

<div class="grid gap-1">
	<label for={id} class="text-sm text-muted">{label}</label>
	{@render children({ id, describedby: error ? errorId : undefined })}
	{#if error}
		<p id={errorId} class="m-0 text-sm text-danger" role="alert">{error}</p>
	{/if}
</div>
