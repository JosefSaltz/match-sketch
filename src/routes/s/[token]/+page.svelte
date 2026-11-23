<script lang="ts">
	import { resolve } from '$app/paths';
	import { depthMapFor } from '#lib/geometry/depth-map.js';
	import { formatMatchDate } from '#lib/matches/format.js';
	import { SYMBOL_PX } from '#lib/model/plan.js';
	import { displaySteps } from '#lib/model/procedure.js';
	import PrintDiagram from '#lib/print/PrintDiagram.svelte';
	import Thumbnail from '#lib/print/Thumbnail.svelte';
	import { targetsText } from '#lib/brief/tally.js';
	import { asPlanRecord, sharedStage } from '#lib/share/client.js';
	import { planTitle } from '#lib/store/records.js';
	import Button from '#lib/ui/Button.svelte';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import WalkthroughPlayer from '#lib/walkthrough/WalkthroughPlayer.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = $derived(data.view);
	const stage = $derived(view ? sharedStage(view, data.stageId) : null);
	/** A match link without `?stage=` lists the stages; a bad stage id is a bad link. */
	const listing = $derived(view?.kind === 'match' && data.stageId === null);
	const notFound = $derived(!view || (!listing && !stage));

	const plan = $derived(stage?.plan ?? null);
	const doc = $derived(plan?.document ?? null);
	const title = $derived(plan ? planTitle({ document: plan.document }, plan.stageNumber) : '');
	const steps = $derived(doc ? displaySteps(doc.brief.steps) : []);
	const depth = $derived(plan ? depthMapFor(plan.document.scaleBreaks, plan.depthFt) : null);
	const canvas = $derived(plan ? { widthFt: plan.widthFt, depthFt: plan.depthFt } : null);
	const facts = $derived(
		doc
			? [
					{ label: 'Start position', value: doc.brief.startPosition },
					{ label: 'Gun ready condition', value: doc.brief.gunReady },
					{ label: 'Round count', value: doc.brief.roundCount },
					{ label: 'Targets', value: targetsText(doc) },
					{ label: 'Par time', value: doc.brief.parTime }
				].filter((f) => f.value.trim() !== '')
			: []
	);

	let walking = $state(false);
	let width = $state(0);
	/** Tall enough for the bay's shape, within a phone screen. */
	const height = $derived(
		canvas && width ? Math.min(Math.max(width * (canvas.depthFt / canvas.widthFt), 260), 620) : 0
	);
	const symbolPx = $derived(
		doc ? Math.min(SYMBOL_PX[doc.display.symbolSize], Math.max(14, width / 16)) : 0
	);

	const neighbours = $derived.by(() => {
		if (view?.kind !== 'match' || !stage) return null;
		return {
			previous: view.plans[stage.index - 1] ?? null,
			next: view.plans[stage.index + 1] ?? null
		};
	});
	const pageTitle = $derived(
		notFound
			? "This link isn't shared"
			: listing && view?.kind === 'match'
				? view.match.name
				: title
	);
</script>

