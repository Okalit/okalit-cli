import { expect, test } from '@playwright/test';

test('renders the catalog and its example button', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#catalog')).toBeVisible();
  const button = page.locator('example-button').getByRole('button', { name: 'Click me' });
  await expect(button).toBeVisible();
  await button.click();
  expect(errors).toEqual([]);
});
