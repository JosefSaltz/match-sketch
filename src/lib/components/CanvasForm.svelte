<script lang="ts">
	import { untrack } from 'svelte';
	import { formatNumber, fromFeet, toFeet, type LengthUnit } from '#lib/geometry/units.js';
	import { MAX_CANVAS_FT, MIN_CANVAS_FT, type CanvasInput } from '#lib/store/records.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import Toggle from '#lib/ui/Toggle.svelte';

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

	const uid = $props.id();
	const formId = `canvas-form-${uid}`;

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

<form id={formId} class="grid gap-4" onsubmit={submit} novalidate>
	<Field label="Name" id="{formId}-name" error={errors.name}>
		{#snippet children({ id, describedby })}
			<input
				{id}
				type="text"
				class={controlClass}
				bind:value={name}
				maxlength="80"
				aria-invalid={!!errors.name}
				aria-describedby={describedby}
			/>
		{/snippet}
	</Field>

	<Field label="Unit" id="{formId}-unit">
		{#snippet children({ id })}
			<select {id} class={controlClass} bind:value={unit}>
				<option value="ft">Feet</option>
				<option value="yd">Yards</option>
			</select>
		{/snippet}
	</Field>

	<div class="grid grid-cols-2 gap-3">
		<Field label="Width" id="{formId}-width" error={errors.width}>
			{#snippet children({ id, describedby })}
				<input
					{id}
					type="text"
					inputmode="decimal"
					class={controlClass}
					bind:value={width}
					aria-invalid={!!errors.width}
					aria-describedby={describedby}
				/>
			{/snippet}
		</Field>
		<Field label="Depth" id="{formId}-depth" error={errors.depth}>
			{#snippet children({ id, describedby })}
				<input
					{id}
					type="text"
					inputmode="decimal"
					class={controlClass}
					bind:value={depth}
					aria-invalid={!!errors.depth}
					aria-describedby={describedby}
				/>
			{/snippet}
		</Field>
	</div>

	{#if showSaveToLibrary}
		<Toggle label="Save to my canvas library" bind:checked={saveToLibrary} />
	{/if}

	<div class="flex flex-wrap justify-end gap-3">
		{#if oncancel}<Button onclick={oncancel}>Cancel</Button>{/if}
		<Button type="submit" variant="primary">{submitLabel}</Button>
	</div>
</form>
