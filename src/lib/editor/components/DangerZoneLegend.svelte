<script lang="ts">
	import { DASH } from '#lib/safety/dash.js';
	import {
		FAN_SOURCES,
		LAYER_IDS,
		LEGEND_NO_BERMS,
		SPLASH_SOURCES,
		type LayerId
	} from '#lib/safety/sources.js';
	import { isFiringPoint } from '#lib/safety/zones.js';
	import type { EditorState } from '../editor-state.svelte.js';

	let { editor }: { editor: EditorState } = $props();

	const active = $derived(LAYER_IDS.filter((id) => editor.dangerZones[id]));
	const fanOn = $derived(active.some((id) => id in FAN_SOURCES));
	const noFiringPoint = $derived(fanOn && !editor.doc.objects.some(isFiringPoint));

	function entry(id: LayerId) {
		if (id in SPLASH_SOURCES) {
			const s = SPLASH_SOURCES[id as keyof typeof SPLASH_SOURCES];
			return { label: s.label, citation: s.citation, meaning: `“${s.meaning}”` };
		}
		const f = FAN_SOURCES[id as keyof typeof FAN_SOURCES];
		return { label: `${f.label} (${f.load})`, citation: f.citation, meaning: f.meaning };
	}
</script>

{#if active.length > 0}
	<aside
		class="pointer-events-none absolute bottom-3 left-3 max-w-xs rounded-lg border-[3px] border-black bg-white p-3 text-xs shadow-[3px_3px_0_#000]"
		data-testid="danger-legend"
		aria-label="Danger zones legend"
	>
		<ul class="grid gap-2">
			{#each active as id (id)}
				{@const e = entry(id)}
				<li class="grid grid-cols-[auto_1fr] items-start gap-x-2">
					<svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" class="mt-1">
						<line
							x1="0"
							y1="5"
							x2="28"
							y2="5"
							stroke="var(--color-danger)"
							stroke-width="2"
							stroke-dasharray={DASH[id]}
						/>
					</svg>
					<div>
						<p class="font-semibold">{e.label}</p>
						<p class="text-muted">{e.citation}</p>
						<p>{e.meaning}</p>
					</div>
				</li>
			{/each}
		</ul>
		{#if noFiringPoint}
			<p class="mt-2 font-semibold">
				Add a shooting position or shooting box to see the ricochet fan.
			</p>
		{/if}
		<p class="mt-2 text-muted">{LEGEND_NO_BERMS}</p>
	</aside>
{/if}
