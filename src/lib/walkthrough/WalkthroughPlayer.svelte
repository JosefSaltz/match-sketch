<script lang="ts">
	import type { DepthMap } from '#lib/geometry/depth-map.js';
	import type { CanvasSize } from '#lib/geometry/types.js';
	import type { LengthUnit } from '#lib/geometry/units.js';
	import { SYMBOL_PX, type PlanDocument } from '#lib/model/plan.js';
	import { displaySteps } from '#lib/model/procedure.js';
	import PrintDiagram from '#lib/print/PrintDiagram.svelte';
	import Button from '#lib/ui/Button.svelte';
	import MeaningBadge from './MeaningBadge.svelte';
	import { MEANING_STYLES, meaningsUsed } from './meanings.js';

	/**
	 * Pages through a plan's walkthrough one step at a time (spec §7.10): the same drawing each
	 * time, with the step's text, highlights and a legend of the meanings it uses.
	 */
	type Props = {
		doc: PlanDocument;
		canvas: CanvasSize;
		unit: LengthUnit;
		depth: DepthMap | null;
		title: string;
		/** Shows "Back to stage" when given. */
		onclose?: () => void;
	};
	let { doc, canvas, unit, depth, title, onclose }: Props = $props();

	const steps = $derived(displaySteps(doc.brief.steps));
	let index = $state(0);
	const current = $derived(steps[Math.min(index, steps.length - 1)] ?? null);
	const used = $derived(current ? meaningsUsed(current.marks) : []);

	let width = $state(0);
	let height = $state(0);
	/** The plan's symbol size, shrunk on narrow screens so a phone still shows the whole bay. */
	const symbolPx = $derived(Math.min(SYMBOL_PX[doc.display.symbolSize], Math.max(14, width / 16)));

	const go = (by: number) => (index = Math.max(0, Math.min(steps.length - 1, index + by)));

	function onKeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
		if (e.key === 'ArrowRight') go(1);
		else if (e.key === 'ArrowLeft') go(-1);
		else return;
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<section class="grid h-full min-h-0 grid-rows-[auto_minmax(16rem,1fr)_auto] gap-3">
	<div class="flex min-w-0 items-baseline gap-3">
		<h2 class="m-0 shrink-0 font-display text-lg tracking-wide uppercase" data-testid="step-count">
			{#if current}Step {index + 1} of {steps.length}{:else}No steps{/if}
		</h2>
		<span class="truncate text-muted">{title}</span>
	</div>

	<div
		class="min-h-0 overflow-hidden rounded-lg border-2 border-border bg-white"
		bind:clientWidth={width}
		bind:clientHeight={height}
	>
		{#if width > 0 && height > 0}
			<svg
				{width}
				{height}
				viewBox="0 0 {width} {height}"
				role="img"
				aria-label={current ? `Diagram of ${title}, step ${index + 1}` : `Diagram of ${title}`}
				class="block"
			>
				<PrintDiagram
					{doc}
					{canvas}
					{unit}
					area={{ x: 0, y: 0, width, height }}
					{symbolPx}
					{depth}
					step={current}
				/>
			</svg>
		{/if}
	</div>

	<div class="grid gap-3">
		<p class="m-0 text-lg font-semibold" aria-live="polite" data-testid="step-text">
			{current?.text ?? 'This stage has no procedure yet.'}
		</p>
		{#if used.length}
			<ul class="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0" aria-label="Legend">
				{#each used as meaning (meaning)}
					<li class="flex items-center gap-1.5 text-sm font-semibold">
						<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
							<MeaningBadge {meaning} x={11} y={11} r={10} />
						</svg>
						{MEANING_STYLES[meaning].label}
					</li>
				{/each}
			</ul>
		{/if}
		<div class="flex flex-wrap gap-2">
			<Button onclick={() => go(-1)} disabled={index === 0}>Previous</Button>
			<Button variant="primary" onclick={() => go(1)} disabled={index >= steps.length - 1}>
				Next
			</Button>
			{#if onclose}
				<Button class="ml-auto" onclick={onclose}>Back to stage</Button>
			{/if}
		</div>
	</div>
</section>
