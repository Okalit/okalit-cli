import { expect, test } from '@playwright/test';

test('loads the application and its initial page', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('main-app')).toBeVisible();
  await expect(page.locator('example-home')).toBeVisible();
  await expect(page.locator('example-home').getByRole('heading').first()).toBeVisible();
  expect(errors).toEqual([]);
});
