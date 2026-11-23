<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import type { UserRow } from '#lib/server/users.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import PanelHeader from '#lib/ui/PanelHeader.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import Wordmark from '#lib/ui/Wordmark.svelte';

	let { data, form }: PageProps = $props();

	let pending = $state(false);

	const failure = $derived(form && 'error' in form ? form : null);
	const invited = $derived(form && 'invited' in form ? form.invited : null);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function statusLabel(user: UserRow): string {
		if (user.status === 'active') return 'Active';
		return user.invitedAt ? `Invited ${formatDate(user.invitedAt)}` : 'Invited';
	}
</script>

<svelte:head>
	<title>Admin · Match Sketch</title>
</svelte:head>

<div class="min-h-full bg-surface">
	<header class="bg-theme border-b-[3px] border-black">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
			<h1 class="m-0 mr-auto"><Wordmark /></h1>
			<Button href={resolve('/(app)')}>Home</Button>
		</div>
	</header>

	<main class="mx-auto grid max-w-4xl gap-8 px-4 py-8">
		<!-- Draft from text spend (spec §7.1 screen 7): drafting pauses for the day at the ceiling. -->
		{#if data.spend}
			<p class="m-0 text-sm">
				Model spend today: ${data.spend.todayUsd.toFixed(2)} of ${data.spend.ceilingUsd.toFixed(2)}
			</p>
		{/if}
		<section
			class="overflow-hidden rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#000]"
		>
			<PanelHeader title="Invite an MD" />
			<form
				class="grid gap-4 p-4"
				method="POST"
				action="?/invite"
				use:enhance={() => {
					pending = true;
					return async ({ update }) => {
						try {
							await update();
						} finally {
							pending = false;
						}
					};
				}}
			>
				<Field label="Email" id="invite-email">
					{#snippet children({ id, describedby })}
						<input
							{id}
							name="email"
							type="email"
							autocomplete="off"
							required
							aria-describedby={describedby}
							class={controlClass}
							value={failure?.email ?? ''}
						/>
					{/snippet}
				</Field>
				<Field label="Name (optional)" id="invite-display-name">
					{#snippet children({ id, describedby })}
						<input
							{id}
							name="displayName"
							type="text"
							maxlength="80"
							aria-describedby={describedby}
							class={controlClass}
						/>
					{/snippet}
				</Field>
				{#if invited}
					<p class="m-0 text-sm" role="status">Invite sent to {invited}.</p>
				{/if}
				{#if failure}
					<p class="m-0 text-sm text-danger" role="alert">{failure.error}</p>
				{/if}
				<div class="flex justify-end">
					<Button type="submit" variant="primary" disabled={pending}>Send invite</Button>
				</div>
				<p class="m-0 text-sm text-muted">
					They get an email with a link to choose a password. The link expires after an hour; after
					that they can use “Forgot your password?” on the sign-in page.
				</p>
			</form>
		</section>

		<section
			class="overflow-hidden rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#000]"
		>
			<PanelHeader title="Users" />
			{#if data.users.length}
				<div class="overflow-x-auto">
					<table class="w-full border-collapse text-left text-sm">
						<thead>
							<tr class="border-b-2 border-border">
								<th scope="col" class="px-4 py-2 font-semibold">Email</th>
								<th scope="col" class="px-4 py-2 font-semibold">Name</th>
								<th scope="col" class="px-4 py-2 font-semibold">Role</th>
								<th scope="col" class="px-4 py-2 font-semibold">Status</th>
							</tr>
						</thead>
						<tbody>
							{#each data.users as user (user.id)}
								<tr class="border-b-2 border-border last:border-b-0">
									<td class="px-4 py-2">{user.email}</td>
									<td class="px-4 py-2">{user.displayName}</td>
									<td class="px-4 py-2">{user.role}</td>
									<td class="px-4 py-2">{statusLabel(user)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="m-0 p-4 text-muted">No users yet.</p>
			{/if}
		</section>
	</main>
</div>
