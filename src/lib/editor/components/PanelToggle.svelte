<script lang="ts">
	import { panelDomId } from '../panels.js';
	import { panels } from '../panels.svelte.js';

	let { panel }: { panel: 'symbols' | 'inspector' } = $props();

	// The same button collapses the panel on a wide screen and closes the drawer on a narrow one.
	const verb = $derived(panels.wide ? 'Hide' : 'Close');
	const label = $derived(`${verb} ${panel}`);
	/** The chevron points the way the panel slides off. */
	const points = $derived(panel === 'symbols' ? 'M7.5 2.5 4 6l3.5 3.5' : 'M4.5 2.5 8 6 4.5 9.5');
</script>

<button
	type="button"
	class="focus-ring inline-flex h-11 w-9 flex-none cursor-pointer items-center justify-center rounded-[10px] border-[3px] border-black bg-white text-black shadow-[3px_3px_0_#000] select-none max-lg:w-11"
	aria-label={label}
	title={label}
	aria-expanded={panels.isOpen(panel)}
	aria-controls={panelDomId(panel)}
	data-panel-close={panel}
	onclick={() => panels.close(panel)}
>
	<svg
		class="size-4 fill-none stroke-current stroke-[1.5]"
		viewBox="0 0 12 12"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d={points} />
	</svg>
</button>
