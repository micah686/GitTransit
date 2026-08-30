<script lang="ts">
	import { resolve } from '$app/paths';
	let { children } = $props();
</script>

<main id="main-content" class="public-shell">
	<a class="brand brand-centered" href={resolve('/')} aria-label="GitTransit home">
		<span class="brand-mark" aria-hidden="true">⇄</span>
		<span>GitTransit</span>
	</a>
	{@render children()}
</main>
