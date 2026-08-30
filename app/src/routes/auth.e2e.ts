import { expect, test } from '@playwright/test';

test('first admin setup closes and the dashboard is responsive', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup$/);
	await page.getByLabel('Email address').fill('admin@example.test');
	await page.locator('input[name="password"]').fill('correct horse battery staple');
	await page.getByLabel('Confirm password').fill('correct horse battery staple');
	await page.getByRole('button', { name: 'Create administrator' }).click();
	await expect(page.getByRole('heading', { name: 'Good to see you' })).toBeVisible();
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
