<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		CATALOG,
		CATEGORY_LABEL,
		CATEGORY_ORDER,
		type FootprintEntry
	} from '#lib/catalog/index.js';
	import { SYMBOL_PX } from '#lib/model/plan.js';
	import FootprintShape from '#lib/ui/FootprintShape.svelte';
	import Toggle from '#lib/ui/Toggle.svelte';
	import Wordmark from '#lib/ui/Wordmark.svelte';

	/**
	 * Every catalog entry at the editor's sizes: for reviewing the art (grayscale shows a
	 * black-and-white printer) and for the e2e check that nothing is clipped. Not linked from menus.
	 */
	let gray = $state(false);
	const SIZES = [SYMBOL_PX.small, SYMBOL_PX.medium, SYMBOL_PX.large];
	const groups = CATEGORY_ORDER.map((category) => ({
		category,
		label: CATEGORY_LABEL[category],
		entries: CATALOG.filter((e) => e.category === category)
	}));

	/** A footprint's default size fitted into 120 × 60 px, never thinner than 3 px. */
	function fit(f: FootprintEntry['footprint']) {
		const k = Math.min(120 / f.widthFt, 60 / f.depthFt);
		return { w: Math.max(f.widthFt * k, 3), h: Math.max(f.depthFt * k, 3) };
	}
</script>

<svelte:head>
	<title>Symbols · Match Sketch</title>
</svelte:head>

<div class="min-h-full bg-surface">
	<header class="bg-theme border-b-[3px] border-black">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
			<a href={resolve('')} class="focus-ring mr-auto inline-flex min-h-11 items-center rounded-lg">
				<Wordmark />
			</a>
		</div>
	</header>
	<main class="mx-auto grid max-w-6xl gap-8 px-4 py-8" style:filter={gray ? 'grayscale(1)' : null}>
		<div class="flex flex-wrap items-center gap-4">
			<h1 class="m-0 mr-auto font-display text-2xl tracking-wide uppercase">Symbols</h1>
			<Toggle label="Grayscale" bind:checked={gray} />
		</div>
		{#each groups as g (g.category)}
			<section aria-labelledby="sym-{g.category}" class="grid gap-3">
				<h2 id="sym-{g.category}" class="m-0 font-display text-xl tracking-wide uppercase">
					{g.label}
				</h2>
				<ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3 p-0">
					{#each g.entries as e (e.id)}
						<li class="grid gap-2 rounded-xl border-2 border-black bg-white p-3 text-text">
							<div class="flex items-end gap-3">
								{#if e.kind === 'symbol'}
									{#each SIZES as px (px)}
										<span
											class="inline-block [&>svg]:block [&>svg]:size-full"
											style:width="{px}px"
											style:height="{px}px"
											data-symbol={e.id}
											data-size={px}
										>
											<!-- Catalog SVG is bundled with the app, never user input. -->
											<!-- eslint-disable-next-line svelte/no-at-html-tags -->
											{@html e.svg}
										</span>
									{/each}
									<span class="inline-block size-24 [&>svg]:block [&>svg]:size-full">
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html e.svg}
									</span>
								{:else}
									{@const r = fit(e.footprint)}
									<svg width="140" height="80" data-footprint={e.id} aria-hidden="true">
										<g transform="translate(70 40)">
											<FootprintShape style={e.footprint.style} width={r.w} height={r.h} />
										</g>
									</svg>
								{/if}
							</div>
							<div class="grid leading-tight">
								<span class="font-semibold">{e.name}</span>
								<span class="text-sm text-muted">
									{e.id}{e.kind === 'footprint'
										? ` · ${e.footprint.widthFt} × ${e.footprint.depthFt} ft`
										: ''}
								</span>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</main>
</div>
