<script lang="ts">
	import { resolve } from '$app/paths';
	import { onSignOutElsewhere } from '#lib/auth/sign-out-broadcast.js';
	import { getDb } from '#lib/store/index.js';
	import { startSync, syncState } from '#lib/sync/loop.svelte.js';
	import ReloadBanner from '#lib/sync/ReloadBanner.svelte';
	import { fetchTransport } from '#lib/sync/transport.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const accountId = $derived(data.account.id);

	$effect(() => {
		if (!accountId) return;
		return startSync({ db: getDb(), accountId, transport: fetchTransport() });
	});

	// Another tab signed this device out and cleared it: leave too, with a full page load.
	$effect(() => onSignOutElsewhere(() => location.assign(resolve('/sign-in'))));
</script>

<ReloadBanner />
{#if syncState.otherAccount}
	<p role="alert" class="m-0 bg-red-100 px-4 py-2 text-sm">
		Another account's data is on this device. Sign out to clear it.
	</p>
{/if}
{@render children()}
