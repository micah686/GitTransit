<script lang="ts">
	let { data, form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">New flow</div>
		<h1>Create mirror pair</h1>
		<p class="lede">
			Preview is read-only. Saving persists policy and route proposals but never changes a remote.
		</p>
	</div>
</div>
{#if form?.error}<div class="alert alert-error" role="alert">{form.error}</div>{/if}
<section class="form-panel">
	<form method="POST" class="form-stack">
		<div class="wizard-step">
			<span>1</span>
			<h2>Endpoints and direction</h2>
		</div>
		<div class="route-grid">
			<label class="form-field"
				><span>Name</span><input class="input-bordered input" name="name" required /></label
			><label class="form-field"
				><span>Side A · source</span><select
					class="select-bordered select"
					name="connectionAId"
					required
					><option value="">Choose</option
					>{#each data.connections as connection (connection.id)}<option value={connection.id}
							>{connection.name} · {connection.providerId}</option
						>{/each}</select
				></label
			><label class="form-field"
				><span>Side B · target</span><select
					class="select-bordered select"
					name="connectionBId"
					required
					><option value="">Choose</option
					>{#each data.connections as connection (connection.id)}<option value={connection.id}
							>{connection.name} · {connection.providerId}</option
						>{/each}</select
				></label
			><label class="form-field"
				><span>Direction</span><select class="select-bordered select" name="direction"
					><option value="one-way">⇒ One-way Git</option><option value="two-way"
						>⇄ Two-way Git reconciliation</option
					></select
				></label
			>
		</div>
		<div class="wizard-step">
			<span>2</span>
			<h2>Selection and mapping</h2>
		</div>
		<div class="route-grid">
			<label class="form-field"
				><span>Repositories</span><select class="select-bordered select" name="selectionMode"
					><option value="all">All eligible</option><option value="patterns"
						>Include patterns</option
					></select
				></label
			><label class="form-field"
				><span>Namespace strategy</span><select
					class="select-bordered select"
					name="namespaceStrategy"
					><option value="preserve">Preserve namespaces</option><option value="single-namespace"
						>Single namespace</option
					><option value="flat-user">Target user</option></select
				></label
			><label class="form-field"
				><span>Target namespace (when flattened)</span><input
					class="input-bordered input"
					name="defaultTarget"
				/></label
			><label class="form-field"
				><span>Include globs, one per line</span><textarea
					class="textarea-bordered textarea"
					name="includes"
					placeholder="team/**"></textarea></label
			>
			<label class="form-field"
				><span>Mapping collisions</span><select
					class="select-bordered select"
					name="collisionStrategy"
					><option value="block">Block and review</option><option value="suffix"
						>Append a numeric suffix</option
					></select
				></label
			>
			<label class="form-field"
				><span>First two-way baseline</span><select
					class="select-bordered select"
					name="initialBaselineMode"
					><option value="require-equality">Require equal refs</option><option value="seed-a-to-b"
						>Seed Side A to Side B</option
					><option value="seed-b-to-a">Seed Side B to Side A</option><option value="manual"
						>Resolve mismatches manually</option
					></select
				></label
			>
		</div>
		<div class="wizard-step">
			<span>3</span>
			<h2>Forge metadata</h2>
		</div>
		<p class="lede">
			Metadata always flows from Side A to Side B. Required components fail the run; optional
			components report warnings.
		</p>
		<div class="route-grid">
			<label class="form-field"
				><span>Topics</span><select class="select-bordered select" name="metadataTopics"
					><option value="off">Off</option><option value="on">On</option><option value="required"
						>Required</option
					></select
				></label
			>
			<label class="form-field"
				><span>Labels</span><select class="select-bordered select" name="metadataLabels"
					><option value="off">Off</option><option value="on">On</option><option value="required"
						>Required</option
					></select
				></label
			>
			<label class="form-field"
				><span>Milestones</span><select class="select-bordered select" name="metadataMilestones"
					><option value="off">Off</option><option value="on">On</option><option value="required"
						>Required</option
					></select
				></label
			>
			<label class="form-field"
				><span>Issues and comments</span><select
					class="select-bordered select"
					name="metadataIssues"
					><option value="off">Off</option><option value="on">On</option><option value="required"
						>Required</option
					></select
				></label
			>
			<label class="form-field"
				><span>Archived change requests</span><select
					class="select-bordered select"
					name="metadataChangeRequests"
					><option value="off">Off</option><option value="on">On</option><option value="required"
						>Required</option
					></select
				></label
			>
			<label class="form-field"
				><span>Releases and assets</span><select
					class="select-bordered select"
					name="metadataReleases"
					><option value="off">Off</option><option value="on">On</option><option value="required"
						>Required</option
					></select
				></label
			>
			<label class="form-field"
				><span>Wiki</span><select class="select-bordered select" name="metadataWiki"
					><option value="off">Off</option><option value="on">On</option><option value="required"
						>Required</option
					></select
				></label
			>
			<label class="form-field checkbox-field"
				><input
					type="checkbox"
					class="checkbox checkbox-primary"
					name="metadataAuthority"
					value="A"
				/><span>Side A is metadata authority (required for two-way Git)</span></label
			>
		</div>
		<div class="wizard-step">
			<span>4</span>
			<h2>Content, safety, and schedule</h2>
		</div>
		<div class="route-grid">
			<label class="form-field"
				><span>Git LFS</span><select class="select-bordered select" name="lfs"
					><option value="off">Off</option><option value="auto">Auto</option><option value="on"
						>Required</option
					></select
				></label
			><label class="form-field"
				><span>Target-only refs</span><select class="select-bordered select" name="targetOnly"
					><option value="preserve">Preserve</option><option value="error">Block</option><option
						value="delete-with-approval">Delete with approval</option
					></select
				></label
			><label class="form-field"
				><span>Rewrite safety</span><select class="select-bordered select" name="safety"
					><option value="fast-forward-only">Fast-forward only</option><option
						value="backup-and-apply">Backup and apply</option
					><option value="approve-destructive">Require approval and backup</option><option
						value="never-delete">Never apply destructive changes</option
					></select
				></label
			><label class="form-field checkbox-field"
				><input
					type="checkbox"
					class="checkbox checkbox-primary"
					name="autoProvision"
					checked
				/><span>Provision new selected targets</span></label
			><label class="form-field checkbox-field"
				><input type="checkbox" class="checkbox checkbox-primary" name="scheduleEnabled" /><span
					>Run on schedule</span
				></label
			><label class="form-field"
				><span>Interval</span><input
					class="input-bordered input"
					name="scheduleValue"
					value="6h"
					pattern="[1-9][0-9]*[mhd]"
				/></label
			><label class="form-field"
				><span>Batch size</span><input
					class="input-bordered input"
					type="number"
					name="batchSize"
					value="25"
					min="1"
					max="500"
				/></label
			><label class="form-field"
				><span>Concurrent routes</span><input
					class="input-bordered input"
					type="number"
					name="routeConcurrency"
					value="2"
					min="1"
					max="20"
				/></label
			>
		</div>
		<div class="form-actions">
			<button class="btn btn-outline" formaction="?/preview">Preview mapping</button><button
				class="btn btn-primary"
				formaction="?/save"
				disabled={!form?.preview?.valid}>Save draft</button
			>
		</div>
	</form>
</section>
{#if form?.preview}<section class="preview-panel" aria-live="polite">
		<h2>Dry-run mapping</h2>
		<p>{form.preview.selectedCount} selected · {form.preview.skippedCount} skipped</p>
		{#each form.preview.warnings as warning (warning)}<div class="alert alert-warning">
				{warning}
			</div>{/each}
		<div class="proposal-list">
			{#each form.preview.proposals as proposal (proposal.repositoryId)}<div>
					<span>{proposal.sourcePath}</span><span>⇒</span><strong>{proposal.targetPath}</strong
					><span class="badge">{proposal.action}</span>
				</div>{/each}
		</div>
	</section>{/if}
