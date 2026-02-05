import { test, expect } from '@playwright/test';

test('Order overlay appears on Add to Cart for unauth user', async ({ page, request }) => {
  const resp = await request.get('http://localhost:8081/api/bikes?limit=1');
  const data = await resp.json();
  const id = String(data?.bikes?.[0]?.id || data?.bikes?.[0]?.bike_id || 1);
  await page.goto(`http://localhost:5175/product/${id}`);
  await page.waitForLoadState('networkidle');
  const addBtn = page.locator('button:text-matches(".*корзин.*|.*добавить.*|.*заказ.*", "i")').first();
  await addBtn.waitFor({ state: 'visible' });
  await addBtn.click();
  await expect(page.getByRole('heading', { name: /Заказываем\?/ })).toBeVisible();
  await expect(page.getByTestId('cta-order-now')).toBeVisible();
  await expect(page.getByText('Как насчёт перейти к заявке на выкуп напрямую?', { exact: false })).toBeVisible();
});