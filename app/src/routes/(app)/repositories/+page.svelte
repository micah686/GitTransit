<script lang="ts">
	import { resolve } from '$app/paths';
	let { data, form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Inventory</div>
		<h1>Repository routes</h1>
		<p class="lede">Filter, inspect, and run owned mappings.</p>
	</div>
</div>
<form method="GET" class="filter-bar">
	<input
		class="input-bordered input"
		name="q"
		placeholder="Repository path"
		value={data.filters.text ?? ''}
	/><select class="select-bordered select" name="status"
		><option value="">Any status</option
		>{#each ['planned', 'ready', 'syncing', 'synced', 'blocked', 'failed', 'missing', 'ignored'] as status (status)}<option
				value={status}>{status}</option
			>{/each}</select
	><select class="select-bordered select" name="direction"
		><option value="">Any direction</option><option value="one-way">One-way</option><option
			value="two-way">Two-way</option
		></select
	><button class="btn btn-outline">Filter</button>
</form>
{#if form?.queued !== undefined}<div class="alert alert-success">
		Queued {form.queued} routes.
	</div>{/if}{#if form?.error}<div class="alert alert-error">{form.error}</div>{/if}
<form method="POST" action="?/run">
	<div class="bulk-bar"><button class="btn btn-primary btn-sm">Run selected</button></div>
	<section class="route-list">
		{#each data.routes as route (route.routeId)}<article>
				<input
					class="checkbox"
					type="checkbox"
					name="routeId"
					value={route.routeId}
					aria-label={`Select ${route.sourcePath}`}
				/>
				<div>
					<a href={resolve(`/repositories/${route.routeId}`)}><strong>{route.sourcePath}</strong></a
					><small>{route.pairName}</small>
				</div>
				<span aria-label="mirrors to">⇒</span>
				<div>
					<strong>{route.targetPath ?? 'Awaiting provisioning'}</strong><small
						>{route.warning ?? ''}</small
					>
				</div>
				<span class="badge badge-outline">{route.status}</span>
			</article>{/each}
	</section>
</form>
