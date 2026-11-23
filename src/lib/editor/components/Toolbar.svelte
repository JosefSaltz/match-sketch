<script lang="ts">
	import { FEATURE_DRAFT_FROM_TEXT } from '$app/env/public';
	import { resolve } from '$app/paths';
	import { sounds } from '#lib/audio/sounds.svelte.js';
	import { gridChoice, guideOptions } from '#lib/geometry/grid.js';
	import { getDb } from '#lib/store/index.js';
	import { setSetting, SOUNDS_SETTING } from '#lib/store/settings.js';
	import type { SnapSetting } from '#lib/geometry/snap.js';
	import { formatDimensions } from '#lib/geometry/units.js';
	import type { SymbolSize } from '#lib/model/plan.js';
	import { syncState } from '#lib/sync/loop.svelte.js';
	import SyncStatus from '#lib/sync/SyncStatus.svelte';
	import ThemePicker from '#lib/theme/ThemePicker.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import type { EditorState } from '../editor-state.svelte.js';
	import DraftDialog from './DraftDialog.svelte';
	import ShareDialog from '#lib/components/ShareDialog.svelte';
	import { shareUrl } from '#lib/model/share.js';
	import type { ShareAction } from '#lib/store/share.js';
	import { displaySteps } from '#lib/model/procedure.js';
	import PresentDialog from '#lib/walkthrough/PresentDialog.svelte';

	let { editor }: { editor: EditorState } = $props();

	const uid = $props.id();
	const SAVE_LABEL = { saving: 'Saving…', saved: 'Saved', error: 'Not saved — retrying' } as const;
	const SNAP_OPTIONS: { value: SnapSetting; label: string }[] = [
		{ value: 'off', label: 'Off' },
		{ value: '1ft', label: '1 ft' },
		{ value: '1yd', label: '1 yd' },
		{ value: '5yd', label: '5 yd' }
	];
	const SIZE_OPTIONS: { value: SymbolSize; label: string }[] = [
		{ value: 'small', label: 'Small' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'large', label: 'Large' },
		{ value: 'xlarge', label: 'Extra large' }
	];
	const FIELD = 'inline-flex items-center gap-2';
	const LABEL = 'font-display text-xs tracking-wide uppercase text-outline-sm';
	/** Selects follow the button rule on a patterned bar: white, bordered, touch-sized. */
	const SELECT =
		'focus-ring min-h-11 cursor-pointer rounded-[10px] border-[3px] border-black bg-white px-2 text-sm font-semibold shadow-[3px_3px_0_#000]';

	let pickingTheme = $state(false);
	let drafting = $state(false);
	let sharing = $state(false);
	let presenting = $state(false);
	const hasSteps = $derived(displaySteps(editor.doc.brief.steps).length > 0);

	/** Drag clicks on or off for this device (remembered like the theme). */
	function toggleSounds() {
		sounds.on = !sounds.on;
		setSetting(getDb(), SOUNDS_SETTING, sounds.on ? 'on' : 'off').catch(console.error);
	}
</script>

<header
	class="bg-theme flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-black px-3 py-2"
