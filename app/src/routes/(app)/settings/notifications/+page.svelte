<script lang="ts">
	let { data, form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Settings</div>
		<h1>Notifications</h1>
		<p class="lede">
			Delivery is durable and independent from mirror success. Tokens and signing secrets are
			encrypted and never displayed again.
		</p>
	</div>
</div>
{#if form?.error}<div class="alert alert-error" role="alert">{form.error}</div>{/if}
{#if form?.created}<div class="alert alert-success">Notification endpoint created.</div>{/if}
<section class="form-panel" aria-labelledby="new-notification">
	<h2 id="new-notification">Add endpoint</h2>
	<form method="POST" action="?/create" class="form-stack">
		<div class="route-grid">
			<label class="form-field"
				><span>Name</span><input class="input-bordered input" name="name" required /></label
			>
			<label class="form-field"
				><span>Adapter</span><select class="select-bordered select" name="kind"
					><option value="ntfy">ntfy</option><option value="apprise">Apprise API</option><option
						value="gotify">Gotify</option
					><option value="webhook">Signed webhook</option></select
				></label
			>
			<label class="form-field"
				><span>Delivery URL</span><input
					class="input-bordered input"
					type="url"
					name="url"
					placeholder="https://notifications.example/topic"
					required
				/></label
			>
			<label class="form-field"
				><span>Token (ntfy, Apprise, Gotify)</span><input
					class="input-bordered input"
					type="password"
					name="token"
					autocomplete="new-password"
				/></label
			>
			<label class="form-field"
				><span>Signing secret (webhook)</span><input
					class="input-bordered input"
					type="password"
					name="secret"
					minlength="16"
					autocomplete="new-password"
				/></label
			>
			<label class="form-field checkbox-field"
				><input class="checkbox checkbox-warning" type="checkbox" name="allowInsecureHttp" /><span
					>Explicitly allow a private-network or insecure HTTP endpoint</span
				></label
			>
		</div>
		<fieldset class="form-stack">
			<legend>Events</legend>
			<label class="checkbox-field"
				><input
					class="checkbox checkbox-primary"
					type="checkbox"
					name="event"
					value="run.failed"
					checked
				/> Run failed</label
			>
			<label class="checkbox-field"
				><input
					class="checkbox checkbox-primary"
					type="checkbox"
					name="event"
					value="run.partial"
					checked
				/> Partial write</label
			>
			<label class="checkbox-field"
				><input
					class="checkbox checkbox-primary"
					type="checkbox"
					name="event"
					value="run.conflicted"
					checked
				/> Conflict</label
			>
			<label class="checkbox-field"
				><input
					class="checkbox checkbox-primary"
					type="checkbox"
					name="event"
					value="run.awaiting-approval"
					checked
				/> Approval required</label
			>
			<label class="checkbox-field"
				><input
					class="checkbox checkbox-primary"
					type="checkbox"
					name="event"
					value="run.succeeded"
				/> Run succeeded</label
			>
		</fieldset>
		<button class="btn btn-primary" type="submit">Add notification endpoint</button>
	</form>
</section>
<section class="route-list" aria-labelledby="configured-notifications">
	<h2 id="configured-notifications">Configured endpoints</h2>
	{#each data.endpoints as endpoint (endpoint.id)}
		<article>
			<div>
				<strong>{endpoint.name}</strong><small
					>{endpoint.kind} · {endpoint.url} · {endpoint.queued} queued · {endpoint.failed} failed</small
				><small>{endpoint.eventFilters.join(', ')}</small>
			</div>
			<span class="badge">{endpoint.enabled ? 'enabled' : 'disabled'}</span>
			<form method="POST" action="?/test">
				<input type="hidden" name="id" value={endpoint.id} /><button class="btn btn-ghost btn-sm"
					>Test</button
				>
			</form>
			<form method="POST" action="?/toggle">
				<input type="hidden" name="id" value={endpoint.id} /><input
					type="hidden"
					name="enabled"
					value={endpoint.enabled ? 'false' : 'true'}
				/><button class="btn btn-ghost btn-sm">{endpoint.enabled ? 'Disable' : 'Enable'}</button>
			</form>
			<form method="POST" action="?/delete">
				<input type="hidden" name="id" value={endpoint.id} /><button class="btn btn-error btn-sm"
					>Delete</button
				>
			</form>
		</article>
	{:else}<p>No notification endpoints configured.</p>{/each}
</section>
