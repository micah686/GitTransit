<script lang="ts">
	let { data, form } = $props();
	const selected = (name: 'connectionAId' | 'connectionBId', fallback = '') =>
		form?.values?.[name] ?? fallback;
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Flows</div>
		<h1>Mirror pairs</h1>
		<p class="lede">Preview and map pre-existing generic Git repositories.</p>
	</div>
</div>
{#if data.connections.length < 2}
	<section class="empty-state">
		<h2>Two generic Git connections are required</h2>
		<p>Add two independently configured connections before mapping endpoints.</p>
	</section>
{:else}
	<section class="form-panel">
		<div class="alert alert-info" role="note">
			Generic Git cannot create repositories. The target URL must already exist and be writable;
			preview never modifies either remote.
		</div>
		{#if form?.error}<div class="alert alert-error" role="alert">{form.error}</div>{/if}
		<form method="POST" class="form-stack">
			<label class="form-field"
				><span>Pair name</span><input
					class="input-bordered input w-full"
					name="name"
					required
					maxlength="100"
					value={form?.values?.name ?? ''}
				/></label
			>
			<div class="route-grid">
				<label class="form-field"
					><span>Side A · source connection</span><select
						class="select-bordered select w-full"
						name="connectionAId"
						required
					>
						<option value="">Choose a connection</option>
						{#each data.connections as connection (connection.id)}<option
								value={connection.id}
								selected={selected('connectionAId') === connection.id}>{connection.name}</option
							>{/each}
					</select></label
				>
				<label class="form-field"
					><span>Side B · target connection</span><select
						class="select-bordered select w-full"
						name="connectionBId"
						required
					>
						<option value="">Choose a connection</option>
						{#each data.connections as connection (connection.id)}<option
								value={connection.id}
								selected={selected('connectionBId') === connection.id}>{connection.name}</option
							>{/each}
					</select></label
				>
				<label class="form-field"
					><span>Source repository URL</span><input
						class="input-bordered input w-full"
						name="sourceUrl"
						required
						placeholder="https://git.example/source/repo.git"
						value={form?.values?.sourceUrl ?? ''}
					/></label
				>
				<label class="form-field"
					><span>Pre-created target URL</span><input
						class="input-bordered input w-full"
						name="targetUrl"
						required
						placeholder="ssh://git@target.example/team/repo.git"
						value={form?.values?.targetUrl ?? ''}
					/></label
				>
			</div>
			<div class="route-grid">
				<label class="form-field"
					><span>Target-only refs</span><select
						class="select-bordered select w-full"
						name="targetOnly"
					>
						<option
							value="preserve"
							selected={(form?.values?.targetOnly ?? 'preserve') === 'preserve'}>Preserve</option
						>
						<option value="error" selected={form?.values?.targetOnly === 'error'}
							>Report conflict</option
						>
						<option
							value="delete-with-approval"
							selected={form?.values?.targetOnly === 'delete-with-approval'}
							>Delete under safety policy</option
						>
					</select></label
				>
				<label class="form-field"
					><span>Rewrite safety</span><select class="select-bordered select w-full" name="safety">
						<option
							value="fast-forward-only"
							selected={(form?.values?.safety ?? 'fast-forward-only') === 'fast-forward-only'}
							>Fast-forward only</option
						>
						<option value="backup-and-apply" selected={form?.values?.safety === 'backup-and-apply'}
							>Backup and apply</option
						>
					</select></label
				>
				<label class="form-field"
					><span>Git LFS</span><select class="select-bordered select w-full" name="lfs">
						<option value="off" selected={(form?.values?.lfs ?? 'off') === 'off'}>Off</option>
						<option value="auto" selected={form?.values?.lfs === 'auto'}>Auto when installed</option
						>
						<option value="on" selected={form?.values?.lfs === 'on'}>Required</option>
					</select></label
				>
				<label class="form-field checkbox-field"
					><input
						class="checkbox"
						type="checkbox"
						name="wiki"
						checked={form?.values?.wiki ?? false}
					/><span>Create a separate linked wiki route later</span></label
				>
			</div>
			<div class="form-actions">
				<button class="btn btn-outline" type="submit" formaction="?/preview">Preview</button><button
					class="btn btn-primary"
					type="submit"
					formaction="?/save">Save ready route</button
				>
			</div>
		</form>
	</section>
{/if}

{#if form?.preview}
	<section class="preview-panel" aria-live="polite">
		<h2>Ref plan</h2>
		<p>{form.preview.sourceRefs} source refs · {form.preview.targetRefs} target refs</p>
		<div class="action-summary">
			{#each ['create', 'fast-forward', 'force-update', 'delete', 'noop', 'conflict'] as kind (kind)}
				<span class="badge badge-outline"
					>{kind}: {form.preview.actions.filter((action) => action.kind === kind).length}</span
				>
			{/each}
		</div>
		{#each form.preview.warnings as warning (warning)}<div class="alert alert-warning">
				{warning}
			</div>{/each}
	</section>
{/if}

{#if data.routes.length > 0}
	<section class="route-list">
		<h2>Saved manual routes</h2>
		{#each data.routes as route (route.routeId)}<article>
				<strong>{route.pairName}</strong><span>{route.sourcePath} ⇒ {route.targetPath}</span><span
					class="badge">{route.status}</span
				>
			</article>{/each}
	</section>
{/if}
