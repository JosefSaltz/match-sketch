<script lang="ts">
	import { syncState } from '#lib/sync/loop.svelte.js';
	import Button from '#lib/ui/Button.svelte';
</script>

{#if syncState.needsReload}
	<div
		role="alert"
		class="flex w-full flex-wrap items-center gap-3 border-b-[3px] border-black bg-yellow-300 px-4 py-2 text-sm"
	>
		<span class="mr-auto">
			A newer version of Match Sketch saved some of your plans. Reload to update.
		</span>
		<Button onclick={() => location.reload()}>Reload</Button>
	</div>
{/if}
