<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { paletteGroups, type CatalogEntry, type FootprintEntry } from '#lib/catalog/index.js';
	import type { Point } from '#lib/geometry/types.js';
	import type { AnnotationTool, EditorState } from '../editor-state.svelte.js';
	import PanelHeader from '#lib/ui/PanelHeader.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import FootprintShape from '#lib/ui/FootprintShape.svelte';
	import { movedBeyond } from '../gestures.js';
	import { DragSwing } from '../swing.svelte.js';

	let { editor }: { editor: EditorState } = $props();

	const uid = $props.id();
	const TOGGLE =
		'focus-ring flex min-h-11 w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-2 text-left';

	/** Annotation tools, armed like symbols: tap (text) or drag (arrow, measure) on the stage. */
	const TOOLS: { id: AnnotationTool; name: string }[] = [
		{ id: 'text', name: 'Text label' },
		{ id: 'arrow', name: 'Movement arrow' },
		{ id: 'measure', name: 'Measure' }
	];

	let query = $state('');
	const groups = $derived(paletteGroups(query));
	const searching = $derived(query.trim() !== '');

	// Collapsed groups while browsing, and separately while searching (reset on every edit),
	// so a search opens every match without forgetting what the user had collapsed.
	const collapsed = new SvelteSet<string>();
	const collapsedInSearch = new SvelteSet<string>();

	function isOpen(key: string): boolean {
		return !(searching ? collapsedInSearch : collapsed).has(key);
	}

	function toggle(key: string) {
		const set = searching ? collapsedInSearch : collapsed;
		if (set.has(key)) set.delete(key);
		else set.add(key);
	}

	/** A pointer pressed on a palette item; becomes a drag once it moves past the tap slop. */
	type Press = { entry: CatalogEntry; pointerId: number; start: Point; dragging: boolean };
	let press: Press | null = null;
	/** Set when a press ended as a drag, so the click the browser fires afterwards doesn't arm. */
	let justDragged = false;
	let ghost = $state<{ entry: CatalogEntry; x: number; y: number } | null>(null);
	/** The ghost swings from the pointer as it is carried to the stage. */
	const ghostSwing = new DragSwing();

	function onItemDown(e: PointerEvent, entry: CatalogEntry) {
		justDragged = false;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		press = {
			entry,
			pointerId: e.pointerId,
			start: { x: e.clientX, y: e.clientY },
			dragging: false
		};
		try {
			(e.currentTarget as Element).setPointerCapture(e.pointerId);
		} catch {
			// Synthetic events can carry pointer ids the browser doesn't know.
		}
	}

	function onItemMove(e: PointerEvent) {
		if (press?.pointerId !== e.pointerId) return;
		const p = { x: e.clientX, y: e.clientY };
		if (!press.dragging && movedBeyond(press.start, p)) press.dragging = true;
		if (press.dragging) {
			ghost = { entry: press.entry, ...p };
			ghostSwing.move(['ghost'], p);
		}
	}

	function onItemUp(e: PointerEvent) {
		if (press?.pointerId !== e.pointerId) return;
		const { entry, dragging } = press;
		cancelDrag();
		if (!dragging) return; // A tap: the click handler arms the symbol.
		justDragged = true;
		const stage = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-stage]');
		if (!stage) return;
		const r = stage.getBoundingClientRect();
		editor.placeAt(entry.id, { x: e.clientX - r.left, y: e.clientY - r.top });
	}

	function cancelDrag() {
		press = null;
		ghost = null;
		ghostSwing.stop();
	}

	function onItemClick(e: MouseEvent, entry: CatalogEntry) {
		// A keyboard click (detail 0) always counts; a pointer click right after a drag doesn't.
		if (justDragged && e.detail !== 0) {
			justDragged = false;
			return;
		}
		editor.arm(editor.armedSymbolId === entry.id ? null : entry.id);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		// Escape in a dialog closes the dialog; it shouldn't also disarm the palette.
		if (document.querySelector('dialog:modal')) return;
		if (press) {
			justDragged = press.dragging;
			cancelDrag();
			return;
		}
		// Escape in a text field belongs to the field (a search box clears itself).
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, select, [contenteditable]')) return;
		if (editor.armedSymbolId) editor.arm(null);
		if (editor.tool) editor.armTool(null);
	}

	/** A footprint's box fitted into the 40 × 40 thumbnail, never thinner than 3 px. */
	function footprintThumb(f: FootprintEntry['footprint']) {
		const k = 30 / Math.max(f.widthFt, f.depthFt);
		return { w: Math.max(f.widthFt * k, 3), h: Math.max(f.depthFt * k, 3) };
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet thumb(entry: CatalogEntry)}
	<span
		class="grid size-10 flex-none place-items-center rounded-md border border-border bg-white text-text [&_svg]:size-8"
		aria-hidden="true"
	>
		{#if entry.kind === 'symbol'}
			<!-- Catalog SVG is bundled with the app, never user input. -->
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html entry.svg}
		{:else}
			{@const r = footprintThumb(entry.footprint)}
			<svg viewBox="0 0 40 40">
				<g transform="translate(20 20)">
					<FootprintShape style={entry.footprint.style} width={r.w} height={r.h} />
				</g>
			</svg>
		{/if}
	</span>
{/snippet}

