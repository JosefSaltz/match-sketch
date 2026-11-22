<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'danger' | 'icon';
	type Props = Omit<HTMLButtonAttributes, 'class' | 'children'> & {
		variant?: Variant;
		/** Renders a link styled as a button. */
		href?: string;
		class?: string;
		children: Snippet;
	};
	let {
		variant = 'secondary',
		href,
		class: extra = '',
		type = 'button',
		children,
		...rest
	}: Props = $props();

	const BASE =
		'focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-[3px] border-black font-display text-sm tracking-wide uppercase no-underline shadow-[3px_3px_0_#000] transition-[translate,box-shadow] duration-75 select-none active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#000] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-0 disabled:active:shadow-[3px_3px_0_#000]';
	const VARIANT: Record<Variant, string> = {
		primary: 'bg-theme px-4 text-outline-sm',
		secondary: 'bg-white px-4 text-black',
		danger: 'bg-white px-4 text-danger',
		icon: 'w-11 bg-white text-black'
	};
	const classes = $derived([BASE, VARIANT[variant], extra]);
</script>

{#if href}
	<!-- Callers pass resolve()d paths; this component only styles the link. -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a {href} class={classes} {...rest as HTMLAnchorAttributes}>{@render children()}</a>
{:else}
	<button {type} class={classes} {...rest}>{@render children()}</button>
{/if}
