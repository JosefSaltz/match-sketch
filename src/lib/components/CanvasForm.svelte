<script lang="ts">
	import { untrack } from 'svelte';
	import { formatNumber, fromFeet, toFeet, type LengthUnit } from '#lib/geometry/units.js';
	import { MAX_CANVAS_FT, MIN_CANVAS_FT, type CanvasInput } from '#lib/store/records.js';

	type Props = {
		initial?: { name: string; width: number; depth: number; unit: LengthUnit };
		submitLabel: string;
		onsubmit: (input: CanvasInput, saveToLibrary: boolean) => void;
		oncancel?: () => void;
		showSaveToLibrary?: boolean;
	};
	let { initial, submitLabel, onsubmit, oncancel, showSaveToLibrary = false }: Props = $props();

	// The form is mounted fresh each time it opens, so it only needs the initial values once.
	const start = untrack(() => initial);
	let name = $state(start?.name ?? '');
	let width = $state(start ? formatNumber(start.width) : '');
	let depth = $state(start ? formatNumber(start.depth) : '');
	let unit = $state<LengthUnit>(start?.unit ?? 'yd');
	let saveToLibrary = $state(false);
	let errors = $state<{ name?: string; width?: string; depth?: string }>({});

	const formId = `canvas-form-${crypto.randomUUID()}`;

	function parseLength(value: string): number | null {
		const t = value.trim();
		if (!/^\d+(\.\d+)?$/.test(t)) return null;
		return Number(t);
	}

	function rangeMessage(dimension: 'width' | 'depth'): string {
		const min = formatNumber(fromFeet(MIN_CANVAS_FT, unit));
		const max = formatNumber(fromFeet(MAX_CANVAS_FT, unit));
		return `Enter a ${dimension} between ${min} and ${max} ${unit}`;
	}

	function inRange(value: number | null): value is number {
		if (value === null) return false;
		const ft = toFeet(value, unit);
		return ft >= MIN_CANVAS_FT - 1e-9 && ft <= MAX_CANVAS_FT + 1e-9;
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const w = parseLength(width);
		const d = parseLength(depth);
		const next: typeof errors = {};
		if (!name.trim()) next.name = 'Name is required';
		if (!inRange(w)) next.width = rangeMessage('width');
		if (!inRange(d)) next.depth = rangeMessage('depth');
		errors = next;
		if (next.name || next.width || next.depth) return;
		onsubmit(
			{
				name: name.trim(),
				widthFt: toFeet(w as number, unit),
				depthFt: toFeet(d as number, unit),
				unit
			},
			saveToLibrary
		);
	}
</script>

<form id={formId} class="canvas-form" onsubmit={submit} novalidate>
	<label>
		<span>Name</span>
		<input type="text" bind:value={name} maxlength="80" aria-invalid={!!errors.name} />
	</label>
	{#if errors.name}<p class="error" role="alert">{errors.name}</p>{/if}

	<label>
		<span>Unit</span>
		<select bind:value={unit}>
			<option value="ft">Feet</option>
			<option value="yd">Yards</option>
		</select>
	</label>

	<div class="dims">
		<label>
			<span>Width</span>
			<input type="text" inputmode="decimal" bind:value={width} aria-invalid={!!errors.width} />
		</label>
		<label>
			<span>Depth</span>
			<input type="text" inputmode="decimal" bind:value={depth} aria-invalid={!!errors.depth} />
		</label>
	</div>
	{#if errors.width}<p class="error" role="alert">{errors.width}</p>{/if}
	{#if errors.depth}<p class="error" role="alert">{errors.depth}</p>{/if}

	{#if showSaveToLibrary}
		<label class="check">
			<input type="checkbox" bind:checked={saveToLibrary} />
			<span>Save to my canvas library</span>
		</label>
	{/if}

	<div class="actions">
		{#if oncancel}<button type="button" onclick={oncancel}>Cancel</button>{/if}
		<button type="submit" class="primary">{submitLabel}</button>
	</div>
</form>

<style>
	.canvas-form {
		display: grid;
		gap: var(--space-3);
	}
	label {
		display: grid;
		gap: var(--space-1);
	}
	label span {
		font-size: 0.9rem;
		color: var(--color-muted);
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.check span {
		color: var(--color-text);
	}
	.dims {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	input[type='text'],
	select {
		padding: var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}
	.error {
		margin: 0;
		color: var(--color-danger);
		font-size: 0.9rem;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.primary {
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-4);
	}
</style>
