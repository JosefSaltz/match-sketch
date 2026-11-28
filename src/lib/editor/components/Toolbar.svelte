<script lang="ts">
	import { FEATURE_DRAFT_FROM_TEXT } from '$app/env/public';
	import { resolve } from '$app/paths';
	import { sounds } from '#lib/audio/sounds.svelte.js';
	import { gridChoice, guideOptions } from '#lib/geometry/grid.js';
	import { getDb } from '#lib/store/index.js';
	import { setSetting, SOUNDS_SETTING, ZONE_UNIT_SETTING } from '#lib/store/settings.js';
	import type { ZoneUnit } from '#lib/safety/paths.js';
	import { zoneUnit } from '#lib/safety/zone-unit.svelte.js';
	import type { SnapSetting } from '#lib/geometry/snap.js';
	import { formatDimensions } from '#lib/geometry/units.js';
	import type { SymbolSize } from '#lib/model/plan.js';
	import { syncState } from '#lib/sync/loop.svelte.js';
	import SyncStatus from '#lib/sync/SyncStatus.svelte';
	import ThemePicker from '#lib/theme/ThemePicker.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Toggle from '#lib/ui/Toggle.svelte';
	import { LAYER_IDS, layerSource } from '#lib/safety/sources.js';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import type { EditorState } from '../editor-state.svelte.js';
	import DraftDialog from './DraftDialog.svelte';
	import ShareDialog from '#lib/components/ShareDialog.svelte';
	import { shareUrl } from '#lib/model/share.js';
	import type { ShareAction } from '#lib/store/share.js';
	import { displaySteps } from '#lib/model/procedure.js';
	import PanelHeader from '#lib/ui/PanelHeader.svelte';
	import { panelDomId } from '../panels.js';
	import { panels } from '../panels.svelte.js';
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
	const FIELD = 'inline-flex items-center gap-2 max-lg:justify-between';
	// The white drawer on a narrow screen takes dark text; the outline lettering is for the themed bar.
	const LABEL =
		'font-display text-xs tracking-wide uppercase text-outline-sm max-lg:text-text max-lg:[text-shadow:none]';
	const SECTION =
		'max-lg:m-0 max-lg:text-xs max-lg:font-bold max-lg:tracking-wider max-lg:text-muted max-lg:uppercase lg:hidden';
	/** In the menu drawer a section stacks its controls; in the wide bar it dissolves into it. */
	const GROUP = 'max-lg:grid max-lg:gap-2 lg:contents';
	/** Selects follow the button rule on a patterned bar: white, bordered, touch-sized. */
	const SELECT =
		'focus-ring min-h-11 cursor-pointer rounded-[10px] border-[3px] border-black bg-white px-2 text-sm font-semibold shadow-[3px_3px_0_#000]';

	let pickingTheme = $state(false);
	let drafting = $state(false);
	let sharing = $state(false);
	let presenting = $state(false);
	let zonesOpen = $state(false);
	/** A press anywhere outside the Danger zones control closes its panel. */
	function closeZonesOutside(e: PointerEvent) {
		const target = e.target;
		if (zonesOpen && target instanceof Element && !target.closest('[data-danger-zones-control]')) {
			zonesOpen = false;
		}
	}
	/** Opening a dialog from the menu drawer: the drawer steps aside first. */
	function from(action: () => void) {
		return () => {
			panels.closeDrawer(false);
			action();
		};
	}
	const menuOpen = $derived(panels.isOpen('menu'));
	const hasSteps = $derived(displaySteps(editor.doc.brief.steps).length > 0);

	/** The unit danger zone tags use on this device (remembered like the theme). */
	function setZoneUnit(unit: ZoneUnit) {
		zoneUnit.value = unit;
		setSetting(getDb(), ZONE_UNIT_SETTING, unit).catch(console.error);
	}

	/** Drag clicks on or off for this device (remembered like the theme). */
	function toggleSounds() {
		sounds.on = !sounds.on;
		setSetting(getDb(), SOUNDS_SETTING, sounds.on ? 'on' : 'off').catch(console.error);
	}
</script>

