<script lang="ts">
	import { resolve } from '$app/paths';
	import { printInput } from '#lib/print/input.js';
	import { layoutPlan, numberPages } from '#lib/print/layout.js';
	import { measureText } from '#lib/print/measure.js';
	import { downloadPdf } from '#lib/print/pdf.js';
	import { pdfFileName } from '#lib/print/pdf-text.js';
	import PrintPage from '#lib/print/PrintPage.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/**
	 * Every stage in match order, each starting on a new page, numbered across the whole document
	 * (spec §7.6). Stages print portrait and fit to the page.
	 */
	const pages = $derived.by(() => {
		const match = data.match;
		if (!match) return [];
		const ctx = { name: match.name, date: match.date, order: data.plans.map((p) => p.id) };
		const perStage = data.plans.map((plan) => ({
			plan,
			pages: layoutPlan(
				printInput(plan, ctx, { orientation: 'portrait', mode: 'fit' }),
				measureText
			)
		}));
		const total = perStage.reduce((n, s) => n + s.pages.length, 0);
		let offset = 0;
		return perStage.flatMap((s) => {
			const numbered = numberPages(s.pages, offset, total);
			offset += s.pages.length;
			return numbered.map((page) => ({ page, plan: s.plan }));
		});
	});

	let saving = $state(false);
	let pdfError = $state<string | null>(null);

	async function savePdf() {
		if (!data.match) return;
		saving = true;
		pdfError = null;
		try {
			const svgs = [...document.querySelectorAll<SVGSVGElement>('[data-testid="print-page"]')];
			await downloadPdf(svgs, 'portrait', pdfFileName(data.match.name));
		} catch (err) {
			console.error(err);
			pdfError = 'The PDF could not be made. Try Print and choose “Save as PDF” instead.';
		} finally {
			saving = false;
		}
	}

	const pageCss = '<style>@page { size: letter portrait; margin: 0 }</style>';
</script>

<svelte:head>
	<title
		>{data.match
			? `Print ${data.match.name} · Match Sketch`
			: 'Match not found · Match Sketch'}</title
	>
	<!-- A fixed page-size rule; not user input. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html pageCss}
</svelte:head>

<div class="min-h-full bg-surface print:bg-white">
	<header class="bg-theme border-b-[3px] border-black print:hidden">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
			<a href={resolve('')} class="focus-ring mr-auto inline-flex min-h-11 items-center rounded-lg">
				<Wordmark />
			</a>
			{#if data.match}
				<Button href={resolve('/(app)/matches/[id]', { id: data.match.id })}>Back to match</Button>
			{/if}
		</div>
	</header>

	{#if data.match}
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4 print:hidden">
			<h1 class="m-0 mr-auto font-display text-xl tracking-wide uppercase">{data.match.name}</h1>
			<Button onclick={savePdf} disabled={saving || !pages.length}>
				{saving ? 'Making PDF…' : 'Download PDF'}
			</Button>
			<Button variant="primary" onclick={() => window.print()} disabled={!pages.length}>
				Print
			</Button>
		</div>
		{#if pdfError}
			<p class="mx-auto max-w-6xl px-4 text-danger print:hidden" role="alert">{pdfError}</p>
		{/if}
		{#if pages.length}
			<main class="flex flex-col items-center gap-6 px-4 pb-10 print:block print:p-0">
				{#each pages as p, i (i)}
					<div class="page shadow-[0_2px_12px_rgb(0_0_0/0.18)] print:shadow-none">
						<PrintPage page={p.page} plan={p.plan} />
					</div>
				{/each}
			</main>
		{:else}
			<p class="mx-auto max-w-6xl px-4 text-muted">This match has no stages to print yet.</p>
		{/if}
	{:else}
		<main class="mx-auto max-w-2xl px-4 py-8">
			<h1 class="m-0 mb-3 font-display text-2xl tracking-wide uppercase">Match not found</h1>
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
