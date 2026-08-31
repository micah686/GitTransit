<script lang="ts">
	let { data, form } = $props();
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
<form method="POST" class="form-panel form-stack">
	<div class="route-grid">
		<label class="form-field"
			><span>Run retention days</span><input
				class="input-bordered input"
				type="number"
				name="runRetentionDays"
				value="90"
				min="1"
				max="3650"
			/></label
		>
		<label class="form-field"
			><span>Artifact retention days</span><input
				class="input-bordered input"
				type="number"
				name="artifactRetentionDays"
				value="30"
				min="1"
				max="3650"
			/></label
		>
		<label class="form-field"
			><span>Newest artifacts kept per route</span><input
				class="input-bordered input"
				type="number"
				name="artifactKeepNewest"
				value="3"
				min="1"
				max="100"
			/></label
		>
	</div>
	<div class="form-actions">
		<button class="btn btn-outline" formaction="?/preview">Preview cleanup</button><button
			class="btn btn-warning"
			formaction="?/apply">Run cleanup</button
		>
	</div>
</form>
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
		<article class="stat-card">
			<span>Notification deliveries</span><strong>{form.result.notificationDeliveries}</strong>
		</article>
	</section>{/if}
<section class="route-list" aria-labelledby="maintenance-history">
	<h2 id="maintenance-history">Recent maintenance</h2>
	{#each data.history as item (item.id)}<article>
			<div>
				<strong>{item.dryRun ? 'Preview' : 'Applied'} retention cleanup</strong><small
					>{new Date(item.createdAt).toLocaleString()} · {item.result.runs} runs · {item.result
						.artifacts} artifacts</small
				>
			</div>
			<span class="badge">{item.kind}</span>
		</article>{:else}<p>No maintenance runs recorded.</p>{/each}
</section>
