<script lang="ts">
	import { depthMapFor } from '#lib/geometry/depth-map.js';
	import { scaleBar } from '#lib/geometry/grid.js';
	import type { PlanRecord } from '#lib/store/records.js';
	import type { PrintPage, TextBlock } from './layout.js';
	import { PRINT_FONT } from './measure.js';
	import { PRINT_SYMBOL_PX } from './page.js';
	import PrintDiagram from './PrintDiagram.svelte';

	/** One printed page as a single SVG, styled only with attributes (it is also the PDF page). */
	let { page, plan }: { page: PrintPage; plan: PlanRecord } = $props();

	const INK = '#1c1c1a';
	const w = $derived(page.size.width);
	const h = $derived(page.size.height);
	const doc = $derived(plan.document);
	const canvas = $derived({ widthFt: plan.widthFt, depthFt: plan.depthFt });
	const depth = $derived(depthMapFor(doc.scaleBreaks, plan.depthFt));
	const symbolPx = $derived(PRINT_SYMBOL_PX[doc.display.symbolSize]);
	const full = $derived(page.kind === 'stage');
</script>

{#snippet block(b: TextBlock, fill = INK)}
	{#each b.lines as line, i (i)}
		<text
			x={b.x}
			y={b.y + b.fontPx + i * b.lineHeight}
			font-family={PRINT_FONT}
			font-size={b.fontPx}
			font-weight={b.bold ? 'bold' : 'normal'}
			{fill}
		>
			{line}
		</text>
	{/each}
{/snippet}

<svg
	data-testid="print-page"
	xmlns="http://www.w3.org/2000/svg"
	width="{w / 96}in"
	height="{h / 96}in"
	viewBox="0 0 {w} {h}"
	class="print-page"
>
	<rect x="0" y="0" width={w} height={h} fill="#fff" />

	{#if full}
		{@const r = page.header.rect}
		{@const numbered = page.header.number !== ''}
		<rect
			x={r.x}
			y={r.y}
			width={r.width}
			height={r.height}
			fill="none"
			stroke={INK}
			stroke-width="2.5"
		/>
		{#if numbered}
			<rect x={r.x} y={r.y} width={page.header.numberBlockWidth} height={r.height} fill={INK} />
			<text
				x={r.x + page.header.numberBlockWidth / 2}
				y={r.y + 17}
				font-family={PRINT_FONT}
				font-size="10"
				font-weight="bold"
				text-anchor="middle"
				fill="#fff"
			>
				STAGE
			</text>
			<text
				x={r.x + page.header.numberBlockWidth / 2}
				y={r.y + 50}
				font-family={PRINT_FONT}
				font-size={page.header.numberFontPx}
				font-weight="bold"
				text-anchor="middle"
				fill="#fff"
			>
				{page.header.number}
			</text>
		{/if}
		<text
			x={page.header.titleX}
			y={r.y + 31}
			font-family={PRINT_FONT}
			font-size={page.header.titleFontPx}
			font-weight="bold"
			fill={INK}
		>
			{page.header.title.toUpperCase()}
		</text>
		{#if page.header.sub}
			<text x={page.header.titleX} y={r.y + 49} font-family={PRINT_FONT} font-size="12" fill="#333">
				{page.header.sub}
			</text>
		{/if}
	{:else}
		{@const r = page.header.rect}
		<text
			x={r.x}
			y={r.y + 19}
			font-family={PRINT_FONT}
			font-size="13"
			font-weight="bold"
			fill={INK}
		>
			{page.header.title}
		</text>
		<line
			x1={r.x}
			x2={r.x + r.width}
			y1={r.y + r.height}
			y2={r.y + r.height}
			stroke={INK}
			stroke-width="1.5"
		/>
	{/if}

	{#if page.kind === 'stage'}
		{@const d = page.diagram}
		<rect
			data-testid="print-diagram-frame"
			x={d.x}
			y={d.y}
			width={d.width}
			height={d.height}
			fill="none"
			stroke={INK}
			stroke-width="1.5"
		/>
		<PrintDiagram {doc} {canvas} unit={plan.unit} area={d} {symbolPx} {depth} tiles={page.tiles} />
		{#each page.facts as f (f.label)}
			<rect
				x={f.box.x}
				y={f.box.y}
				width={f.box.width}
				height={f.box.height}
				fill="none"
				stroke={INK}
				stroke-width="1"
			/>
			<text
				x={f.box.x + 6}
				y={f.box.y + 15}
				font-family={PRINT_FONT}
				font-size="9"
				font-weight="bold"
				fill="#444"
			>
				{f.label.toUpperCase()}
			</text>
			{@render block(f.block)}
		{/each}
		{#each page.headings as b, i (i)}{@render block(b, '#444')}{/each}
		{#each page.procedure as b, i (i)}{@render block(b)}{/each}
		{#each page.notes as b, i (i)}{@render block(b)}{/each}
		{#if page.pointer}
			<text
				x={page.facts[0].box.x}
				y={page.facts[0].box.y + page.facts[0].box.height + 30}
				font-family={PRINT_FONT}
				font-size="13"
				font-weight="bold"
				fill={INK}
			>
				{page.pointer}
			</text>
		{/if}
	{:else if page.kind === 'continued'}
		{#each page.headings as b, i (i)}{@render block(b, '#444')}{/each}
		{#each page.facts as b, i (i)}{@render block(b)}{/each}
		{#each page.procedure as b, i (i)}{@render block(b)}{/each}
		{#each page.notes as b, i (i)}{@render block(b)}{/each}
	{:else}
		{@const d = page.diagram}
		<rect
			data-testid="print-diagram-frame"
			x={d.x}
			y={d.y}
			width={d.width}
			height={d.height}
			fill="none"
			stroke={INK}
			stroke-width="1.5"
		/>
		<PrintDiagram {doc} {canvas} unit={plan.unit} area={d} view={page.tile} {symbolPx} {depth} />
		<!-- Tiles fill their frame, so the scale bar and downrange arrow sit in the header. -->
		{@const r = page.header.rect}
		{@const bar = scaleBar(d.width / page.tile.width, plan.unit, 110)}
		<g data-print-scalebar transform="translate({r.x + r.width - 120 - bar.px} {r.y + 20})">
			<path d="M0 0H{bar.px}M0 -5V0M{bar.px} -5V0" fill="none" stroke={INK} stroke-width="1.5" />
			<text x="0" y="-8" font-family={PRINT_FONT} font-size="9" fill={INK}>{bar.label}</text>
		</g>
		<g transform="translate({r.x + r.width - 86} {r.y})">
			<line x1="0" x2="0" y1="24" y2="8" stroke="#555" stroke-width="1.5" />
			<path d="M-5 14 L0 6 L5 14" fill="none" stroke="#555" stroke-width="1.5" />
			<text x="8" y="20" font-family={PRINT_FONT} font-size="9" fill="#555">Downrange</text>
		</g>
	{/if}

	<line
		x1={page.header.rect.x}
		x2={w - page.header.rect.x}
		y1={page.footer.y - 13}
		y2={page.footer.y - 13}
		stroke="#999"
		stroke-width="0.75"
	/>
	<text x={page.header.rect.x} y={page.footer.y} font-family={PRINT_FONT} font-size="9" fill="#444">
		{page.footer.left}
	</text>
	<text
		x={w - page.header.rect.x}
		y={page.footer.y}
		font-family={PRINT_FONT}
		font-size="9"
		text-anchor="end"
		fill="#444"
	>
		{page.footer.right}
	</text>
</svg>
