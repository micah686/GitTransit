<script lang="ts">
	let { data } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Control plane</div>
		<h1>Good to see you</h1>
	</div>
	<button class="btn btn-primary" type="button" disabled>Create mirror pair</button>
</div>
<section class="welcome-panel">
	<div class="welcome-icon" aria-hidden="true">⇄</div>
	<div>
		<h2>Your transit map is clear</h2>
		<p>Connect your Git services, then map repositories into safe one-way or two-way flows.</p>
	</div>
</section>
<section aria-labelledby="overview-title">
	<div class="section-heading">
		<h2 id="overview-title">Overview</h2>
		<span>{data.counts.activeRuns} active jobs</span>
	</div>
	<div class="stat-grid">
		<article class="stat-card">
			<span>Connections</span><strong>{data.counts.connections}</strong><small
				>Configured services</small
			>
		</article>
		<article class="stat-card">
			<span>Mirror pairs</span><strong>{data.counts.pairs}</strong><small>Configured flows</small>
		</article>
		<article class="stat-card">
			<span>Repository routes</span><strong>{data.counts.routes}</strong><small
				>Mapped repositories</small
			>
		</article>
		<article class="stat-card">
			<span>Open conflicts</span><strong>{data.counts.conflicts}</strong><small
				>Needs attention</small
			>
		</article>
	</div>
</section>
<section class="next-step" aria-labelledby="next-title">
	<div>
		<span class="step-number">1</span>
		<div>
			<h2 id="next-title">Add your first connection</h2>
			<p>Credentials stay encrypted and are never returned to the browser.</p>
		</div>
	</div>
	<button class="btn btn-outline" type="button" disabled>Coming in Phase 4</button>
</section>
