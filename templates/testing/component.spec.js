import { expect, test } from '@playwright/test';

test('renders the component demo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#demo')).toBeVisible();
  await expect(page.locator('__COMPONENT_TAG__')).toBeVisible();
  await expect(page.locator('__COMPONENT_TAG__')).toContainText('Hello World');
  expect(errors).toEqual([]);
});
