<script lang="ts">
	import type { PlanRecord } from '#lib/store/records.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import { printInput, type PrintMatch } from './input.js';
	import { defaultTileScale, layoutPlan, tileArea, tileScales } from './layout.js';
	import { measureText } from './measure.js';
	import { downloadPdf } from './pdf.js';
	import { pdfFileName } from './pdf-text.js';
	import type { Orientation } from './page.js';
	import PrintPage from './PrintPage.svelte';

	/**
	 * A plan's print preview with its options, Print and Download PDF (spec §7.6). Used by the
	 * owner's print route and by the share link's.
	 */
	type Props = {
		plan: PlanRecord;
		match: PrintMatch | null;
		/** The viewer link printed as a QR code, or null. */
		link: string | null;
		/** Where the wordmark goes; null shows it without a link. */
		homeHref: string | null;
		back: { href: string; label: string };
	};
	let { plan, match, link, homeHref, back }: Props = $props();

	let orientation = $state<Orientation>('portrait');
	let diagram = $state<'fit' | 'tile'>('fit');
	/** Feet per inch chosen for tiles; null means the default for this plan. */
	let tileChoice = $state<number | null>(null);

	const base = $derived(printInput(plan, match, { orientation, mode: 'fit' }, link));
	const scales = $derived(tileScales(plan.unit));
	const defaultScale = $derived(
		defaultTileScale(base.canvas, base.depth, tileArea(orientation), plan.unit)
	);
	const tileScale = $derived(tileChoice ?? defaultScale);
	const pages = $derived(
		layoutPlan(
			{ ...base, mode: diagram === 'fit' ? 'fit' : { tileScaleFtPerIn: tileScale } },
			measureText
		)
	);
	let saving = $state(false);
	let pdfError = $state<string | null>(null);

	/** The PDF is drawn from the same page SVGs the preview shows. */
	async function savePdf() {
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
	<title>Print {base.title} · Match Sketch</title>
	<!-- The page size follows the chosen orientation; the string is built here, not user input. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html pageCss}
</svelte:head>

<div class="min-h-full bg-surface print:bg-white">
	<header class="bg-theme border-b-[3px] border-black print:hidden">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
			{#if homeHref}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolve()d paths -->
				<a href={homeHref} class="focus-ring mr-auto inline-flex min-h-11 items-center rounded-lg">
					<Wordmark />
				</a>
			{:else}
				<span class="mr-auto inline-flex min-h-11 items-center"><Wordmark /></span>
			{/if}
			<Button href={back.href}>{back.label}</Button>
		</div>
	</header>

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
