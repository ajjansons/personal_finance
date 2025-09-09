import { test, expect } from '@playwright/test';

test('smoke: app loads and navigate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Personal Finance Tracker')).toBeVisible();
  await page.getByRole('link', { name: 'Holdings' }).click();
  await expect(page.getByRole('heading', { name: 'Holdings' })).toBeVisible();
});
