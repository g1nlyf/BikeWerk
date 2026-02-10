import { test, expect } from '@playwright/test';

test('Buyout conditions page opens from product card', async ({ page, request }) => {
  const resp = await request.get('http://localhost:8082/api/bikes?limit=1');
  const data = await resp.json();
  const id = String(data?.bikes?.[0]?.id || data?.bikes?.[0]?.bike_id || 1);

  await page.goto(`http://localhost:5175/product/${id}`);
  await page.waitForLoadState('networkidle');

  const link = page.getByRole('link', { name: /Показать условия выкупа/i });
  await expect(link).toBeVisible();
  await link.click();

  await page.waitForURL(/\/booking-checkout\//);
  await expect(page.getByRole('heading', { name: /Показать условия выкупа/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Забронировать/i })).toBeVisible();
});
