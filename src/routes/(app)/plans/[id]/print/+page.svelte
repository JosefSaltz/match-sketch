<script lang="ts">
	import { resolve } from '$app/paths';
	import { printInput } from '#lib/print/input.js';
	import { defaultTileScale, layoutPlan, tileArea, tileScales } from '#lib/print/layout.js';
	import { measureText } from '#lib/print/measure.js';
	import { downloadPdf } from '#lib/print/pdf.js';
	import { pdfFileName } from '#lib/print/pdf-text.js';
	import type { Orientation } from '#lib/print/page.js';
	import PrintPage from '#lib/print/PrintPage.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let orientation = $state<Orientation>('portrait');
	let diagram = $state<'fit' | 'tile'>('fit');
	/** Feet per inch chosen for tiles; null means the default for this plan. */
	let tileChoice = $state<number | null>(null);

	const plan = $derived(data.plan);
	const base = $derived(plan ? printInput(plan, data.match, { orientation, mode: 'fit' }) : null);
	const scales = $derived(plan ? tileScales(plan.unit) : []);
	const defaultScale = $derived(
		base && plan ? defaultTileScale(base.canvas, base.depth, tileArea(orientation), plan.unit) : 0
	);
	const tileScale = $derived(tileChoice ?? defaultScale);
	const pages = $derived(
		base
			? layoutPlan(
					{ ...base, mode: diagram === 'fit' ? 'fit' : { tileScaleFtPerIn: tileScale } },
					measureText
				)
			: []
	);
	let saving = $state(false);
	let pdfError = $state<string | null>(null);

	/** The PDF is drawn from the same page SVGs the preview shows. */
	async function savePdf() {
		if (!base) return;
		saving = true;
		pdfError = null;
		try {
			const svgs = [...document.querySelectorAll<SVGSVGElement>('[data-testid="print-page"]')];
			await downloadPdf(svgs, orientation, pdfFileName(base.title));
		} catch (err) {
			console.error(err);
			pdfError = 'The PDF could not be made. Try Print and choose “Save as PDF” instead.';
		} finally {
			saving = false;
		}
	}

	const pageCss = $derived(`<style>@page { size: letter ${orientation}; margin: 0 }</style>`);
</script>

<svelte:head>
	<title>{base ? `Print ${base.title} · Match Sketch` : 'Plan not found · Match Sketch'}</title>
	<!-- The page size follows the chosen orientation; the string is built here, not user input. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html pageCss}
</svelte:head>

<div class="min-h-full bg-surface print:bg-white">
	<header class="bg-theme border-b-[3px] border-black print:hidden">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
			<a href={resolve('')} class="focus-ring mr-auto inline-flex min-h-11 items-center rounded-lg">
				<Wordmark />
			</a>
			{#if plan}
				<Button href={resolve('/(app)/plans/[id]', { id: plan.id })}>Back to plan</Button>
			{/if}
		</div>
	</header>

	{#if plan && base}
		<div
			class="mx-auto flex max-w-6xl flex-wrap items-end gap-4 px-4 py-4 print:hidden"
			role="group"
			aria-label="Print options"
		>
			<Field label="Orientation" id="print-orientation">
				{#snippet children({ id })}
					<select {id} class={controlClass} bind:value={orientation}>
						<option value="portrait">Portrait</option>
						<option value="landscape">Landscape</option>
					</select>
				{/snippet}
			</Field>
			<Field label="Diagram" id="print-diagram">
				{#snippet children({ id })}
					<select {id} class={controlClass} bind:value={diagram}>
						<option value="fit">Fit to page</option>
						<option value="tile">Tile</option>
					</select>
				{/snippet}
			</Field>
			{#if diagram === 'tile'}
				<Field label="Tile scale" id="print-scale">
					{#snippet children({ id })}
						<select
							{id}
							class={controlClass}
							value={String(tileScale)}
							onchange={(e) => (tileChoice = Number(e.currentTarget.value))}
						>
							{#each scales as s (s.ftPerIn)}
								<option value={String(s.ftPerIn)}>{s.label}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
			{/if}
			<div class="ml-auto flex gap-3">
				<Button onclick={savePdf} disabled={saving}>
					{saving ? 'Making PDF…' : 'Download PDF'}
				</Button>
				<Button variant="primary" onclick={() => window.print()}>Print</Button>
			</div>
		</div>

		{#if pdfError}
			<p class="mx-auto max-w-6xl px-4 text-danger print:hidden" role="alert">{pdfError}</p>
		{/if}
		<main class="flex flex-col items-center gap-6 px-4 pb-10 print:block print:p-0">
			{#each pages as page, i (i)}
				<div class="page shadow-[0_2px_12px_rgb(0_0_0/0.18)] print:shadow-none">
					<PrintPage {page} {plan} />
				</div>
			{/each}
		</main>
	{:else}
		<main class="mx-auto max-w-2xl px-4 py-8">
			<h1 class="m-0 mb-3 font-display text-2xl tracking-wide uppercase">Plan not found</h1>
			<p><a class="underline" href={resolve('')}>Back to your plans</a></p>
		</main>
	{/if}
</div>

<style>
	@media print {
		.page {
			break-after: page;
		}
		.page:last-child {
			break-after: auto;
		}
	}
</style>
