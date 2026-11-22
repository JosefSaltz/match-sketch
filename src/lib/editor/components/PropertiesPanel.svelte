<script lang="ts">
	import { getEntry } from '#lib/catalog/index.js';
	import { fromFeet, toFeet } from '#lib/geometry/units.js';
	import type { PlanObject } from '#lib/model/plan.js';
	import type { EditorState } from '../editor-state.svelte.js';
	import type { ObjectPatch } from '../ops.js';

	let { editor }: { editor: EditorState } = $props();

	const uid = $props.id();
	const unit = $derived(editor.plan.unit);
	const count = $derived(editor.selectedObjects.length);
	const obj = $derived(count === 1 ? editor.selectedObjects[0] : null);
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

	/** Enter leaves the field, which commits it through its change event. */
	function blurOnEnter(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key === 'Enter') e.currentTarget.blur();
	}
</script>

<aside class="properties" aria-label="Properties">
	{#if obj}
		{@const o = obj}
		<h2 class="title">{entry?.name ?? o.symbolId}</h2>
		<div class="fields">
			<label for="{uid}-label">Label</label>
			<input
				id="{uid}-label"
				type="text"
				maxlength="24"
				value={o.label ?? ''}
				onchange={(e) => commitLabel(e, o.id)}
				onkeydown={blurOnEnter}
			/>
			{#each fields as field (field.key)}
				<label for="{uid}-{field.key}">{field.label}</label>
				<input
					id="{uid}-{field.key}"
					type="number"
					min={field.min}
					max={field.max}
					step={field.step ?? 'any'}
					value={field.read(o)}
					onchange={(e) => commitNumber(e, o.id, field)}
					onkeydown={blurOnEnter}
				/>
			{/each}
		</div>
		<p class="unit">Positions and sizes in {unit === 'yd' ? 'yards' : 'feet'}.</p>
		<div class="actions">
			<button type="button" onclick={() => editor.duplicateSelected()}>Duplicate</button>
			<button type="button" class="danger" onclick={() => editor.deleteSelected()}>Delete</button>
			<button type="button" onclick={() => editor.bringToFront(o.id)}>Bring to front</button>
			<button type="button" onclick={() => editor.sendToBack(o.id)}>Send to back</button>
		</div>
	{:else if count > 1}
		<h2 class="title">{count} objects selected</h2>
		<div class="actions">
			<button type="button" onclick={() => editor.duplicateSelected()}>Duplicate</button>
			<button type="button" class="danger" onclick={() => editor.deleteSelected()}>Delete</button>
		</div>
	{:else}
		<p class="empty">Select an object to edit it</p>
	{/if}
</aside>

<style>
	.properties {
		border-left: 1px solid var(--color-border);
		overflow-y: auto;
		padding: var(--space-3);
		background: var(--color-bg);
	}
	.title {
		margin: 0 0 var(--space-3);
		font-size: 1rem;
	}
	.fields {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-3);
		align-items: center;
	}
	label {
		font-size: 0.875rem;
		color: var(--color-muted);
	}
	input {
		min-width: 0;
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}
	.unit {
		margin: var(--space-2) 0 0;
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.actions button {
		min-height: 36px;
	}
	.danger {
		color: var(--color-danger);
	}
	.empty {
		color: var(--color-muted);
	}
</style>
