<script lang="ts">
	import { isAuthRetryableFetchError } from '@supabase/supabase-js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getSupabase } from '#lib/auth/client.js';
	import { checkNewPassword } from '#lib/auth/password.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import PanelHeader from '#lib/ui/PanelHeader.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import Wordmark from '#lib/ui/Wordmark.svelte';

	const OFFLINE_MESSAGE = "Can't reach the server. Check your connection.";

	const mode = page.url.searchParams.get('type') === 'recovery' ? 'recovery' : 'invite';

	// Verifying needs a click, so email scanners that prefetch the link can't use up the token.
	const tokenHash = page.url.searchParams.get('token_hash') ?? '';

	let step = $state<'accept' | 'password' | 'bad'>(tokenHash ? 'accept' : 'bad');
	let password = $state('');
	let confirm = $state('');
	let pending = $state(false);
	let message = $state('');

	async function accept() {
		if (pending) return;
		pending = true;
		message = '';
		try {
			const { error } = await getSupabase().auth.verifyOtp({
				token_hash: tokenHash,
				type: mode
			});
			if (error) {
				if (isAuthRetryableFetchError(error)) {
					message = OFFLINE_MESSAGE;
				} else {
					// The user may already have verified this link in this browser, for example before a reload.
					const { data } = await getSupabase().auth.getSession();
					step = data.session ? 'password' : 'bad';
				}
				return;
			}
			step = 'password';
		} catch (e) {
			if (e instanceof TypeError) message = OFFLINE_MESSAGE;
			else step = 'bad';
		} finally {
			pending = false;
		}
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		const problem = checkNewPassword(password, confirm);
		if (problem) {
			message = problem;
			return;
		}
		pending = true;
		message = '';
		try {
			const { error } = await getSupabase().auth.updateUser({ password });
			if (error) {
				message = isAuthRetryableFetchError(error) ? OFFLINE_MESSAGE : error.message;
				return;
			}
			await goto(resolve('/(app)'));
		} catch (e) {
			message =
				e instanceof TypeError ? OFFLINE_MESSAGE : e instanceof Error ? e.message : String(e);
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>{mode === 'recovery' ? 'Reset password' : 'Accept invite'} · Match Sketch</title>
</svelte:head>

<div class="grid min-h-full place-items-center bg-surface px-4 py-8">
	<div class="grid w-full max-w-sm gap-5">
		<h1 class="m-0 flex justify-center"><Wordmark /></h1>

		<div
			class="overflow-hidden rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#000]"
		>
			{#if step === 'accept'}
				<PanelHeader title={mode === 'recovery' ? 'Reset your password' : 'Accept your invite'} />
				<div class="grid gap-4 p-4">
					<p class="m-0 text-sm">
						{#if mode === 'recovery'}
							Continue to choose a new password for your account.
						{:else}
							You've been invited to Match Sketch. Accept the invite, then choose your password.
						{/if}
					</p>
					{#if message}
						<p class="m-0 text-sm text-danger" role="alert">{message}</p>
					{/if}
					<div class="flex justify-end">
						<Button type="button" variant="primary" disabled={pending} onclick={accept}>
							{mode === 'recovery' ? 'Continue' : 'Accept invite'}
						</Button>
					</div>
				</div>
			{:else if step === 'password'}
				<PanelHeader title="Set your password" />
				<form class="grid gap-4 p-4" onsubmit={submit}>
					<Field label="New password" id="accept-invite-password">
						{#snippet children({ id, describedby })}
							<input
								{id}
								type="password"
								autocomplete="new-password"
								required
								aria-describedby={describedby}
								class={controlClass}
								bind:value={password}
							/>
						{/snippet}
					</Field>
					<Field label="Confirm password" id="accept-invite-confirm">
						{#snippet children({ id, describedby })}
							<input
								{id}
								type="password"
								autocomplete="new-password"
								required
								aria-describedby={describedby}
								class={controlClass}
								bind:value={confirm}
							/>
						{/snippet}
					</Field>
					{#if message}
						<p class="m-0 text-sm text-danger" role="alert">{message}</p>
					{/if}
					<div class="flex justify-end">
						<Button type="submit" variant="primary" disabled={pending}>Set password</Button>
					</div>
				</form>
			{:else}
				<PanelHeader title={mode === 'recovery' ? 'Reset your password' : 'Accept your invite'} />
				<div class="grid gap-4 p-4">
					<p class="m-0 text-sm text-danger" role="alert">
						This link has expired or was already used.
					</p>
					<p class="m-0 text-sm text-muted">Reset your password to get a new link, or sign in.</p>
					<div class="flex justify-end gap-2">
						<Button href={resolve('/forgot-password')} variant="primary">
							Reset your password
						</Button>
						<Button href={resolve('/sign-in')} variant="secondary">Sign in</Button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
