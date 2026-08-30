<script lang="ts">
	import { resolve } from '$app/paths';
	let { data } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Services</div>
		<h1>Connections</h1>
		<p class="lede">Independent forge and Git instances.</p>
	</div>
	<a class="btn btn-primary" href={resolve('/connections/new')}>Add connection</a>
</div>
{#if data.connections.length === 0}
	<section class="empty-state">
		<div class="welcome-icon" aria-hidden="true">◉</div>
		<h2>No connections yet</h2>
		<p>Add the Phase 2 fake forge or a manual generic Git service.</p>
		<a class="btn btn-outline" href={resolve('/connections/new')}>Add your first connection</a>
	</section>
{:else}
	<div class="connection-grid">
		{#each data.connections as connection (connection.id)}
			<article class="connection-card">
				<div class="connection-card-heading">
					<div>
						<span class="provider-label">{connection.providerId}</span>
						<h2>{connection.name}</h2>
					</div>
					<span class:status-ok={connection.lastTestStatus === 'ok'} class="connection-status"
						>{connection.lastTestStatus ?? 'untested'}</span
					>
				</div>
				<p class="safe-url">{connection.baseUrl}</p>
				<dl>
					<div>
						<dt>Product</dt>
						<dd>{connection.product ?? 'Unknown'}</dd>
					</div>
					<div>
						<dt>Credential</dt>
						<dd>{connection.credentialHint ?? 'Not configured'}</dd>
					</div>
					<div>
						<dt>Capabilities</dt>
						<dd>{connection.capabilities.length}</dd>
					</div>
				</dl>
				<a class="btn btn-ghost" href={resolve(`/connections/${connection.id}`)}>View and edit</a>
			</article>
		{/each}
	</div>
{/if}
