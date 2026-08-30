<script lang="ts">
	import { resolve } from '$app/paths';
	let { form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">New service</div>
		<h1>Add connection</h1>
	</div>
</div>
<section class="form-panel">
	{#if form?.error}<div class="alert alert-error" role="alert">{form.error}</div>{/if}
	<form method="POST" class="form-stack">
		<label class="form-field"
			><span>Name</span><input
				class="input-bordered input w-full"
				name="name"
				required
				maxlength="100"
				value={form?.values?.name ?? ''}
			/></label
		>
		<label class="form-field"
			><span>Provider adapter</span><select
				class="select-bordered select w-full"
				name="providerId"
				required
				><option value="fake" selected={(form?.values?.providerId ?? 'fake') === 'fake'}
					>Fake forge (Phase 2)</option
				><option value="generic-git" selected={form?.values?.providerId === 'generic-git'}
					>Generic Git</option
				></select
			></label
		>
		<label class="form-field"
			><span>Base URL</span><input
				class="input-bordered input w-full"
				type="url"
				name="baseUrl"
				required
				placeholder="https://git.example.test"
				value={form?.values?.baseUrl ?? ''}
			/></label
		>
		<label class="form-field"
			><span>Token (optional)</span><input
				class="input-bordered input w-full"
				type="password"
				name="credential"
				autocomplete="new-password"
				minlength="8"
			/><small>Encrypted at rest and never shown again.</small></label
		>
		<div class="form-actions">
			<a class="btn btn-ghost" href={resolve('/connections')}>Cancel</a><button
				class="btn btn-primary"
				type="submit">Test and create</button
			>
		</div>
	</form>
</section>
