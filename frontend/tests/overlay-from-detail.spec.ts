import { test, expect } from '@playwright/test';

test('Add to cart on product page shows friendly overlay (no redirect)', async ({ page, request }) => {
  const resp = await request.get('http://localhost:8081/api/bikes?limit=1');
  const data = await resp.json();
  const id = String(data?.bikes?.[0]?.id || data?.bikes?.[0]?.bike_id || 1);
  await page.goto(`http://localhost:5175/product/${id}`);
  await page.waitForLoadState('networkidle');
  const buyBtn = page.locator('button:text-matches(".*корзин.*|.*добавить.*|.*заказ.*", "i")').first();
  await buyBtn.waitFor({ state: 'visible' });
  await buyBtn.click();
  await expect(page.getByTestId('cta-order-now')).toBeVisible();
  await expect(page).not.toHaveURL(/\/checkout\?guest=1/);
});