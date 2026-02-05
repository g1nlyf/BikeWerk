import { test, expect } from '@playwright/test';

test('Hot Deals Block Verification', async ({ page }) => {
  // 1. Go to Home Page
  await page.goto('http://localhost:5175/');
  
  // 2. Wait for the Hot Deals block title
  // I renamed it to "Горячие предложения" in MiniCatalogBikeflip.tsx
  const blockTitle = page.getByText('Горячие предложения', { exact: true });
  await expect(blockTitle).toBeVisible({ timeout: 15000 });

  // 3. Check for the Badge
  // In BikeCard.tsx, I added: if (bike.is_hot) return { text: '🔥 BEST DEAL', ... }
  // So we look for "BEST DEAL" text.
  const badge = page.getByText('BEST DEAL').first();
  await expect(badge).toBeVisible();

  console.log('✅ Hot Deals Block found with correct title');
  console.log('✅ BEST DEAL badge visible on cards');
});
