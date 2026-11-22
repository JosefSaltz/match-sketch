<script lang="ts">
	import { getEntry } from '#lib/catalog/index.js';
	import { fromFeet, toFeet } from '#lib/geometry/units.js';
	import type { PlanObject } from '#lib/model/plan.js';
	import type { EditorState } from '../editor-state.svelte.js';
	import Button from '#lib/ui/Button.svelte';
	import { controlClass } from '#lib/ui/styles.js';
	import type { ObjectPatch } from '../ops.js';

	let { editor }: { editor: EditorState } = $props();

	const uid = $props.id();
	const unit = $derived(editor.plan.unit);
	const objectCount = $derived(editor.selectedObjects.length);
	const count = $derived(objectCount + editor.selectedAnnotations.length);
	const obj = $derived(count === 1 && objectCount === 1 ? editor.selectedObjects[0] : null);
	const ann = $derived(count === 1 && objectCount === 0 ? editor.selectedAnnotations[0] : null);
	const entry = $derived(obj ? getEntry(obj.symbolId) : undefined);

	/** A length in the plan's unit, to two decimals at most. */
	const shown = (ft: number) => String(Math.round(fromFeet(ft, unit) * 100) / 100);

	type Field = {
		label: string;
		key: string;
		/** The value shown for an object. */
		read: (o: PlanObject) => string;
		/** The change to store for a valid number typed into the field. */
		patch: (v: number) => ObjectPatch;
		min?: number;
		max?: number;
		step?: string;
	};

	const footprintSize = (o: PlanObject, dim: 'widthFt' | 'depthFt') => {
		const e = getEntry(o.symbolId);
		return o[dim] ?? (e?.kind === 'footprint' ? e.footprint[dim] : 0);
	};

	const fields = $derived.by((): Field[] => {
		const list: Field[] = [];
		if (entry?.countable) {
			list.push({
				label: 'Count',
				key: 'count',
				read: (o) => String(o.count ?? 1),
				patch: (v) => ({ count: v }),
				min: 1,
				max: 99,
				step: '1'
			});
		}
		list.push(
			{
				label: 'Rotation (°)',
				key: 'rotation',
				read: (o) => String(o.rotation),
				patch: (v) => ({ rotation: v })
			},
			{ label: 'X', key: 'x', read: (o) => shown(o.x), patch: (v) => ({ x: toFeet(v, unit) }) },
			{ label: 'Y', key: 'y', read: (o) => shown(o.y), patch: (v) => ({ y: toFeet(v, unit) }) }
		);
		if (entry?.kind === 'footprint') {
			list.push(
				{
					label: 'Width',
					key: 'width',
					read: (o) => shown(footprintSize(o, 'widthFt')),
					patch: (v) => ({ widthFt: toFeet(v, unit) }),
					min: 0
				},
				{
					label: 'Depth',
					key: 'depth',
					read: (o) => shown(footprintSize(o, 'depthFt')),
					patch: (v) => ({ depthFt: toFeet(v, unit) }),
					min: 0
				}
			);
		}
		return list;
	});

	/** The object as stored right now (the handler's own copy may be stale after a commit). */
	const stored = (id: string) => editor.doc.objects.find((o) => o.id === id);

	type FieldEvent = Event & { currentTarget: HTMLInputElement };

	/**
	 * Commits a numeric field, then shows what was stored: blank or non-numeric input is
	 * rejected, and values the editor clamps (count, position, size) snap to the stored value.
	 */
	function commitNumber(e: FieldEvent, id: string, field: Field) {
		const input = e.currentTarget;
		const before = stored(id);
		if (!before) return;
		const raw = input.value.trim();
		const v = Number(raw);
		if (raw !== '' && Number.isFinite(v) && raw !== field.read(before)) {
			editor.setProps(id, field.patch(v));
		}
		const after = stored(id);
		if (after) input.value = field.read(after);
	}

	function commitLabel(e: FieldEvent, id: string) {
		const input = e.currentTarget;
		const before = stored(id);
		if (!before) return;
		if (input.value.trim() !== (before.label ?? '')) editor.setProps(id, { label: input.value });
		input.value = stored(id)?.label ?? '';
	}

	function commitText(e: FieldEvent, id: string) {
		const input = e.currentTarget;
		editor.setText(id, input.value);
		const stored = editor.doc.annotations.find((a) => a.id === id);
		if (stored?.type === 'text') input.value = stored.text;
	}

	/** Enter leaves the field, which commits it through its change event. */
	function blurOnEnter(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key === 'Enter') e.currentTarget.blur();
	}
</script>

<!-- The Properties tab of the side panel; SidePanel provides the scrolling tab panel. -->
<div>
	{#if obj}
		{@const o = obj}
		<h3 class="m-0 mb-3 text-base font-semibold">{entry?.name ?? o.symbolId}</h3>
		<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
			<label for="{uid}-label" class="text-sm text-muted">Label</label>
			<input
				id="{uid}-label"
				type="text"
				maxlength="24"
				class={controlClass}
				value={o.label ?? ''}
				onchange={(e) => commitLabel(e, o.id)}
				onkeydown={blurOnEnter}
			/>
			{#each fields as field (field.key)}
				<label for="{uid}-{field.key}" class="text-sm text-muted">{field.label}</label>
				<input
					id="{uid}-{field.key}"
					type="number"
					min={field.min}
					max={field.max}
					step={field.step ?? 'any'}
					class={controlClass}
					value={field.read(o)}
					onchange={(e) => commitNumber(e, o.id, field)}
					onkeydown={blurOnEnter}
				/>
			{/each}
		</div>
		<p class="mt-2 mb-0 text-xs text-muted">
			Positions and sizes in {unit === 'yd' ? 'yards' : 'feet'}.
		</p>
		<div class="mt-4 grid grid-cols-2 gap-2">
			<Button onclick={() => editor.duplicateSelected()}>Duplicate</Button>
			<Button variant="danger" onclick={() => editor.deleteSelected()}>Delete</Button>
			<Button onclick={() => editor.bringToFront(o.id)}>Bring to front</Button>
			<Button onclick={() => editor.sendToBack(o.id)}>Send to back</Button>
		</div>
	{:else if ann?.type === 'text'}
		{@const a = ann}
		<h3 class="m-0 mb-3 text-base font-semibold">Text label</h3>
		<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
			<label for="{uid}-text" class="text-sm text-muted">Text</label>
			<input
				id="{uid}-text"
				type="text"
				maxlength="200"
				class={controlClass}
				value={a.text}
				onchange={(e) => commitText(e, a.id)}
				onkeydown={blurOnEnter}
			/>
		</div>
		<div class="mt-4 grid grid-cols-2 gap-2">
			<Button variant="danger" onclick={() => editor.deleteSelected()}>Delete</Button>
		</div>
	{:else if count > 1}
		<h3 class="m-0 mb-3 text-base font-semibold">
			{count}
			{objectCount === count ? 'objects' : 'items'} selected
		</h3>
		<div class="grid grid-cols-2 gap-2">
			{#if objectCount > 0}
				<Button onclick={() => editor.duplicateSelected()}>Duplicate</Button>
			{/if}
			<Button variant="danger" onclick={() => editor.deleteSelected()}>Delete</Button>
		</div>
	{:else}
		<p class="m-0 text-muted">Select an object to edit it</p>
	{/if}
</div>
