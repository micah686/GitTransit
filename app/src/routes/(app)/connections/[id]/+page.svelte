<script lang="ts">
	import { untrack } from 'svelte';
	let { data, form } = $props();
	let credentialKind = $state(untrack(() => data.connection.credentialKind ?? 'token'));
	const optionalFeatures = [
		'repository:create',
		'lfs:fetch',
		'topics:read',
		'issues:read',
		'releases:read'
	];
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">{data.connection.providerId}</div>
		<h1>{data.connection.name}</h1>
		<p class="lede">Saved credentials remain masked.</p>
	</div>
</div>
<section class="form-panel">
	{#if form?.error}<div class="alert alert-error" role="alert">{form.error}</div>{/if}
	{#if form?.success}<div class="alert alert-success" role="status">{form.success}</div>{/if}
	<form method="POST" action="?/update" class="form-stack">
		<input type="hidden" name="version" value={data.connection.version} />
		<label class="form-field"
			><span>Name</span><input
				class="input-bordered input w-full"
				name="name"
				required
				value={data.connection.name}
			/></label
		>
		<label class="form-field"
			><span>API URL override</span><input
				class="input-bordered input w-full"
				type="url"
				name="apiUrl"
				value={data.connection.apiUrl ?? ''}
				placeholder="Provider default"
			/><small>Leave blank to use the provider's standard API path.</small></label
		>
		<label class="form-field"
			><span>Base URL</span><input
				class="input-bordered input w-full"
				type="url"
				name="baseUrl"
				required
				value={data.connection.baseUrl}
			/></label
		>
		<label class="form-field"
			><span>Replacement credential type</span><select
				class="select-bordered select w-full"
				name="credentialKind"
				bind:value={credentialKind}
				><option value="token">Personal or access token</option><option value="basic"
					>Basic password</option
				><option value="app-password">App password</option></select
			></label
		>
		<label class="form-field"
			><span>Username for replacement</span><input
				class="input-bordered input w-full"
				name="username"
				autocomplete="username"
			/><small>Required only when replacing a basic or app-password credential.</small></label
		>
		<label class="form-field"
			><span>Replacement credential</span><input
				class="input-bordered input w-full"
				type="password"
				name="credential"
				autocomplete="new-password"
				minlength="8"
				placeholder={data.connection.credentialHint ?? 'Not configured'}
			/><small>Leave blank to keep the existing credential.</small></label
		>
		<label class="toggle-row"
			><span>Enabled</span><input
				class="toggle toggle-primary"
				type="checkbox"
				name="enabled"
				checked={data.connection.enabled}
			/></label
		>
		<div class="form-actions">
			<button class="btn btn-primary" type="submit">Save changes</button><button
				class="btn btn-outline"
				type="submit"
				formaction="?/test">Test connection</button
			>
			{#if !['fake', 'generic-git'].includes(data.connection.providerId)}
				<button class="btn btn-outline" type="submit" formaction="?/discover"
					>Discover repositories</button
				>
			{/if}
		</div>
	</form>
</section>
<section class="preview-panel">
	<h2>Detected capabilities</h2>
	<div class="action-summary">
		{#each data.connection.capabilities as capability (capability)}
			<span class="badge badge-outline badge-success">{capability}</span>
		{/each}
	</div>
	{#each optionalFeatures.filter((feature) => !data.connection.capabilities.includes(feature)) as feature (feature)}
		<p class="lede">
			<strong>{feature}</strong> is disabled because this adapter or credential did not declare it.
		</p>
	{/each}
</section>
{#if data.repositories.length > 0}
	<section class="route-list" aria-label="Discovered repositories">
		<h2>Discovered repositories</h2>
		{#each data.repositories as repository (repository.id)}
			<article>
				<div><strong>{repository.fullPath}</strong><small>{repository.fetchUrl}</small></div>
				<span class="badge badge-outline">{repository.visibility ?? 'unknown'}</span>
			</article>
		{/each}
	</section>
{/if}
