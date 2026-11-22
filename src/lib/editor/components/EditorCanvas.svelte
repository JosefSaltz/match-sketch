<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { Point } from '#lib/geometry/types.js';
	import type { EditorState } from '../editor-state.svelte.js';
	import { PointerGestures } from '../gestures.js';
	import BayLayer from './BayLayer.svelte';
	import ScaleBar from './ScaleBar.svelte';

	let { editor }: { editor: EditorState } = $props();

	const gestures = new PointerGestures();

	function local(e: {
		clientX: number;
		clientY: number;
		currentTarget: EventTarget | null;
	}): Point {
		const target = e.currentTarget as Element;
		const svg = target instanceof SVGSVGElement ? target : (target as SVGElement).ownerSVGElement!;
		const r = svg.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	/** Wheel zoom needs a non-passive listener so the page doesn't scroll. */
	const wheelZoom: Attachment<SVGSVGElement> = (svg) => {
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			editor.zoomBy(Math.exp(-e.deltaY * 0.0015), local(e));
		};
		svg.addEventListener('wheel', onWheel, { passive: false });
		return () => svg.removeEventListener('wheel', onWheel);
	};

	function capture(e: PointerEvent) {
		try {
			(e.currentTarget as Element).setPointerCapture(e.pointerId);
		} catch {
			// Synthetic events can carry pointer ids the browser doesn't know.
		}
	}

	function onBackgroundDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		capture(e);
		gestures.down(e.pointerId, local(e));
	}

	function onMove(e: PointerEvent) {
		const action = gestures.move(e.pointerId, local(e));
		if (!action) return;
		if (action.kind === 'pinch') editor.zoomBy(action.factor, action.at);
		editor.panBy(action.dx, action.dy);
	}

	function onUp(e: PointerEvent) {
		gestures.up(e.pointerId);
	}
</script>

<div class="stage" bind:clientWidth={editor.screenWidth} bind:clientHeight={editor.screenHeight}>
	<svg
		{@attach wheelZoom}
		width={editor.screenWidth}
		height={editor.screenHeight}
		role="application"
		aria-label="Stage canvas"
		onpointermove={onMove}
		onpointerup={onUp}
		onpointercancel={onUp}
	>
		<rect
			class="background"
			x="0"
			y="0"
			width={editor.screenWidth}
			height={editor.screenHeight}
			role="presentation"
			onpointerdown={onBackgroundDown}
		/>
		<BayLayer {editor} />
		<ScaleBar {editor} />
	</svg>
</div>

<style>
	.stage {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--color-surface);
	}
	svg {
		display: block;
		touch-action: none;
		user-select: none;
	}
	.background {
		fill: transparent;
		cursor: grab;
	}
</style>