>
	<a
		href={resolve('')}
		class="focus-ring inline-flex min-h-11 shrink-0 items-center rounded-lg"
		aria-label="Match Sketch"
	>
		<Wordmark size="compact" />
	</a>
	<div class="mr-auto grid min-w-0 leading-tight">
		<span class="truncate font-display text-lg tracking-wide uppercase text-outline-md">
			{editor.title}
		</span>
		<span class="font-display text-xs tracking-wide uppercase text-outline-sm">
			{formatDimensions(editor.canvas.widthFt, editor.canvas.depthFt, editor.plan.unit)}
		</span>
	</div>
	<div class="flex items-center gap-2" role="group" aria-label="History">
		<Button
			variant="icon"
			aria-label="Undo"
			title="Undo"
			onclick={() => editor.undo()}
			disabled={!editor.canUndo}
		>
			↶
		</Button>
		<Button
			variant="icon"
			aria-label="Redo"
			title="Redo"
			onclick={() => editor.redo()}
			disabled={!editor.canRedo}
		>
			↷
		</Button>
	</div>
	<span
		class={[
			// Fixed width (fits the longest message) so saving never re-wraps the bar and shifts the stage.
			'inline-flex min-h-8 w-44 items-center justify-center rounded-md border-2 border-black bg-white px-2 text-sm',
			editor.saveStatus === 'error' ? 'font-semibold text-danger' : 'text-muted'
		]}
		data-testid="save-status"
		role="status"
	>
		{SAVE_LABEL[editor.saveStatus]}
	</span>
	<div class={FIELD}>
		<label for="{uid}-snap" class={LABEL}>Snap</label>
		<select
			id="{uid}-snap"
			class={SELECT}
			value={editor.doc.display.snap}
			onchange={(e) => editor.setDisplay({ snap: e.currentTarget.value as SnapSetting })}
		>
			{#each SNAP_OPTIONS as o (o.value)}
				<option value={o.value}>{o.label}</option>
			{/each}
		</select>
	</div>
	<div class={FIELD}>
		<label for="{uid}-grid" class={LABEL}>Grid</label>
		<select
			id="{uid}-grid"
			class={SELECT}
			value={String(gridChoice(editor.doc.display))}
			onchange={(e) => {
				const v = e.currentTarget.value;
				editor.setGrid(v === 'off' || v === 'fine' ? v : Number(v));
			}}
		>
			<option value="off">Off</option>
			<option value="fine">Fine</option>
			{#each guideOptions(editor.plan.unit) as o (o.ft)}
				<option value={String(o.ft)}>{o.label}</option>
			{/each}
		</select>
	</div>
	<div class={FIELD}>
		<label for="{uid}-size" class={LABEL}>Symbol size</label>
		<select
			id="{uid}-size"
			class={SELECT}
			value={editor.doc.display.symbolSize}
			onchange={(e) => editor.setDisplay({ symbolSize: e.currentTarget.value as SymbolSize })}
		>
			{#each SIZE_OPTIONS as o (o.value)}
				<option value={o.value}>{o.label}</option>
			{/each}
		</select>
	</div>
	<div class="flex items-center gap-2" role="group" aria-label="View">
		<Button
			variant="icon"
			aria-label="Zoom out"
			title="Zoom out"
			onclick={() => editor.zoomBy(1 / 1.25)}
		>
			−
		</Button>
		<Button variant="icon" aria-label="Zoom in" title="Zoom in" onclick={() => editor.zoomBy(1.25)}>
			+
		</Button>
		<Button onclick={() => editor.fit()}>Fit</Button>
	</div>
	<Button
		variant="icon"
		aria-label="Sounds"
		aria-pressed={sounds.on}
		title={sounds.on ? 'Drag clicks on' : 'Drag clicks off'}
		onclick={toggleSounds}
	>
		{sounds.on ? '🔊' : '🔇'}
	</Button>
	<Button
		disabled={!hasSteps}
		title={hasSteps ? undefined : 'Write the stage procedure first.'}
		onclick={() => (presenting = true)}
	>
		Present
	</Button>
	<Button onclick={() => (sharing = true)}>Share</Button>
	<Button href={resolve('/(app)/plans/[id]/print', { id: editor.plan.id })}>Print</Button>
	{#if FEATURE_DRAFT_FROM_TEXT}
		<Button
			disabled={!syncState.online}
			title={syncState.online ? undefined : 'Drafting needs a connection.'}
			onclick={() => (drafting = true)}
		>
			Draft from text
		</Button>
		{#if !syncState.online}
			<span class="text-xs text-outline-sm">Drafting needs a connection.</span>
		{/if}
	{/if}
	<SyncStatus />
	<Button onclick={() => (pickingTheme = true)}>Theme</Button>
</header>
<ThemePicker bind:open={pickingTheme} />
{#if presenting}
	<PresentDialog
		doc={editor.doc}
		canvas={editor.canvas}
		unit={editor.plan.unit}
		depth={editor.depth}
		title={editor.title}
		onclose={() => (presenting = false)}
	/>
{/if}
{#if sharing}
	<ShareDialog
		title="Share stage"
		share={editor.share}
		link={editor.share ? shareUrl(location.origin, editor.share.id) : null}
		onaction={(action: ShareAction) => void editor.changeShare(action).catch(console.error)}
		onclose={() => (sharing = false)}
	/>
{/if}
{#if FEATURE_DRAFT_FROM_TEXT && drafting}
	<DraftDialog {editor} onclose={() => (drafting = false)} />
{/if}
