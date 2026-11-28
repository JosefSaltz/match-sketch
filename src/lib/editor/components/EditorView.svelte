<script lang="ts">
	import { untrack } from 'svelte';
	import { playClick } from '#lib/audio/click.js';
	import { sounds } from '#lib/audio/sounds.svelte.js';
	import { getDb } from '#lib/store/index.js';
	import { clearJournal, writeJournal } from '#lib/store/journal.js';
	import type { PlanRecord } from '#lib/store/records.js';
	import { EditorState, type MatchContext, type NudgeDir } from '../editor-state.svelte.js';
	import { createPlanSaver } from '../plan-saver.js';
	import { panelDomId, type Panel } from '../panels.js';
	import { panels } from '../panels.svelte.js';
	import { commandForKey } from '../shortcuts.js';
	import Button from '#lib/ui/Button.svelte';
	import EditorCanvas from './EditorCanvas.svelte';
	import Palette from './Palette.svelte';
	import SidePanel from './SidePanel.svelte';
	import Toolbar from './Toolbar.svelte';

	let {
		plan,
		match = null,
		onstale
	}: {
		plan: PlanRecord;
		match?: MatchContext | null;
		/** A pull or conflict replaced the plan while it was open; the edit went to a copy. */
		onstale?: () => void;
	} = $props();

	// Saves never write over another device's version (see plan-saver.ts).
	const saver = untrack(() =>
		createPlanSaver({
			db: getDb(),
			planId: plan.id,
			base: plan.updatedAt,
			onStale: () => onstale?.()
		})
	);

	// The parent keys this component by plan id and version, so one EditorState per mount is right.
	const editor = untrack(
		() =>
			new EditorState(
				plan,
				{
					onGridCross: () => {
						if (sounds.on) playClick(sounds.click);
					},
					save: (doc, at) => saver.save(doc, at),
					setShare: (share) => saver.setShare(share),
					journal: {
						write: (doc, at) => writeJournal(localStorage, plan.id, doc, at, saver.bases),
						clear: () => clearJournal(localStorage, plan.id)
					}
				},
				match
			)
	);

	// A pull-down gesture on a phone would reload the page and drop the edit in progress.
	$effect(() => {
		const root = document.documentElement;
		const before = root.style.overscrollBehavior;
		root.style.overscrollBehavior = 'none';
		panels.reset(); // Drawers always start closed.
		return () => {
			root.style.overscrollBehavior = before;
			panels.reset();
		};
	});

	/**
	 * Escape closes an open drawer. It runs in the capture phase so the key is spent here, rather
	 * than also disarming the palette; a dialog or the Danger zones panel gets it first.
	 */
	function onEscapeCapture(e: KeyboardEvent) {
		if (e.key !== 'Escape' || panels.wide || !panels.drawer || e.defaultPrevented) return;
		if (document.querySelector('dialog:modal')) return;
		const inZones =
			e.target instanceof Element && e.target.closest('[data-danger-zones-control]') !== null;
		if (
			inZones &&
			document.querySelector('[data-danger-zones-control] [aria-label="Danger zones"]')
		)
			return;
		e.preventDefault();
		e.stopPropagation();
		panels.closeDrawer();
	}

	/** Editor shortcuts; keys typed into fields are left to the field (see commandForKey). */
	function onKeydown(e: KeyboardEvent) {
		// While a dialog (e.g. the theme picker) is open, keys belong to it, not the stage.
		if (document.querySelector('dialog:modal')) return;
		// A control that handled the key itself (e.g. the side panel's tabs) keeps it.
		if (e.defaultPrevented) return;
		const active = document.activeElement as HTMLElement | null;
		const command = commandForKey(e, {
			tagName: active?.tagName ?? 'BODY',
			isContentEditable: active?.isContentEditable ?? false
		});
		if (!command) return;
		if (e.repeat && command === 'duplicate') {
			e.preventDefault(); // Holding Ctrl+D makes one copy, not one per key repeat.
			return;
		}
		switch (command) {
			case 'delete':
				if (!editor.selection.length) return;
				editor.deleteSelected();
				break;
			case 'duplicate':
				editor.duplicateSelected();
				break;
			case 'deselect':
				editor.clearSelection();
				return;
			case 'undo':
				editor.undo();
				break;
			case 'redo':
				editor.redo();
				break;
			default:
				if (!editor.selection.length) return;
				editor.nudge(command.slice('nudge-'.length) as NudgeDir);
		}
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={onKeydown} onkeydowncapture={onEscapeCapture} />

{#snippet panelButton(panel: 'symbols' | 'inspector', side: string)}
	<!-- Over the canvas: on a narrow screen it opens the drawer; on a wide one it brings back a collapsed panel. -->
	{#if !panels.wide || !panels.isOpen(panel)}
		<Button
			class="absolute top-2 z-10 {side}"
			aria-expanded={panels.isOpen(panel)}
			aria-controls={panelDomId(panel)}
			data-panel-open={panel}
			onclick={() => panels.open(panel)}
		>
			<svg
				class="size-4 flex-none fill-none stroke-current stroke-2"
				viewBox="0 0 16 16"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				{#if panel === 'symbols'}
					<!-- A square, a circle and a triangle: the symbol library, not the menu's three bars. -->
					<rect x="2" y="2" width="5" height="5" />
					<circle cx="11.5" cy="4.5" r="2.5" />
					<path d="M4.5 9.5 7 14H2zM9 9.5h5V14H9z" />
				{:else}
					<path d="M2.5 3h11v10h-11zM10 3v10" />
				{/if}
			</svg>
			{panel === 'symbols' ? 'Symbols' : 'Inspector'}
		</Button>
	{/if}
{/snippet}

{#snippet drawer(panel: Panel, side: 'left' | 'right')}
	<!-- One element per panel: the grid column on a wide screen, the slide-over drawer on a narrow one. -->
	{@const open = panels.isOpen(panel)}
	<div
		id={panelDomId(panel)}
		class={[
			// Visibility flips after the slide out (and before the slide in), so a closed panel leaves
			// the accessibility tree and tab order without cutting the animation short.
			'flex min-h-0 transition-[translate,visibility] duration-250 ease-drawer max-lg:fixed max-lg:inset-y-0 max-lg:z-40 lg:overflow-hidden motion-reduce:transition-none',
			!open && 'invisible',
			side === 'left'
				? 'max-lg:left-0 max-lg:w-[min(20rem,88vw)] lg:justify-end'
				: 'max-lg:right-0 max-lg:w-[min(22rem,calc(100vw-1rem))] lg:justify-start',
			open
				? side === 'left'
					? 'max-lg:shadow-[6px_0_0_#000]'
					: 'max-lg:shadow-[-6px_0_0_#000]'
				: side === 'left'
					? 'max-lg:-translate-x-full'
					: 'max-lg:translate-x-full'
		]}
		inert={!open}
	>
		{#if panel === 'symbols'}
			<Palette {editor} />
		{:else}
			<SidePanel {editor} />
		{/if}
	</div>
{/snippet}

<div class="grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-x-clip">
	<Toolbar {editor} />
	<!-- Wide: three columns, a collapsed one shrinks to 0 and its panel slides out. Narrow: the stage alone. -->
	<div
		class="grid min-h-0 grid-cols-1 [--inspector-w:20.75rem] lg:grid-cols-[var(--left)_minmax(0,1fr)_var(--right)] lg:transition-[grid-template-columns] lg:duration-250 lg:ease-drawer motion-reduce:transition-none xl:[--inspector-w:21rem]"
		style:--left={panels.wide && !panels.isOpen('symbols') ? '0px' : '16rem'}
		style:--right={panels.wide && !panels.isOpen('inspector') ? '0px' : 'var(--inspector-w)'}
	>
		{@render drawer('symbols', 'left')}
		<div class="relative min-h-0 min-w-0">
			<EditorCanvas {editor} />
			{@render panelButton('symbols', 'left-2')}
			{@render panelButton('inspector', 'right-2')}
		</div>
		{@render drawer('inspector', 'right')}
	</div>
</div>

<!-- Tap outside a drawer to close it. Not hit-testable once closed, so a palette drop reaches the stage. -->
<button
	type="button"
	tabindex="-1"
	aria-hidden="true"
	class={[
		'fixed inset-0 z-30 cursor-default border-0 bg-black/40 p-0 transition-opacity duration-250 ease-drawer motion-reduce:transition-none lg:hidden',
		panels.drawer && !panels.wide ? 'opacity-100' : 'pointer-events-none opacity-0'
	]}
	onclick={() => panels.closeDrawer()}
></button>
