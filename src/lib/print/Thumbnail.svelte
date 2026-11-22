<script lang="ts">
	import { depthMapFor } from '#lib/geometry/depth-map.js';
	import { planTitle, type PlanRecord } from '#lib/store/records.js';
	import PrintDiagram from './PrintDiagram.svelte';

	/** A small picture of a plan's diagram for lists: the whole bay, symbols shrunk, no labels. */
	let {
		plan,
		title = planTitle(plan),
		width = 120,
		height = 90
	}: { plan: PlanRecord; title?: string; width?: number; height?: number } = $props();
	const depth = $derived(depthMapFor(plan.document.scaleBreaks, plan.depthFt));
</script>

<svg
	data-testid="plan-thumbnail"
	role="img"
	aria-label="Diagram of {title}"
	{width}
	{height}
	viewBox="0 0 {width} {height}"
	class="block flex-none rounded-md border border-border bg-white"
>
	<PrintDiagram
		doc={plan.document}
		canvas={{ widthFt: plan.widthFt, depthFt: plan.depthFt }}
		unit={plan.unit}
		area={{ x: 3, y: 3, width: width - 6, height: height - 6 }}
		symbolPx={Math.max(6, height / 9)}
		{depth}
		bare
	/>
</svg>
