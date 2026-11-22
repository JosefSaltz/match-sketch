<script lang="ts">
	import Dialog from '#lib/components/Dialog.svelte';
	import { getDb } from '#lib/store/index.js';
	import Button from '#lib/ui/Button.svelte';
	import CreditsDialog from './CreditsDialog.svelte';
	import { setSetting, THEME_SETTING } from '#lib/store/settings.js';
	import { applyTheme } from './apply.js';
	import { currentTheme } from './current.svelte.js';
	import { THEMES, type Theme, type ThemeFamily } from './themes.js';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let showingCredits = $state(false);

	const uid = $props.id();
	const FAMILIES: { family: ThemeFamily; label: string }[] = [
		{ family: 'solid', label: 'Solid' },
		{ family: 'plaid', label: 'Plaid' },
		{ family: 'camo', label: 'Camo' }
	];
	const groups = FAMILIES.map((f) => ({
		...f,
		themes: THEMES.filter((t) => t.family === f.family)
	})).filter((g) => g.themes.length);

	/** Applies at once and stays open, so themes can be compared. */
	function choose(theme: Theme) {
		applyTheme(theme, document.documentElement);
		currentTheme.id = theme.id;
		setSetting(getDb(), THEME_SETTING, theme.id).catch((err: unknown) => {
			// The theme still applies for this visit; it just won't be remembered.
			console.error('Could not save the theme', err);
		});
	}
</script>

{#if open}
	<Dialog title="Theme" onclose={() => (open = false)}>
		{#each groups as g (g.family)}
			<div role="group" aria-labelledby="{uid}-{g.family}" class="grid gap-2">
				<h3 id="{uid}-{g.family}" class="m-0 text-sm font-semibold text-muted">{g.label}</h3>
				<div class="flex flex-wrap gap-3">
					{#each g.themes as t (t.id)}
						<button
							type="button"
							aria-pressed={t.id === currentTheme.id}
							class={[
								'focus-ring grid min-h-11 w-24 cursor-pointer justify-items-center gap-1 rounded-lg border-2 p-1 text-xs',
								t.id === currentTheme.id ? 'border-black bg-surface' : 'border-transparent'
							]}
							onclick={() => choose(t)}
						>
							<span
								class="block h-10 w-20 rounded-md border-2 border-black"
								style:background-color={t.base}
								style:background-image={t.tile ? `url("${t.tile.src}")` : 'none'}
								style:background-size={t.tile ? `${t.tile.width / 4}px auto` : 'auto'}
							></span>
							<span>{t.name}</span>
						</button>
					{/each}
				</div>
			</div>
		{/each}
		<div class="flex justify-end gap-3">
			<Button onclick={() => (showingCredits = true)}>Credits</Button>
			<Button onclick={() => (open = false)}>Done</Button>
		</div>
	</Dialog>
{/if}
<CreditsDialog bind:open={showingCredits} />
