<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>GitTransit</title>
	<meta
		name="description"
		content="A self-hosted control plane for safe repository synchronization"
	/>
</svelte:head>
<a class="skip-link" href="#main-content">Skip to content</a>
{@render children()}
