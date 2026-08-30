<script lang="ts">
	let { data, form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Inventory</div>
		<h1>Repositories</h1>
	</div>
</div>
{#if form?.queued}<div class="alert alert-success" role="status">
		Sync run queued. The worker will execute it with a route lease.
	</div>{/if}
{#if form?.error}<div class="alert alert-error" role="alert">{form.error}</div>{/if}
{#if data.routes.length === 0}<section class="welcome-panel">
		<div>
			<h2>No repository routes yet</h2>
			<p>Create and preview a manual route from Mirror pairs.</p>
		</div>
	</section>{:else}<section class="route-list" aria-label="Repository routes">
		{#each data.routes as route (route.routeId)}<article>
				<div><strong>{route.sourcePath}</strong><small>{route.sourceUrl}</small></div>
				<span aria-label="mirrors to">⇒</span>
				<div><strong>{route.targetPath}</strong><small>{route.targetUrl}</small></div>
				<span class="badge badge-outline">{route.status}</span>
				<form method="POST" action="?/run">
					<input type="hidden" name="routeId" value={route.routeId} /><button
						class="btn btn-primary btn-sm"
						type="submit">Run</button
					>
				</form>
			</article>{/each}
	</section>{/if}
