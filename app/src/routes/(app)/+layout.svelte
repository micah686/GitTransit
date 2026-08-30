<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	let { children, data } = $props();
	let menuOpen = $state(false);
	let theme = $state<'system' | 'light' | 'dark'>('system');
	let timeFormat = $state<'12' | '24'>('12');

	function applyTheme(value: 'system' | 'light' | 'dark'): void {
		theme = value;
		if (value === 'system') document.documentElement.removeAttribute('data-theme');
		else document.documentElement.dataset.theme = value;
		localStorage.setItem('gittransit-theme', value);
	}

	onMount(() => {
		const savedTheme = localStorage.getItem('gittransit-theme');
		if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
			applyTheme(savedTheme);
		}
		const savedTime = localStorage.getItem('gittransit-time-format');
		if (savedTime === '12' || savedTime === '24') timeFormat = savedTime;
	});
</script>

<div class="app-shell">
	<header class="mobile-header">
		<button
			class="icon-button"
			type="button"
			aria-label="Open navigation"
			onclick={() => (menuOpen = true)}
		>
			☰
		</button>
		<a class="brand" href={resolve('/')}><span class="brand-mark">⇄</span> GitTransit</a>
		<span class="status-dot" title="Web service available"></span>
	</header>
	{#if menuOpen}
		<button class="scrim" aria-label="Close navigation" onclick={() => (menuOpen = false)}></button>
	{/if}
	<aside class:open={menuOpen} class="sidebar" aria-label="Primary navigation">
		<div class="sidebar-top">
			<a class="brand" href={resolve('/')}><span class="brand-mark">⇄</span> GitTransit</a>
			<button
				class="icon-button close-menu"
				type="button"
				aria-label="Close navigation"
				onclick={() => (menuOpen = false)}>×</button
			>
		</div>
		<nav>
			<a href={resolve('/')} onclick={() => (menuOpen = false)}
				><span aria-hidden="true">⌂</span>Dashboard</a
			>
			<a href={resolve('/connections')} onclick={() => (menuOpen = false)}
				><span aria-hidden="true">◉</span>Connections</a
			>
			<a href={resolve('/pairs')} onclick={() => (menuOpen = false)}
				><span aria-hidden="true">⇄</span>Mirror pairs</a
			>
			<a href={resolve('/repositories')} onclick={() => (menuOpen = false)}
				><span aria-hidden="true">◇</span>Repositories</a
			>
			<a href={resolve('/runs')} onclick={() => (menuOpen = false)}
				><span aria-hidden="true">↻</span>Activity</a
			>
			<a href={resolve('/conflicts')} onclick={() => (menuOpen = false)}
				><span aria-hidden="true">△</span>Conflicts</a
			>
		</nav>
		<div class="sidebar-footer">
			<div class="preference-grid">
				<label
					>Theme
					<select class="select select-sm" bind:value={theme} onchange={() => applyTheme(theme)}>
						<option value="system">System</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
				</label>
				<label
					>Time
					<select
						class="select select-sm"
						bind:value={timeFormat}
						onchange={() => localStorage.setItem('gittransit-time-format', timeFormat)}
					>
						<option value="12">12-hour</option>
						<option value="24">24-hour</option>
					</select>
				</label>
			</div>
			<div class="user-summary">
				<div class="avatar" aria-hidden="true">{data.user.email.slice(0, 1).toUpperCase()}</div>
				<div><strong>{data.user.email}</strong><span>{data.user.role}</span></div>
			</div>
			<form method="POST" action={resolve('/logout')}>
				<button class="btn btn-block btn-ghost" type="submit">Sign out</button>
			</form>
			<small>GitTransit 0.0.1</small>
		</div>
	</aside>
	<main id="main-content" class="app-main">{@render children()}</main>
</div>
