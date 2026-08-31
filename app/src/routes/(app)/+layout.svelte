<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { connectEventStream } from '$lib/client/event-stream';
	let { children, data } = $props();
	let menuOpen = $state(false);
	let theme = $state<'light' | 'dark'>('light');
	let timeFormat = $state<'12' | '24'>('12');

	function applyTheme(value: 'light' | 'dark'): void {
		theme = value;
		document.documentElement.dataset.theme = value;
		localStorage.setItem('gittransit-theme', value);
	}

	onMount(() => {
		const savedTheme = localStorage.getItem('gittransit-theme');
		if (savedTheme === 'light' || savedTheme === 'dark') {
			applyTheme(savedTheme);
		}
		const savedTime = localStorage.getItem('gittransit-time-format');
		if (savedTime === '12' || savedTime === '24') timeFormat = savedTime;
		return connectEventStream(() => {});
	});
</script>

<div class="app-shell drawer lg:drawer-open">
	<input id="app-drawer" type="checkbox" class="drawer-toggle" bind:checked={menuOpen} />
	<div class="drawer-content">
		<header class="mobile-header">
			<label class="btn btn-square btn-ghost btn-sm" for="app-drawer" aria-label="Open navigation">
				☰
			</label>
			<a class="brand" href={resolve('/')}><span class="brand-mark">⇄</span> GitTransit</a>
			<span class="status-dot" title="Web service available"></span>
		</header>
		<main id="main-content" class="app-main">{@render children()}</main>
	</div>
	<div class="drawer-side">
		<label class="drawer-overlay" for="app-drawer" aria-label="Close navigation"></label>
		<aside class="sidebar bg-base-200 text-base-content" aria-label="Primary navigation">
			<div class="sidebar-top">
				<a class="brand" href={resolve('/')}><span class="brand-mark">⇄</span> GitTransit</a>
				<button
					class="close-menu btn btn-square btn-ghost btn-sm"
					type="button"
					aria-label="Close navigation"
					onclick={() => (menuOpen = false)}>×</button
				>
			</div>
			<nav class="menu w-full menu-sm">
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
				<a href={resolve('/approvals')} onclick={() => (menuOpen = false)}
					><span aria-hidden="true">✓</span>Approvals</a
				>
				<a href={resolve('/settings/notifications')} onclick={() => (menuOpen = false)}
					><span aria-hidden="true">◌</span>Notifications</a
				>
				{#if data.user.role === 'admin'}<a
						href={resolve('/settings/maintenance')}
						onclick={() => (menuOpen = false)}><span aria-hidden="true">⚙</span>Maintenance</a
					>{/if}
			</nav>
			<div class="sidebar-footer">
				<div class="preference-grid">
					<label
						>Theme
						<select class="select select-sm" bind:value={theme} onchange={() => applyTheme(theme)}>
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
	</div>
</div>
