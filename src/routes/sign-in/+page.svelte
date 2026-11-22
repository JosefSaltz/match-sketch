<script lang="ts">
	import { isAuthRetryableFetchError } from '@supabase/supabase-js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getSupabase } from '#lib/auth/client.js';
	import { safeNext } from '#lib/auth/session.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import PanelHeader from '#lib/ui/PanelHeader.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import Wordmark from '#lib/ui/Wordmark.svelte';

	const OFFLINE_MESSAGE = "Can't reach the server. Check your connection.";

	let email = $state('');
	let password = $state('');
	let pending = $state(false);
	let message = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		pending = true;
		message = '';
		try {
			const { error } = await getSupabase().auth.signInWithPassword({ email, password });
			if (error) {
				message =
					error.code === 'invalid_credentials'
						? 'Wrong email or password.'
						: isAuthRetryableFetchError(error)
							? OFFLINE_MESSAGE
							: error.message;
				return;
			}
			// safeNext only returns a same-site path, which resolve() can't type-check. A path that
			// matches no page makes goto throw; signing in still worked, so go home instead.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(safeNext(page.url.searchParams.get('next'))).catch(() => goto(resolve('/(app)')));
		} catch (e) {
			message =
				e instanceof TypeError ? OFFLINE_MESSAGE : e instanceof Error ? e.message : String(e);
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in · Match Sketch</title>
</svelte:head>

<div class="grid min-h-full place-items-center bg-surface px-4 py-8">
	<div class="grid w-full max-w-sm gap-5">
		<h1 class="m-0 flex justify-center"><Wordmark /></h1>

		<div
			class="overflow-hidden rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#000]"
		>
			<PanelHeader title="Sign in" />
			<form class="grid gap-4 p-4" onsubmit={submit}>
				<Field label="Email" id="sign-in-email">
					{#snippet children({ id, describedby })}
						<input
							{id}
							type="email"
							autocomplete="username"
							required
							aria-describedby={describedby}
							class={controlClass}
							bind:value={email}
						/>
					{/snippet}
				</Field>
				<Field label="Password" id="sign-in-password">
					{#snippet children({ id, describedby })}
						<input
							{id}
							type="password"
							autocomplete="current-password"
							required
							aria-describedby={describedby}
							class={controlClass}
							bind:value={password}
						/>
					{/snippet}
				</Field>
				{#if message}
					<p class="m-0 text-sm text-danger" role="alert">{message}</p>
				{/if}
				<div class="flex items-center justify-between">
					<a href={resolve('/forgot-password')} class="text-sm underline">Forgot your password?</a>
					<Button type="submit" variant="primary" disabled={pending}>Sign in</Button>
				</div>
			</form>
		</div>

		<p class="m-0 text-center text-sm text-muted">
			Accounts are by invite only. Ask your match's admin for an invite.
		</p>
	</div>
</div>
