<script lang="ts">
	import type { Share } from '#lib/model/share.js';
	import type { ShareAction } from '#lib/store/share.js';
	import { syncState } from '#lib/sync/loop.svelte.js';
	import Button from '#lib/ui/Button.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import Dialog from './Dialog.svelte';

	type Props = {
		title: string;
		share: Share | null;
		/** The viewer's address for `share`, or null while there is no link. */
		link: string | null;
		onaction: (action: ShareAction) => void;
		onclose: () => void;
	};
	let { title, share, link, onaction, onclose }: Props = $props();

	const uid = $props.id();
	let copied = $state(false);
	let resetting = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		if (!link) return;
		await navigator.clipboard.writeText(link);
		copied = true;
		clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = false), 2000);
	}
</script>

<Dialog {title} {onclose}>
	<label class="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
		<input
			type="checkbox"
			role="switch"
			class="focus-ring size-6 accent-black"
			checked={share?.on ?? false}
			onchange={(e) => onaction(e.currentTarget.checked ? 'on' : 'off')}
		/>
		Anyone with the link can view
	</label>

	{#if share?.on && link}
		<div class="grid gap-2">
			<label for="{uid}-link" class="text-sm text-muted">Link</label>
			<div class="flex flex-wrap gap-2">
				<input
					id="{uid}-link"
					type="text"
					readonly
					class="{controlClass} min-w-0 flex-1"
					value={link}
					onfocus={(e) => e.currentTarget.select()}
				/>
				<Button onclick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
			</div>
		</div>
	{/if}

	{#if !syncState.online}
		<p class="m-0 text-sm text-muted">
			You're offline. Sharing changes take effect when this device syncs.
		</p>
	{/if}

	<div class="flex flex-wrap justify-end gap-3">
		{#if share}
			<Button variant="danger" onclick={() => (resetting = true)}>Reset link</Button>
		{/if}
		<Button variant="primary" onclick={onclose}>Done</Button>
	</div>
</Dialog>

{#if resetting}
	<ConfirmDialog
		title="Reset link"
		message="Reset the link? QR codes already printed will stop working."
		confirmLabel="Reset link"
		onconfirm={() => {
			resetting = false;
			onaction('reset');
		}}
		oncancel={() => (resetting = false)}
	/>
{/if}
