<script lang="ts">
	import { resolve } from '$app/paths';
	let { data } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Operations</div>
		<h1>Activity</h1>
	</div>
</div>
<form class="filter-bar">
	<select class="select-bordered select" name="state"
		><option value="">All states</option
		>{#each ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as state (state)}<option
				value={state}>{state}</option
			>{/each}</select
	><button class="btn btn-outline">Filter</button>
</form>
<section class="route-list">
	{#each data.runs as run (run.id)}<article>
			<div>
				<a href={resolve(`/runs/${run.id}`)}
					><strong>{run.kind} · {run.pairName ?? 'Standalone'}</strong></a
				><small>{new Date(run.requestedAt).toLocaleString()}</small>
			</div>
			<progress
				class="progress progress-primary"
				value={run.progressCompleted}
				max={Math.max(1, run.progressTotal)}
			></progress><span class="badge">{run.state}</span>
		</article>{/each}
</section>
