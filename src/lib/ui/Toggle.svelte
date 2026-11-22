<script lang="ts">
	/** A real checkbox drawn as a switch, so labels, keyboard and tests treat it as a checkbox. */
	type Props = { label: string; checked?: boolean; id?: string };
	let { label, checked = $bindable(false), id }: Props = $props();
</script>

<label class="inline-flex min-h-11 cursor-pointer items-center gap-3">
	<input
		{id}
		type="checkbox"
		bind:checked
		class="focus-ring relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full border-[3px] border-black bg-white transition-colors before:absolute before:top-[3px] before:left-[3px] before:size-4 before:rounded-full before:bg-black before:transition-transform before:content-[''] checked:bg-theme checked:before:translate-x-5 checked:before:bg-white forced-colors:border-[CanvasText] forced-colors:checked:bg-[Highlight]"
	/>
	<span>{label}</span>
</label>
