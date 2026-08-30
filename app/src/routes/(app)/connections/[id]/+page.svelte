<script lang="ts">
	let { data, form } = $props();
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
			><span>Base URL</span><input
				class="input-bordered input w-full"
				type="url"
				name="baseUrl"
				required
				value={data.connection.baseUrl}
			/></label
		>
		<label class="form-field"
			><span>Replacement token</span><input
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
		</div>
	</form>
</section>
