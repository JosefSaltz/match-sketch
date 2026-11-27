<svelte:options namespace="svg" />

<script lang="ts">
	import { getEntry } from '#lib/catalog/index.js';
	import { resolveAnchor } from '#lib/editor/annotations.js';
	import { localBox, rotatedBounds } from '#lib/editor/object-geometry.js';
	import { worldToScreen, type Viewport } from '#lib/geometry/viewport.js';
	import type { Mark, PlanDocument, Step } from '#lib/model/plan.js';
	import MeaningBadge from './MeaningBadge.svelte';
	import { MEANING_STYLES } from './meanings.js';

	/**
	 * A walkthrough step's highlights over a drawn plan (spec §7.10): a ring in the meaning's color
	 * around each marked object, with its badge at the upper right. With `arrows`, the step's arrows
	 * are traced over in ink too (the print diagram draws them itself). SVG attributes only.
	 */
	type Props = {
		doc: PlanDocument;
		step: Step;
		viewport: Viewport;
		symbolPx: number;
		arrows?: boolean;
	};
	let { doc, step, viewport, symbolPx, arrows = false }: Props = $props();

	const RING = 3;
	type Badge = { x: number; y: number; r: number };
	type Ring =
		| { mark: Mark; shape: 'box'; transform: string; rect: Rect; badge: Badge }
		| { mark: Mark; shape: 'circle'; cx: number; cy: number; r: number; badge: Badge };
	type Rect = { x: number; y: number; width: number; height: number };
	const at = (p: { x: number; y: number }) => worldToScreen(p, viewport);

	const rings: Ring[] = $derived(
		step.marks.flatMap((mark): Ring[] => {
			const obj = doc.objects.find((o) => o.id === mark.objectId);
			if (!obj) return [];
			const entry = getEntry(obj.symbolId);
			const pos = at(obj);
			const box = localBox(obj, entry, viewport.scale, symbolPx);
			const bounds = rotatedBounds(box, obj.rotation);
			const cx = pos.x + bounds.x + bounds.width / 2;
			const cy = pos.y + bounds.y + bounds.height / 2;
			const badgeR = Math.max(9, symbolPx * 0.34);
			if (entry?.kind === 'footprint') {
				const pad = RING + 2;
				return [
					{
						mark,
						shape: 'box',
						transform: `translate(${pos.x} ${pos.y}) rotate(${obj.rotation})`,
						rect: {
							x: box.x - pad,
							y: box.y - pad,
							width: box.width + pad * 2,
							height: box.height + pad * 2
						},
						badge: { x: pos.x + bounds.x + bounds.width + 2, y: pos.y + bounds.y - 2, r: badgeR }
					}
				];
			}
			const r = Math.max(bounds.width, bounds.height) * 0.62 + RING;
			return [
				{
					mark,
					shape: 'circle',
					cx,
					cy,
					r,
					badge: { x: cx + r * 0.72, y: cy - r * 0.72, r: badgeR }
				}
			];
		})
	);

	const traced = $derived(
		arrows
			? doc.annotations.flatMap((a) => {
					if (a.type !== 'arrow' || !step.arrows.includes(a.id)) return [];
					const from = resolveAnchor(doc, a.from);
					const to = resolveAnchor(doc, a.to);
					return from && to ? [{ id: a.id, p: at(from), q: at(to) }] : [];
				})
			: []
	);
</script>

<g data-step-highlights={step.id} pointer-events="none">
	{#each traced as t (t.id)}
		<line
			data-step-arrow={t.id}
			x1={t.p.x}
			y1={t.p.y}
			x2={t.q.x}
			y2={t.q.y}
			stroke="#1c1c1a"
			stroke-width="4"
			stroke-linecap="round"
			opacity="0.55"
		/>
	{/each}
	{#each rings as ring (ring.mark.objectId)}
		{@const color = MEANING_STYLES[ring.mark.meaning].color}
		<g data-highlight={ring.mark.objectId} data-meaning={ring.mark.meaning}>
			{#if ring.shape === 'box'}
				<rect
					transform={ring.transform}
					x={ring.rect.x}
					y={ring.rect.y}
					width={ring.rect.width}
					height={ring.rect.height}
					rx="3"
					fill="none"
					stroke={color}
					stroke-width={RING}
				/>
			{:else}
				<circle
					cx={ring.cx}
					cy={ring.cy}
					r={ring.r}
					fill="none"
					stroke={color}
					stroke-width={RING}
				/>
			{/if}
			<MeaningBadge meaning={ring.mark.meaning} {...ring.badge} />
		</g>
	{/each}
</g>
