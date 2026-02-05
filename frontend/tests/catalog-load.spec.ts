import { test, expect } from '@playwright/test';

test('Catalog loads without import errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('http://localhost:5175/catalog');
  await expect(page).toHaveURL(/\/catalog/);
  const hasBad = errors.some((e) => /Failed to resolve import|vite:import-analysis|ERR_ABORTED/i.test(e));
  expect(hasBad).toBeFalsy();
});