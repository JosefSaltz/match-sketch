<script lang="ts">
	import { APP_NAME } from '#lib/app-info.js';
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<main class="home">
	<h1>{APP_NAME}</h1>
</main>

<style>
	.home {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--space-6) var(--space-4);
	}
</style>
