<script lang="ts">
	import { resolve } from '$app/paths';
	import Dialog from '#lib/components/Dialog.svelte';
	import { dismissConflicts, syncState } from '#lib/sync/loop.svelte.js';
	import type { ConflictCopy } from '#lib/sync/engine.js';
	import Button from '#lib/ui/Button.svelte';

	let { onclose }: { onclose: () => void } = $props();

	function href(copy: ConflictCopy): string {
		if (copy.table === 'plans') return resolve('/(app)/plans/[id]', { id: copy.id });
		if (copy.table === 'matches') return resolve('/(app)/matches/[id]', { id: copy.id });
		return resolve('/(app)');
	}

	async function dismiss() {
		await dismissConflicts();
		onclose();
	}
</script>

<Dialog title="Conflicted copies" {onclose}>
	<p class="m-0">
		Another device changed these at the same time. Your version was saved as a copy next to it; keep
		or delete either.
	</p>
	<ul class="m-0 grid list-none gap-2 p-0">
		{#each syncState.conflicts as copy (`${copy.table}:${copy.id}`)}
			<li>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a class="underline" href={href(copy)} onclick={onclose}>{copy.name}</a>
			</li>
		{/each}
	</ul>
	<div class="flex justify-end">
		<Button variant="primary" onclick={dismiss}>Dismiss</Button>
	</div>
</Dialog>
