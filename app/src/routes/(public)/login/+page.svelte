<script lang="ts">
	let { form } = $props();
</script>

<section class="auth-card" aria-labelledby="login-title">
	<div class="eyebrow">Local account</div>
	<h1 id="login-title">Welcome back</h1>
	<p class="lede">Sign in to manage repository flows.</p>
	{#if form?.error}
		<div class="alert alert-error" role="alert" tabindex="-1">{form.error}</div>
	{/if}
	<form method="POST" class="form-stack">
		<label class="form-field">
			<span>Email address</span>
			<input
				class="input-bordered input w-full"
				type="email"
				name="email"
				autocomplete="email"
				required
				value={form?.email ?? ''}
			/>
		</label>
		<label class="form-field">
			<span>Password</span>
			<input
				class="input-bordered input w-full"
				type="password"
				name="password"
				autocomplete="current-password"
				required
			/>
		</label>
		<button class="btn btn-block btn-primary" type="submit">Sign in</button>
	</form>
</section>