{#snippet toolIcon(id: AnnotationTool)}
	<span
		class="grid size-10 flex-none place-items-center rounded-md border border-border bg-white text-text"
		aria-hidden="true"
	>
		<svg class="size-8 fill-none stroke-current stroke-2" viewBox="0 0 32 32">
			{#if id === 'text'}
				<path d="M8 9h16M16 9v15" />
			{:else if id === 'arrow'}
				<path d="M6 24 24 8" stroke-dasharray="4 3" />
				<path d="M15 8h9v9" />
			{:else}
				<path d="M5 16h22M5 11v10M27 11v10" />
			{/if}
		</svg>
	</span>
{/snippet}

{#snippet chevron(open: boolean)}
	<svg
		class={[
			'size-3 flex-none fill-none stroke-current stroke-[1.5] transition-[rotate] duration-100',
			{ 'rotate-90': open }
		]}
		viewBox="0 0 12 12"
		aria-hidden="true"
	>
		<path d="M4 2.5 7.5 6 4 9.5" />
	</svg>
{/snippet}

{#snippet item(entry: CatalogEntry, nested: boolean)}
	<li>
		<button
			type="button"
			class={[
				'focus-ring flex w-full cursor-grab touch-pan-y items-center gap-2 rounded-md py-1 pr-2 text-left text-text select-none hover:bg-surface',
				'aria-pressed:bg-[color-mix(in_srgb,var(--theme-accent)_18%,white)] aria-pressed:shadow-[inset_0_0_0_2px_var(--theme-accent)]',
				nested ? 'pl-2' : 'pl-4'
			]}
			data-testid="palette-item-{entry.id}"
			aria-pressed={editor.armedSymbolId === entry.id}
			onpointerdown={(e) => onItemDown(e, entry)}
			onpointermove={onItemMove}
			onpointerup={onItemUp}
			onpointercancel={cancelDrag}
			onclick={(e) => onItemClick(e, entry)}
		>
			{@render thumb(entry)}
			<span>{entry.name}</span>
		</button>
	</li>
{/snippet}

<aside class="flex min-h-0 flex-col border-r-[3px] border-black bg-white" aria-label="Symbols">
	<PanelHeader title="Symbols" />
	<div class="border-b-2 border-border p-2">
		<input
			type="search"
			placeholder="Search symbols"
			aria-label="Search symbols"
			class={controlClass}
			bind:value={query}
			oninput={() => collapsedInSearch.clear()}
		/>
	</div>
	<div class="flex-1 overflow-y-auto pt-1 pb-4">
		<div role="group" aria-labelledby="{uid}-annotate">
			<h3
				id="{uid}-annotate"
				class="m-0 flex min-h-11 items-center p-2 text-xs font-bold tracking-wider text-muted uppercase"
			>
				Annotate
			</h3>
			<ul class="m-0 list-none p-0">
				{#each TOOLS as t (t.id)}
					<li>
						<button
							type="button"
							class={[
								'focus-ring flex w-full cursor-pointer items-center gap-2 rounded-md py-1 pr-2 pl-4 text-left text-text select-none hover:bg-surface',
								'aria-pressed:bg-[color-mix(in_srgb,var(--theme-accent)_18%,white)] aria-pressed:shadow-[inset_0_0_0_2px_var(--theme-accent)]'
							]}
							data-testid="tool-{t.id}"
							aria-pressed={editor.tool === t.id}
							onclick={() => editor.armTool(editor.tool === t.id ? null : t.id)}
						>
							{@render toolIcon(t.id)}
							<span>{t.name}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
		{#each groups as group (group.category)}
			{@const key = `category-${group.category}`}
			<div role="group" aria-labelledby="{uid}-{key}">
				<h3 class="m-0 text-base">
					<button
						type="button"
						class={[TOGGLE, 'text-xs font-bold tracking-wider text-muted uppercase']}
						id="{uid}-{key}"
						aria-expanded={isOpen(key)}
						onclick={() => toggle(key)}
					>
						{@render chevron(isOpen(key))}{group.label}
					</button>
				</h3>
				{#if isOpen(key)}
					<ul class="m-0 list-none p-0">
						{#each group.items as it (it.kind === 'family' ? `family-${it.family.id}` : it.entry.id)}
							{#if it.kind === 'family'}
								{@const fkey = `family-${it.family.id}`}
								<li>
									<div role="group" aria-labelledby="{uid}-{fkey}">
										<button
											type="button"
											class={[TOGGLE, 'pl-4 font-semibold text-text']}
											id="{uid}-{fkey}"
											aria-expanded={isOpen(fkey)}
											onclick={() => toggle(fkey)}
										>
											{@render chevron(isOpen(fkey))}{it.family.name}
										</button>
										{#if isOpen(fkey)}
											<ul class="m-0 ml-4 list-none border-l border-border p-0">
												{#each it.entries as entry (entry.id)}
													{@render item(entry, true)}
												{/each}
											</ul>
										{/if}
									</div>
								</li>
							{:else}
								{@render item(it.entry, false)}
							{/if}
						{/each}
					</ul>
				{/if}
			</div>
		{:else}
			<p class="mx-2 my-4 text-muted">No symbols match “{query.trim()}”.</p>
		{/each}
	</div>
</aside>

{#if ghost}
	<div
		class="pointer-events-none fixed top-0 left-0 z-10 opacity-85"
		data-testid="palette-ghost"
		style:transform="translate({ghost.x}px, {ghost.y}px) translate(-50%, -50%) rotate({ghostSwing.angle.toFixed(
			2
		)}deg)"
	>
		{@render thumb(ghost.entry)}
	</div>
{/if}
