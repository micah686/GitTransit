<script lang="ts">
	let { data, form } = $props();
	const short = (value: string | null) => (value ? value.slice(0, 12) : 'missing');
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Conflict resolution</div>
		<h1>{data.conflict.refName}</h1>
		<p class="lede">{data.conflict.sourcePath} ⇄ {data.conflict.targetPath}</p>
	</div>
	<span class="badge badge-error">{data.conflict.kind}</span>
</div>
{#if form?.error}<div class="alert alert-error">{form.error}</div>{/if}{#if form?.runId}<div
		class="alert alert-success"
	>
		Resolution run queued. Both remotes will be observed again before any write.
	</div>{/if}
<section class="detail-grid">
	<article>
		<h2>Side A · {data.conflict.sourceProvider}</h2>
		<dl>
			<dt>Baseline</dt>
			<dd><code>{short(data.conflict.baselineA)}</code></dd>
			<dt>Observed</dt>
			<dd><code>{short(data.conflict.currentA)}</code></dd>
		</dl>
	</article>
	<article>
		<h2>Side B · {data.conflict.targetProvider}</h2>
		<dl>
			<dt>Baseline</dt>
			<dd><code>{short(data.conflict.baselineB)}</code></dd>
			<dt>Observed</dt>
			<dd><code>{short(data.conflict.currentB)}</code></dd>
		</dl>
	</article>
</section>
<div class="alert alert-warning">
	Choosing a side can overwrite or delete history. The route safety policy and required backups
	still apply.
</div>
<form method="POST" action="?/resolve" class="form-stack">
	<label class="form-field"
		><span>Resolution outcome</span><select class="select-bordered select" name="outcome" required
			><option value="A">Use {data.conflict.sourceProvider} version on both sides</option><option
				value="B">Use {data.conflict.targetProvider} version on both sides</option
			>{#if data.conflict.refName.startsWith('refs/heads/')}<option value="commit"
					>Use a specified reachable commit</option
				><option value="keep-both">Keep both branch tips under separate names</option>{/if}
			><option value="external">I resolved both remotes manually; verify equality</option></select
		></label
	>{#if data.conflict.refName.startsWith('refs/heads/')}
		<label class="form-field"
			><span>Specified commit (for that outcome)</span><input
				class="input-bordered input font-mono"
				name="oid"
				placeholder="Full 40- or 64-character commit ID"
			/></label
		>
		<div class="detail-grid">
			<label class="form-field"
				><span>Canonical side when keeping both</span><select
					class="select-bordered select"
					name="keepWinner"
					><option value="A">Side A</option><option value="B">Side B</option></select
				></label
			><label class="form-field"
				><span>Branch name for the other tip</span><input
					class="input-bordered input"
					name="newBranch"
					placeholder="preserved/conflict-tip"
				/></label
			>
		</div>{/if}
	><button class="btn btn-warning">Queue fresh resolution run</button>
</form>
