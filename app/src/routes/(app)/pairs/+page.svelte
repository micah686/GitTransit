<script lang="ts">
	import { resolve } from '$app/paths';
	let { data, form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Flows</div>
		<h1>Mirror pairs</h1>
		<p class="lede">One-way flows between independently configured Git services.</p>
	</div>
	<a class="btn btn-primary" href={resolve('/pairs/new')}>Create pair</a>
</div>
{#if form?.error}<div class="alert alert-error" role="alert">{form.error}</div>{/if}
{#if form?.queued !== undefined}<div class="alert alert-success" role="status">
		Queued {form.queued} repository runs.
	</div>{/if}
{#if data.pairs.length === 0}<section class="empty-state">
		<h2>No mirror pairs yet</h2>
		<p>Choose two connections, review a no-side-effect mapping preview, then save the pair.</p>
	</section>
{:else}<section class="pair-grid" aria-label="Mirror pairs">
		{#each data.pairs as pair (pair.id)}<article class="pair-card">
				<div class="pair-endpoint">
					<strong>{pair.sourceProvider}</strong><span>{pair.sourceHost}</span>
				</div>
				<div
					class="pair-direction"
					aria-label={pair.direction === 'one-way' ? 'One-way Git' : 'Two-way Git'}
				>
					{pair.direction === 'one-way' ? '⇒' : '⇄'}<small
						>{pair.direction === 'one-way' ? 'One-way Git' : 'Two-way Git'}</small
					>
				</div>
				<div class="pair-endpoint">
					<strong>{pair.targetProvider}</strong><span>{pair.targetHost}</span>
				</div>
				<div class="pair-meta">
					<h2>{pair.name}</h2>
					<span>{pair.routeCount} routes · {pair.problemCount} need attention</span><span
						class="badge badge-outline">{pair.state}</span
					>
				</div>
				<div class="pair-actions">
					<a class="btn btn-ghost btn-sm" href={resolve(`/pairs/${pair.id}`)}>View</a>
					<form method="POST" action="?/run">
						<input type="hidden" name="pairId" value={pair.id} /><button
							class="btn btn-primary btn-sm"
							disabled={pair.state === 'paused'}>Run</button
						>
					</form>
					<form method="POST" action={pair.state === 'enabled' ? '?/pause' : '?/enable'}>
						<input type="hidden" name="pairId" value={pair.id} /><button
							class="btn btn-outline btn-sm">{pair.state === 'enabled' ? 'Pause' : 'Enable'}</button
						>
					</form>
				</div>
			</article>{/each}
	</section>{/if}
