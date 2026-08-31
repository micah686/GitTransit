<script lang="ts">
	import { resolve } from '$app/paths';
	let { data } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Control plane</div>
		<h1>Good to see you</h1>
	</div>
	<a class="btn btn-primary" href={resolve('/pairs/new')}>Create mirror pair</a>
</div>
<section class="welcome-panel alert alert-info shadow-none" aria-labelledby="clear-map-title">
	<div class="welcome-icon" aria-hidden="true">⇄</div>
	<div>
		<h2 id="clear-map-title">Your transit map is clear</h2>
		<p>Connect your Git services, then map repositories into safe one-way or two-way flows.</p>
	</div>
</section>
<section aria-labelledby="overview-title">
	<div class="section-heading">
		<h2 id="overview-title">Overview</h2>
		<span>{data.counts.activeRuns} active jobs</span>
	</div>
	<div class="stat-grid stats stats-vertical bg-base-100 shadow-none sm:stats-horizontal">
		<div class="stat-card stat">
			<span>Connections</span><strong>{data.counts.connections}</strong><small
				>Configured services</small
			>
		</div>
		<div class="stat-card stat">
			<span>Mirror pairs</span><strong>{data.counts.pairs}</strong><small>Configured flows</small>
		</div>
		<div class="stat-card stat">
			<span>Repository routes</span><strong>{data.counts.routes}</strong><small
				>Mapped repositories</small
			>
		</div>
		<div class="stat-card stat">
			<span>Open conflicts</span><strong>{data.counts.conflicts}</strong><small
				>Needs attention</small
			>
		</div>
		<div class="stat-card stat">
			<span>Pending approvals</span><strong>{data.counts.approvals}</strong><small
				>Destructive plans awaiting review</small
			>
		</div>
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
	<a class="btn btn-outline" href={resolve('/connections/new')}>Add connection</a>
</section>
