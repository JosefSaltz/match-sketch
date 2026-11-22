<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { paletteGroups, type CatalogEntry, type FootprintEntry } from '#lib/catalog/index.js';
	import type { Point } from '#lib/geometry/types.js';
	import type { EditorState } from '../editor-state.svelte.js';
	import { movedBeyond } from '../gestures.js';

	let { editor }: { editor: EditorState } = $props();

	const uid = $props.id();

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
		if (press.dragging) ghost = { entry: press.entry, ...p };
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
		if (press) {
			justDragged = press.dragging;
			cancelDrag();
			return;
		}
		// Escape in a text field belongs to the field (a search box clears itself).
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, select, [contenteditable]')) return;
		if (editor.armedSymbolId) editor.arm(null);
	}

	/** A footprint's shape fitted into the 40 × 40 thumbnail, never thinner than 3 px. */
	function footprintThumb(f: FootprintEntry['footprint']) {
		const k = 30 / Math.max(f.widthFt, f.depthFt);
		const w = Math.max(f.widthFt * k, 3);
		const h = Math.max(f.depthFt * k, 3);
		return { x: 20 - w / 2, y: 20 - h / 2, w, h };
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet thumb(entry: CatalogEntry)}
	<span class="thumb" aria-hidden="true">
		{#if entry.kind === 'symbol'}
			<!-- Catalog SVG is bundled with the app, never user input. -->
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html entry.svg}
		{:else}
			{@const r = footprintThumb(entry.footprint)}
			<svg viewBox="0 0 40 40">
				{#if entry.footprint.style === 'line'}
					<line x1={r.x} x2={r.x + r.w} y1="20" y2="20" stroke-width={r.h} />
				{:else}
					<rect class={entry.footprint.style} x={r.x} y={r.y} width={r.w} height={r.h} />
				{/if}
			</svg>
		{/if}
	</span>
{/snippet}

{#snippet chevron(open: boolean)}
	<svg class={['chevron', { open }]} viewBox="0 0 12 12" aria-hidden="true">
		<path d="M4 2.5 7.5 6 4 9.5" />
	</svg>
{/snippet}

{#snippet item(entry: CatalogEntry)}
	<li>
		<button
			type="button"
			class="item"
			data-testid="palette-item-{entry.id}"
			aria-pressed={editor.armedSymbolId === entry.id}
			onpointerdown={(e) => onItemDown(e, entry)}
			onpointermove={onItemMove}
			onpointerup={onItemUp}
			onpointercancel={cancelDrag}
			onclick={(e) => onItemClick(e, entry)}
		>
			{@render thumb(entry)}
			<span class="name">{entry.name}</span>
		</button>
	</li>
{/snippet}

<aside class="palette" aria-label="Symbols">
	<div class="search">
		<input
			type="search"
			placeholder="Search symbols"
			aria-label="Search symbols"
			bind:value={query}
			oninput={() => collapsedInSearch.clear()}
		/>
	</div>
	<div class="list">
		{#each groups as group (group.category)}
			{@const key = `category-${group.category}`}
			<div class="category" role="group" aria-labelledby="{uid}-{key}">
				<h3>
					<button
						type="button"
						class="toggle category-toggle"
						id="{uid}-{key}"
						aria-expanded={isOpen(key)}
						onclick={() => toggle(key)}
					>
						{@render chevron(isOpen(key))}{group.label}
					</button>
				</h3>
				{#if isOpen(key)}
					<ul class="items">
						{#each group.items as it (it.kind === 'family' ? `family-${it.family.id}` : it.entry.id)}
							{#if it.kind === 'family'}
								{@const fkey = `family-${it.family.id}`}
								<li>
									<div class="family" role="group" aria-labelledby="{uid}-{fkey}">
										<button
											type="button"
											class="toggle family-toggle"
											id="{uid}-{fkey}"
											aria-expanded={isOpen(fkey)}
											onclick={() => toggle(fkey)}
										>
											{@render chevron(isOpen(fkey))}{it.family.name}
										</button>
										{#if isOpen(fkey)}
											<ul class="items variants">
												{#each it.entries as entry (entry.id)}
													{@render item(entry)}
												{/each}
											</ul>
										{/if}
									</div>
								</li>
							{:else}
								{@render item(it.entry)}
							{/if}
						{/each}
					</ul>
				{/if}
			</div>
		{:else}
			<p class="empty">No symbols match “{query.trim()}”.</p>
		{/each}
	</div>
</aside>

{#if ghost}
	<div class="ghost" style:transform="translate({ghost.x}px, {ghost.y}px) translate(-50%, -50%)">
		{@render thumb(ghost.entry)}
	</div>
{/if}

<style>
	.palette {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-right: 1px solid var(--color-border);
		background: var(--color-bg);
	}
	.search {
		padding: var(--space-2);
		border-bottom: 1px solid var(--color-border);
	}
	.search input {
		width: 100%;
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}
	.list {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-1) 0 var(--space-4);
	}
	h3 {
		margin: 0;
		font-size: inherit;
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		padding: var(--space-2);
		border: 0;
		background: none;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
	}
	.category-toggle {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.family-toggle {
		padding-left: var(--space-4);
		font-weight: 600;
	}
	.chevron {
		flex: none;
		width: 12px;
		height: 12px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		transition: rotate 120ms ease;
	}
	.chevron.open {
		rotate: 90deg;
	}
	.variants {
		margin-left: var(--space-4);
		border-left: 1px solid var(--color-border);
	}
	.variants .item {
		padding-left: var(--space-2);
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-1) var(--space-2) var(--space-1) var(--space-4);
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--color-text);
		text-align: left;
		cursor: grab;
		user-select: none;
		touch-action: pan-y;
	}
	.item:hover {
		background: var(--color-surface);
	}
	.item[aria-pressed='true'] {
		background: color-mix(in srgb, var(--color-accent) 14%, transparent);
		box-shadow: inset 0 0 0 1.5px var(--color-accent);
	}
	.thumb {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: #fff;
		color: var(--color-text);
	}
	.thumb :global(svg) {
		width: 32px;
		height: 32px;
	}
	.thumb line {
		stroke: currentColor;
	}
	.thumb rect {
		stroke: currentColor;
		stroke-width: 2;
	}
	.thumb rect.solid {
		fill: currentColor;
		fill-opacity: 0.75;
		stroke-width: 1;
	}
	.thumb rect.outline {
		fill: none;
	}
	.empty {
		margin: var(--space-4) var(--space-2);
		color: var(--color-muted);
	}
	.ghost {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 10;
		pointer-events: none;
		opacity: 0.85;
	}
</style>
