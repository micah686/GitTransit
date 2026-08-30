import { expect, test } from '@playwright/test';
import Database from 'better-sqlite3';
import { join } from 'node:path';

test('first admin setup closes and the dashboard is responsive', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup$/);
	await page.getByLabel('Email address').fill('admin@example.test');
	await page.locator('input[name="password"]').fill('correct horse battery staple');
	await page.getByLabel('Confirm password').fill('correct horse battery staple');
	await page.getByRole('button', { name: 'Create administrator' }).click();
	await expect(page.getByRole('heading', { name: 'Good to see you' })).toBeVisible();
	await page.getByRole('link', { name: 'Connections' }).click();
	await page.getByRole('link', { name: 'Add connection' }).click();
	await page.getByLabel('Name').fill('Test Forge');
	await page.getByLabel('Base URL').fill('https://forge.example.test');
	await page.locator('input[name="credential"]').fill('browser-secret-token');
	await page.getByRole('button', { name: 'Test and create' }).click();
	await expect(page.getByRole('heading', { name: 'Test Forge' })).toBeVisible();
	await expect(page.getByText('••••oken')).toBeVisible();
	await expect(page.getByText('browser-secret-token')).toHaveCount(0);
	await page.getByRole('link', { name: 'View and edit' }).click();
	await expect(page.locator('input[name="credential"]')).toHaveValue('');
	await page.getByRole('button', { name: 'Test connection' }).click();
	await expect(page.getByText('Connection test passed.')).toBeVisible();

	const secondTab = await page.context().newPage();
	await secondTab.goto('/');
	const listen = (target: typeof page) =>
		target.evaluate(() => {
			const state = window as unknown as {
				phaseTwoEvents: string[];
				phaseTwoSource: EventSource;
				phaseTwoConnected: boolean;
			};
			state.phaseTwoEvents = [];
			state.phaseTwoConnected = false;
			state.phaseTwoSource = new EventSource('/api/v1/events');
			state.phaseTwoSource.addEventListener('connected', () => (state.phaseTwoConnected = true));
			state.phaseTwoSource.addEventListener('run.queued', (event) =>
				state.phaseTwoEvents.push((event as MessageEvent).data)
			);
		});
	await Promise.all([listen(page), listen(secondTab)]);
	await expect
		.poll(() =>
			page.evaluate(() => (window as unknown as { phaseTwoConnected: boolean }).phaseTwoConnected)
		)
		.toBe(true);
	await expect
		.poll(() =>
			secondTab.evaluate(
				() => (window as unknown as { phaseTwoConnected: boolean }).phaseTwoConnected
			)
		)
		.toBe(true);
	const database = new Database(join(process.env.GITTRANSIT_DATA_DIR!, 'db', 'gittransit.sqlite'));
	const owner = database.prepare('SELECT id FROM users LIMIT 1').get() as { id: string };
	const now = Date.now();
	database
		.prepare(
			`INSERT INTO events(user_id,event_type,resource_ids_json,payload_json,created_at,expires_at)
	 VALUES (?,'run.queued','["run-e2e"]','{"state":"queued"}',?,?)`
		)
		.run(owner.id, now, now + 60_000);
	database.close();
	await expect
		.poll(() =>
			page.evaluate(() => (window as unknown as { phaseTwoEvents: string[] }).phaseTwoEvents.length)
		)
		.toBe(1);
	await expect
		.poll(() =>
			secondTab.evaluate(
				() => (window as unknown as { phaseTwoEvents: string[] }).phaseTwoEvents.length
			)
		)
		.toBe(1);
	await secondTab.close();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await page.goto('/setup');
	await expect(page).toHaveURL(/\/login$/);
	await page.getByLabel('Email address').fill('admin@example.test');
	await page.locator('input[name="password"]').fill('correct horse battery staple');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.setViewportSize({ width: 320, height: 720 });
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Good to see you' })).toBeVisible();
	await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
});
