<script lang="ts">
	let { form } = $props();
</script>

<section class="auth-card" aria-labelledby="setup-title">
	<div class="eyebrow">First-run setup</div>
	<h1 id="setup-title">Create your administrator</h1>
	<p class="lede">This account owns your connections and synchronization policies.</p>
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
				autocomplete="new-password"
				minlength="6"
				required
			/>
			<small>Use at least 6 characters.</small>
		</label>
		<label class="form-field">
			<span>Confirm password</span>
			<input
				class="input-bordered input w-full"
				type="password"
				name="passwordConfirmation"
				autocomplete="new-password"
				minlength="6"
				required
			/>
		</label>
		<button class="btn btn-block btn-primary" type="submit">Create administrator</button>
	</form>
</section>
