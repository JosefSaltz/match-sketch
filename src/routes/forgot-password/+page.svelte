<script lang="ts">
	import { isAuthRetryableFetchError } from '@supabase/supabase-js';
	import { resolve } from '$app/paths';
	import { getSupabase } from '#lib/auth/client.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import PanelHeader from '#lib/ui/PanelHeader.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import Wordmark from '#lib/ui/Wordmark.svelte';

	const OFFLINE_MESSAGE = "Can't reach the server. Check your connection.";

	let email = $state('');
	let pending = $state(false);
	let message = $state('');
	let sentTo = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		pending = true;
		message = '';
		sentTo = '';
		const submitted = email;
		try {
			const { error } = await getSupabase().auth.resetPasswordForEmail(submitted);
			if (error && isAuthRetryableFetchError(error)) message = OFFLINE_MESSAGE;
			else if (error?.code === 'over_email_send_rate_limit')
				message = 'Too many emails were sent. Try again in an hour.';
			else sentTo = submitted;
		} catch (e) {
			if (e instanceof TypeError) message = OFFLINE_MESSAGE;
			else sentTo = submitted;
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>Reset password · Match Sketch</title>
</svelte:head>

<div class="grid min-h-full place-items-center bg-surface px-4 py-8">
	<div class="grid w-full max-w-sm gap-5">
		<h1 class="m-0 flex justify-center"><Wordmark /></h1>

		<div
			class="overflow-hidden rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#000]"
		>
			<PanelHeader title="Reset your password" />
			<form class="grid gap-4 p-4" onsubmit={submit}>
				<p class="m-0 text-sm">
					Enter your account's email. We'll send a link to choose a new password.
				</p>
				<Field label="Email" id="forgot-password-email">
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
				{#if message}
					<p class="m-0 text-sm text-danger" role="alert">{message}</p>
				{/if}
				{#if sentTo}
					<p class="m-0 text-sm" role="status">
						If {sentTo} has an account, a reset link is on its way. It works once, within an hour.
					</p>
				{/if}
				<div class="flex justify-end">
					<Button type="submit" variant="primary" disabled={pending}>Send reset link</Button>
				</div>
			</form>
		</div>

		<p class="m-0 text-center text-sm">
			<a href={resolve('/sign-in')} class="underline">Back to sign in</a>
		</p>
	</div>
</div>
