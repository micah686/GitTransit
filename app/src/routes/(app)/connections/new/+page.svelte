<script lang="ts">
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	let { form } = $props();
	let providerId = $state(untrack(() => form?.values?.providerId ?? 'gitea'));
	let baseUrl = $state(untrack(() => form?.values?.baseUrl ?? ''));
	let credentialKind = $state(untrack(() => form?.values?.credentialKind ?? 'token'));
	const defaults: Record<string, string> = {
		github: 'https://github.com',
		gitlab: 'https://gitlab.com',
		'bitbucket-cloud': 'https://bitbucket.org'
	};
	function providerChanged(event: Event) {
		providerId = (event.currentTarget as HTMLSelectElement).value as typeof providerId;
		if (!baseUrl || Object.values(defaults).includes(baseUrl)) baseUrl = defaults[providerId] ?? '';
		credentialKind = providerId === 'bitbucket-cloud' ? 'app-password' : 'token';
	}
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
				onchange={providerChanged}
				><option value="gitea" selected={providerId === 'gitea'}>Gitea</option><option
					value="forgejo"
					selected={providerId === 'forgejo'}>Forgejo</option
				><option value="gitlab" selected={providerId === 'gitlab'}>GitLab / self-managed</option
				><option value="github" selected={providerId === 'github'}
					>GitHub / GitHub Enterprise</option
				><option value="bitbucket-cloud" selected={providerId === 'bitbucket-cloud'}
					>Bitbucket Cloud</option
				><option value="generic-git" selected={providerId === 'generic-git'}>Generic Git</option
				><option value="fake" selected={providerId === 'fake'}>Fake forge (Phase 2)</option></select
			></label
		>
		<label class="form-field"
			><span>Base URL</span><input
				class="input-bordered input w-full"
				type="url"
				name="baseUrl"
				required
				placeholder="https://forge.example.test"
				bind:value={baseUrl}
			/></label
		>
		<label class="form-field"
			><span>API URL override (optional)</span><input
				class="input-bordered input w-full"
				type="url"
				name="apiUrl"
				placeholder="Enterprise or reverse-proxy API base"
				value={form?.values?.apiUrl ?? ''}
			/><small>Leave blank for the provider's standard API path.</small></label
		>
		<label class="form-field"
			><span>Credential type</span><select
				class="select-bordered select w-full"
				name="credentialKind"
				bind:value={credentialKind}
				><option value="token">Personal or access token</option><option value="basic"
					>Basic password</option
				><option value="app-password">App password</option></select
			></label
		>
		<label class="form-field"
			><span>Username (basic/app password)</span><input
				class="input-bordered input w-full"
				name="username"
				autocomplete="username"
				value={form?.values?.username ?? ''}
			/><small>Required only for basic or app-password authentication.</small></label
		>
		<label class="form-field"
			><span>Credential</span><input
				class="input-bordered input w-full"
				type="password"
				name="credential"
				autocomplete="new-password"
				minlength="8"
				required={!['fake', 'generic-git'].includes(providerId)}
			/><small>Required for named providers; encrypted at rest and never shown again.</small></label
		>
		<div class="form-actions">
			<a class="btn btn-ghost" href={resolve('/connections')}>Cancel</a><button
				class="btn btn-outline"
				type="submit"
				formaction="?/create">Create</button
			><button class="btn btn-primary" type="submit" formaction="?/testAndCreate"
				>Test and create</button
			>
		</div>
	</form>
</section>
