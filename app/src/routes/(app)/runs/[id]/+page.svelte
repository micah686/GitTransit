<script lang="ts">
	let { data } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">Run detail</div>
		<h1>{data.run.kind} run</h1>
		<p class="lede">Trigger: {data.run.trigger}</p>
	</div>
	<span class="badge">{data.run.state}</span>
</div>
<ol class="timeline timeline-vertical">
	{#each data.steps as step (step.id)}<li>
			<div class="timeline-start">Attempt {step.attempt}/{step.maxAttempts}</div>
			<div class="timeline-middle">●</div>
			<div class="timeline-end timeline-box">
				<strong>{step.name}</strong><span class="badge badge-outline">{step.state}</span
				>{#if step.errorCode}<p>{step.errorCode}</p>{/if}
			</div>
			<hr />
		</li>{/each}
</ol>