<header
	class="bg-theme flex items-center gap-x-3 gap-y-2 border-b-[3px] border-black px-3 py-2 lg:flex-wrap"
>
	<a
		href={resolve('')}
		class="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg max-lg:w-11 max-lg:border-[3px] max-lg:border-black max-lg:bg-white max-lg:shadow-[3px_3px_0_#000]"
		aria-label="Match Sketch"
	>
		<span class="inline-flex max-lg:hidden"><Wordmark size="compact" /></span>
		<svg
			class="size-6 fill-none stroke-black stroke-2 lg:hidden"
			viewBox="0 0 24 24"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5V14h4v5.5" />
		</svg>
	</a>
	<div class="grid min-w-0 flex-1 leading-tight lg:mr-auto lg:flex-none">
		<span class="truncate font-display text-lg tracking-wide uppercase text-outline-md">
			{editor.title}
		</span>
		<span class="truncate font-display text-xs tracking-wide uppercase text-outline-sm">
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
	<!-- Not rendered on a wide screen: the controls are in the bar there. -->
	{#if !panels.wide}
		<Button
			variant="icon"
			class="relative"
			aria-label="Menu"
			title="Menu"
			aria-expanded={panels.isOpen('menu')}
			aria-controls={panelDomId('menu')}
			data-panel-open="menu"
			onclick={() => panels.open('menu')}
		>
			<svg
				class="size-6 fill-none stroke-current stroke-2"
				viewBox="0 0 24 24"
				stroke-linecap="round"
				aria-hidden="true"
			>
				<path d="M4 7h16M4 12h16M4 17h16" />
			</svg>
			{#if editor.saveStatus === 'error'}
				<!-- The save status lives in the closed menu; the dot keeps a failed save in view. -->
				<span
					class="absolute -top-1.5 -right-1.5 size-4 rounded-full border-2 border-white bg-danger"
					aria-hidden="true"
				></span>
			{/if}
		</Button>
	{/if}
	<!-- Dissolves into the bar on a wide screen; on a narrow one it is the menu drawer. -->
	<div
		id={panelDomId('menu')}
		class={[
			'lg:contents',
			'max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:flex max-lg:w-[min(20rem,88vw)] max-lg:flex-col max-lg:overflow-y-auto max-lg:border-l-[3px] max-lg:border-black max-lg:bg-white max-lg:text-text',
			'max-lg:transition-[translate,visibility] max-lg:duration-250 max-lg:ease-drawer motion-reduce:transition-none',
			// Hidden once slid away, so the closed menu leaves the accessibility tree and tab order.
			menuOpen ? 'max-lg:shadow-[-6px_0_0_#000]' : 'max-lg:invisible max-lg:translate-x-full'
		]}
		role={panels.wide ? undefined : 'group'}
		aria-label={panels.wide ? undefined : 'Menu'}
		inert={!panels.wide && !menuOpen}
	>
		{#if !panels.wide}
			<PanelHeader title="Menu">
				{#snippet actions()}
					<Button
						variant="icon"
						aria-label="Close menu"
						title="Close menu"
						data-panel-close="menu"
						aria-expanded={menuOpen}
						aria-controls={panelDomId('menu')}
						onclick={() => panels.close('menu')}
					>
						<svg
							class="size-5 fill-none stroke-current stroke-2"
							viewBox="0 0 24 24"
							stroke-linecap="round"
							aria-hidden="true"
						>
							<path d="M6 6l12 12M18 6 6 18" />
						</svg>
					</Button>
				{/snippet}
			</PanelHeader>
		{/if}
		<section class={['max-lg:border-b-2 max-lg:border-border max-lg:p-3', GROUP]}>
			<h3 class={SECTION}>Status</h3>
			<span
				class={[
					// Fixed width (fits the longest message) so saving never re-wraps the bar and shifts the stage.
					'inline-flex min-h-8 w-44 items-center justify-center rounded-md border-2 border-black bg-white px-2 text-sm max-lg:w-full',
					editor.saveStatus === 'error' ? 'font-semibold text-danger' : 'text-muted'
				]}
				data-testid="save-status"
				role="status"
			>
				{SAVE_LABEL[editor.saveStatus]}
			</span>
		</section>
		<section class={['max-lg:border-b-2 max-lg:border-border max-lg:p-3', GROUP]}>
			<h3 class={SECTION}>View</h3>
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
				<Button
					variant="icon"
					aria-label="Zoom in"
					title="Zoom in"
					onclick={() => editor.zoomBy(1.25)}
				>
					+
				</Button>
				<Button class="max-lg:flex-1" onclick={() => editor.fit()}>Fit</Button>
			</div>
			<Button
				variant="icon"
				class="max-lg:w-full"
				aria-label="Sounds"
				aria-pressed={sounds.on}
				title={sounds.on ? 'Drag clicks on' : 'Drag clicks off'}
				onclick={toggleSounds}
			>
				{sounds.on ? '🔊' : '🔇'}
				<!-- The menu drawer has room to say what the icon means. -->
				<span class="lg:hidden">{sounds.on ? 'Drag clicks on' : 'Drag clicks off'}</span>
			</Button>
			<div
				class="relative"
				data-danger-zones-control
				onkeydown={(e) => {
					if (zonesOpen && e.key === 'Escape') {
						e.stopPropagation();
						zonesOpen = false;
						// The focused toggle goes away with the panel; keep focus on the control.
						document.getElementById(`${uid}-zones-button`)?.focus();
					}
				}}
				role="presentation"
			>
				<Button
					id="{uid}-zones-button"
					class="max-lg:w-full"
					aria-expanded={zonesOpen}
					aria-controls="{uid}-zones"
					onclick={() => (zonesOpen = !zonesOpen)}
				>
					Danger zones
				</Button>
				{#if zonesOpen}
					<!-- In the drawer the panel opens inline; a floating one would be clipped by its scroll. -->
					<div
						id="{uid}-zones"
						role="group"
						aria-label="Danger zones"
						class="absolute top-full right-0 z-30 mt-2 grid gap-1 rounded-lg border-[3px] border-black bg-white p-3 shadow-[3px_3px_0_#000] max-lg:static max-lg:w-full"
					>
						{#each LAYER_IDS as id (id)}
							<Toggle label={layerSource(id).label} bind:checked={editor.dangerZones[id]} />
						{/each}
						<label class="mt-1 inline-flex items-center gap-2 text-sm">
							Distances
							<select
								class={SELECT}
								value={zoneUnit.value}
								onchange={(e) => setZoneUnit(e.currentTarget.value as ZoneUnit)}
							>
								<option value="yd">Yards</option>
								<option value="m">Meters</option>
							</select>
						</label>
					</div>
				{/if}
			</div>
		</section>
		<section class={['max-lg:border-b-2 max-lg:border-border max-lg:p-3', GROUP]}>
			<h3 class={SECTION}>Stage</h3>
			<Button
				class="max-lg:w-full"
				disabled={!hasSteps}
				title={hasSteps ? undefined : 'Write the stage procedure first.'}
				onclick={from(() => (presenting = true))}
			>
				Present
			</Button>
			<Button class="max-lg:w-full" onclick={from(() => (sharing = true))}>Share</Button>
			<Button
				class="max-lg:w-full"
				href={resolve('/(app)/plans/[id]/print', { id: editor.plan.id })}
			>
				Print
			</Button>
			{#if FEATURE_DRAFT_FROM_TEXT}
				<Button
					class="max-lg:w-full"
					disabled={!syncState.online}
					title={syncState.online ? undefined : 'Drafting needs a connection.'}
					onclick={from(() => (drafting = true))}
				>
					Draft from text
				</Button>
				{#if !syncState.online}
					<span class="text-xs text-outline-sm max-lg:text-muted max-lg:[text-shadow:none]">
						Drafting needs a connection.
					</span>
				{/if}
			{/if}
		</section>
		<section class={['max-lg:p-3', GROUP]}>
			<h3 class={SECTION}>App</h3>
			<div class="flex items-center gap-2 max-lg:justify-between">
				<SyncStatus />
			</div>
			<Button class="max-lg:w-full" onclick={from(() => (pickingTheme = true))}>Theme</Button>
		</section>
	</div>
</header>
<svelte:window onpointerdown={closeZonesOutside} />
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
