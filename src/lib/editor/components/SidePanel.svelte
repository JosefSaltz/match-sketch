<script lang="ts">
	import type { EditorState } from '../editor-state.svelte.js';
	import BriefPanel from './BriefPanel.svelte';
	import PropertiesPanel from './PropertiesPanel.svelte';

	let { editor }: { editor: EditorState } = $props();

	type Tab = 'properties' | 'brief' | 'walkthrough';
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'properties', label: 'Properties' },
		{ id: 'brief', label: 'Brief' }
	];

	const uid = $props.id();
	const tabId = (t: Tab) => `${uid}-tab-${t}`;
	const panelId = (t: Tab) => `${uid}-panel-${t}`;

	/** Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern, automatic activation). */
	function onTabKeydown(e: KeyboardEvent) {
		const i = TABS.findIndex((t) => t.id === editor.panel);
		const next =
			e.key === 'ArrowRight'
				? (i + 1) % TABS.length
				: e.key === 'ArrowLeft'
					? (i - 1 + TABS.length) % TABS.length
					: e.key === 'Home'
						? 0
						: e.key === 'End'
							? TABS.length - 1
							: null;
		if (next === null) return;
		// Claimed here, so the editor's window shortcuts don't also nudge the selection.
		e.preventDefault();
		editor.panel = TABS[next].id;
		document.getElementById(tabId(TABS[next].id))?.focus();
	}
</script>

<aside class="flex min-h-0 flex-col border-l-[3px] border-black bg-white" aria-label="Inspector">
	<div
		class="bg-theme flex min-h-12 items-end gap-1 border-b-[3px] border-black px-2 pt-2"
		role="tablist"
		aria-label="Inspector"
	>
		{#each TABS as t (t.id)}
			{@const selected = editor.panel === t.id}
			<button
				type="button"
				role="tab"
				id={tabId(t.id)}
				aria-selected={selected}
				aria-controls={panelId(t.id)}
				tabindex={selected ? 0 : -1}
				class={[
					'focus-ring -mb-[3px] min-h-11 rounded-t-lg border-[3px] border-black px-4 font-display text-sm tracking-wide uppercase',
					selected ? 'border-b-white bg-white text-text' : 'bg-white/70 text-muted'
				]}
				onclick={() => (editor.panel = t.id)}
				onkeydown={onTabKeydown}
			>
				{t.label}
			</button>
		{/each}
	</div>
	<div
		class="min-h-0 flex-1 overflow-y-auto p-3"
		role="tabpanel"
		id={panelId(editor.panel)}
		aria-labelledby={tabId(editor.panel)}
		tabindex="0"
	>
		{#if editor.panel === 'properties'}
			<PropertiesPanel {editor} />
		{:else}
			<BriefPanel {editor} />
		{/if}
	</div>
</aside>
