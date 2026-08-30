<script lang="ts">
	import { resolve } from '$app/paths';
	let { data } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Safety</div>
		<h1>Conflicts</h1>
		<p class="lede">Two-way divergence never chooses a winner by timestamp.</p>
	</div>
</div>
{#if data.conflicts.length === 0}<section class="empty-state">
		<h2>No open conflicts</h2>
		<p>Delete/modify, divergent history, and tag conflicts will appear here.</p>
	</section>{:else}<section class="route-list">
		{#each data.conflicts as conflict (conflict.id)}<article>
				<div>
					<a href={resolve(`/conflicts/${conflict.id}`)}><strong>{conflict.refName}</strong></a
					><small>{conflict.pairName} · {conflict.sourcePath} ⇄ {conflict.targetPath}</small>
				</div>
				<span class="badge badge-error">{conflict.kind}</span><time
					>{new Date(conflict.createdAt).toLocaleString()}</time
				>
			</article>{/each}
	</section>{/if}
