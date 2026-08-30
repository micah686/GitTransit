<script lang="ts">
	let { data, form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Safety</div>
		<h1>Destructive approvals</h1>
		<p class="lede">
			Approval authorizes only the exact observed ref plan shown here. Changed remote OIDs
			invalidate it.
		</p>
	</div>
</div>
{#if form?.error}<div class="alert alert-error">{form.error}</div>{/if}
{#if data.approvals.length === 0}<section class="empty-state">
		<h2>No pending approvals</h2>
		<p>Rewrites and deletions configured for approval will appear here.</p>
	</section>{:else}<section class="approval-grid">
		{#each data.approvals as approval (approval.id)}<article class="approval-card">
				<div>
					<span class="badge badge-warning">{approval.state}</span>
					<h2>{approval.pairName}</h2>
					<p>{approval.sourcePath} ⇒ {approval.targetPath}</p>
					<small
						>Plan {approval.digest.slice(0, 12)} · expires {new Date(
							approval.expiresAt
						).toLocaleString()}</small
					>
				</div>
				<ul>
					{#each approval.actions.filter((action) => action.kind === 'force-update' || action.kind === 'delete') as action (action.ref)}<li
						>
							<code>{action.ref}</code> · {action.kind}
						</li>{/each}
				</ul>
				<div class="form-actions">
					<form method="POST" action="?/reject">
						<input type="hidden" name="approvalId" value={approval.id} /><button
							class="btn btn-outline">Reject</button
						>
					</form>
					<form method="POST" action="?/approve">
						<input type="hidden" name="approvalId" value={approval.id} /><button
							class="btn btn-warning">Approve exact plan</button
						>
					</form>
				</div>
			</article>{/each}
	</section>{/if}
