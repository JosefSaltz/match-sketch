<script lang="ts">
	import { untrack } from 'svelte';
	import type { MatchInput } from '#lib/store/records.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import { controlClass } from '#lib/ui/styles.js';

	type Props = {
		submitLabel: string;
		initial?: MatchInput;
		onsubmit: (input: MatchInput) => void;
		oncancel?: () => void;
	};
	let { submitLabel, initial, onsubmit, oncancel }: Props = $props();

	// Mounted fresh each time it opens, so the initial values are read once.
	const start = untrack(() => initial);
	let name = $state(start?.name ?? '');
	let date = $state(start?.date ?? '');
	let error = $state<string | undefined>();

	const uid = $props.id();

	function submit(event: SubmitEvent) {
		event.preventDefault();
		error = name.trim() ? undefined : 'Enter a name';
		if (error) return;
		onsubmit({ name: name.trim(), date });
	}
</script>

<form class="grid gap-4" onsubmit={submit} novalidate>
	<Field label="Name" id="{uid}-name" {error}>
		{#snippet children({ id, describedby })}
			<input
				{id}
				type="text"
				class={controlClass}
				bind:value={name}
				maxlength="80"
				aria-invalid={!!error}
				aria-describedby={describedby}
			/>
		{/snippet}
	</Field>
	<Field label="Date" id="{uid}-date">
		{#snippet children({ id })}
			<input {id} type="date" class={controlClass} bind:value={date} />
		{/snippet}
	</Field>
	<div class="flex flex-wrap justify-end gap-3">
		{#if oncancel}<Button onclick={oncancel}>Cancel</Button>{/if}
		<Button type="submit" variant="primary">{submitLabel}</Button>
	</div>
</form>
