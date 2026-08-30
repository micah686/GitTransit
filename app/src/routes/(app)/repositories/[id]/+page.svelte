<script lang="ts">
	let { data } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Repository route</div>
		<h1>{data.route.sourcePath}</h1>
		<p class="lede">{data.route.pairName} · {data.route.direction}</p>
	</div>
	<span class="badge badge-outline">{data.route.status}</span>
</div>
<section class="detail-grid">
	<article>
		<h2>Side A</h2>
		<p>{data.route.sourcePath}</p>
		<code>{data.route.sourceUrl}</code>
	</article>
	<article>
		<h2>Side B</h2>
		<p>{data.route.targetPath ?? 'Not provisioned'}</p>
		<code>{data.route.targetUrl ?? 'Target endpoint will be persisted after provisioning.'}</code>
	</article>
</section>
{#if data.route.warning}<div class="alert alert-warning">{data.route.warning}</div>{/if}
