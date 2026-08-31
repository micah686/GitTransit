<script lang="ts">
	import { resolve } from '$app/paths';
	let { data, form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Mirror pair</div>
		<h1>{data.pair.name}</h1>
		<p class="lede">
			{data.pair.sourceProvider}
			{data.pair.sourceHost} ⇒ {data.pair.targetProvider}
			{data.pair.targetHost}
		</p>
	</div>
	<div class="form-actions">
		<form method="POST" action="?/refresh">
			<button class="btn btn-outline">Refresh inventory</button>
		</form>
		<form method="POST" action="?/run"><button class="btn btn-primary">Run pair</button></form>
	</div>
</div>
{#if form?.error}<div class="alert alert-error">{form.error}</div>{/if}{#if form?.runId}<div
		class="alert alert-success"
	>
		Discovery queued. Route proposals update after the scan.
	</div>{/if}
<section class="route-list">
	<h2>Routes</h2>
	{#each data.routes as route (route.id)}<article>
			<div>
				<strong>{route.namespace}/{route.name}</strong><small
					>{route.warning ?? 'Ready for one-way synchronization'}</small
				>
			</div>
			<span class="badge">{route.status}</span><a
				class="btn btn-ghost btn-sm"
				href={resolve(`/repositories/${route.id}`)}>View</a
			>
		</article>{/each}
</section>
<section class="route-list" aria-labelledby="metadata-title">
	<h2 id="metadata-title">One-way forge metadata</h2>
	<p class="lede">
		Authority: {data.metadata.policy.authority ?? 'Side A for one-way pairs'}. Metadata never flows
		from Side B.
	</p>
	{#each Object.entries(data.metadata.policy.components) as [component, mode] (component)}
		{#if mode !== 'off'}
			{@const status = data.metadata.mappings.find((item) => item.component === component)}
			<article>
				<div>
					<strong>{component}</strong><small
						>{status
							? `${status.itemCount} mapped · last synced ${new Date(status.lastSyncedAt).toLocaleString()}`
							: 'Enabled; no successful item mappings yet'}</small
					>
				</div>
				<span class="badge">{mode}</span>
			</article>
		{/if}
	{/each}
	{#if data.metadata.rateLimits.length}
		<h3>Provider rate budgets</h3>
		{#each data.metadata.rateLimits as limit (`${limit.category}:${limit.resetAt}`)}
			<p>
				<code>{limit.category}</code>: {limit.remaining ?? 'unknown'} / {limit.limitValue ??
					'unknown'} remaining
			</p>
		{/each}
	{/if}
</section>
