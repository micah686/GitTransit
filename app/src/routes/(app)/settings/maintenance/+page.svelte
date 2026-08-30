<script lang="ts">
	let { form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Operations</div>
		<h1>Retention cleanup</h1>
		<p class="lede">
			Cleanup is owner-scoped and preserves active work, baselines, open conflicts, and at least the
			three newest verified bundles per route.
		</p>
	</div>
</div>
<div class="form-actions">
	<form method="POST" action="?/preview">
		<button class="btn btn-outline">Preview cleanup</button>
	</form>
	<form method="POST" action="?/apply"><button class="btn btn-warning">Run cleanup</button></form>
</div>
{#if form?.result}<section class="stat-grid">
		<article class="stat-card"><span>Events</span><strong>{form.result.events}</strong></article>
		<article class="stat-card"><span>Runs</span><strong>{form.result.runs}</strong></article>
		<article class="stat-card">
			<span>Observations</span><strong>{form.result.observations}</strong>
		</article>
		<article class="stat-card">
			<span>Artifacts</span><strong>{form.result.artifacts}</strong><small
				>{form.result.artifactBytes} bytes</small
			>
		</article>
	</section>{/if}