<svelte:head>
	<title>{pageTitle} · Match Sketch</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-dvh bg-surface">
	<header class="bg-theme border-b-[3px] border-black">
		<div class="mx-auto flex max-w-4xl items-center px-4 py-3">
			<Wordmark size="compact" />
		</div>
	</header>

	<!-- Stage links are resolve()d routes plus a ?stage= query, which the rule can't see through. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<main class="mx-auto grid max-w-4xl gap-4 px-4 py-5">
		{#if notFound}
			<h1 class="m-0 font-display text-2xl tracking-wide uppercase">This link isn't shared</h1>
			<p class="m-0">Ask the person who shared it for a new link.</p>
		{:else if listing && view?.kind === 'match'}
			<div class="grid gap-1">
				<h1 class="m-0 font-display text-2xl tracking-wide uppercase">{view.match.name}</h1>
				{#if view.match.date}
					<p class="m-0 text-muted">{formatMatchDate(view.match.date)}</p>
				{/if}
			</div>
			<section aria-labelledby="stages-heading" class="grid gap-2">
				<h2 id="stages-heading" class="m-0 font-display text-lg tracking-wide uppercase">Stages</h2>
				{#if view.plans.length}
					<ol
						class="m-0 list-none divide-y-2 divide-border overflow-hidden rounded-xl border-[3px] border-black bg-white p-0"
					>
						{#each view.plans as p (p.id)}
							{@const t = planTitle({ document: p.document }, p.stageNumber)}
							<li>
								<a
									href={`${resolve('/s/[token]', { token: data.token })}?stage=${p.id}`}
									class="focus-ring flex min-h-11 items-center gap-3 p-3 no-underline"
								>
									<Thumbnail plan={asPlanRecord(p)} title={t} width={96} height={72} />
									<span class="font-semibold">{t}</span>
								</a>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="m-0 text-muted">This match has no stages yet.</p>
				{/if}
			</section>
		{:else if stage && plan && doc && canvas}
			{#if neighbours}
				<nav aria-label="Stages" class="flex flex-wrap items-center gap-2 text-sm">
					<a class="focus-ring underline" href={resolve('/s/[token]', { token: data.token })}>
						All stages
					</a>
					<span class="text-muted">Stage {stage.index + 1} of {stage.count}</span>
					{#if neighbours.previous}
						<a
							class="focus-ring underline"
							href={`${resolve('/s/[token]', { token: data.token })}?stage=${neighbours.previous.id}`}
						>
							Previous stage
						</a>
					{/if}
					{#if neighbours.next}
						<a
							class="focus-ring underline"
							href={`${resolve('/s/[token]', { token: data.token })}?stage=${neighbours.next.id}`}
						>
							Next stage
						</a>
					{/if}
				</nav>
			{/if}
			<div class="grid gap-1">
				<h1 class="m-0 font-display text-2xl tracking-wide uppercase">{title}</h1>
				{#if stage.matchName || stage.date}
					<p class="m-0 text-muted">
						{[stage.matchName, stage.date ? formatMatchDate(stage.date) : '']
							.filter(Boolean)
							.join(' · ')}
					</p>
				{/if}
			</div>

			{#if walking}
				<div class="h-[85dvh] min-h-[32rem]">
					<WalkthroughPlayer
						{doc}
						{canvas}
						unit={plan.unit}
						{depth}
						{title}
						onclose={() => (walking = false)}
					/>
				</div>
			{:else}
				<div class="flex flex-wrap gap-2">
					{#if steps.length}
						<Button variant="primary" onclick={() => (walking = true)}>Walkthrough</Button>
					{/if}
				</div>
				<div
					class="overflow-hidden rounded-lg border-2 border-border bg-white"
					bind:clientWidth={width}
				>
					{#if width > 0}
						<svg
							{width}
							{height}
							viewBox="0 0 {width} {height}"
							role="img"
							aria-label="Diagram of {title}"
							class="block"
						>
							<PrintDiagram
								{doc}
								{canvas}
								unit={plan.unit}
								area={{ x: 0, y: 0, width, height }}
								{symbolPx}
								{depth}
							/>
						</svg>
					{/if}
				</div>

				{#if facts.length}
					<dl class="m-0 grid gap-x-4 gap-y-2 sm:grid-cols-2">
						{#each facts as f (f.label)}
							<div class="grid gap-0.5">
								<dt class="font-display text-xs tracking-wide uppercase">{f.label}</dt>
								<dd class="m-0 whitespace-pre-line">{f.value}</dd>
							</div>
						{/each}
					</dl>
				{/if}

				{#if steps.length}
					<section aria-labelledby="procedure-heading" class="grid gap-2">
						<h2 id="procedure-heading" class="m-0 font-display text-lg tracking-wide uppercase">
							Stage procedure
						</h2>
						<ol class="m-0 grid gap-1 pl-6">
							{#each steps as s (s.id)}
								<li>{s.text}</li>
							{/each}
						</ol>
					</section>
				{/if}

				{#each doc.brief.notes.filter((n) => n.title.trim() || n.body.trim()) as note (note.id)}
					<section class="grid gap-1">
						{#if note.title.trim()}
							<h2 class="m-0 font-display text-lg tracking-wide uppercase">{note.title}</h2>
						{/if}
						<p class="m-0 whitespace-pre-line">{note.body}</p>
					</section>
				{/each}
			{/if}
		{/if}
	</main>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</div>
