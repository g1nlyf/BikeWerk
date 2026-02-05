import { test, expect } from '@playwright/test'

test('Guest buyback form creates CRM application and shows confirmation', async ({ page, request }) => {
  const resp = await request.get('http://localhost:8081/api/bikes?limit=1')
  const data = await resp.json()
  const id = String(data?.bikes?.[0]?.id || data?.bikes?.[0]?.bike_id || 1)
  await page.goto(`http://localhost:5175/product/${id}`)
  await page.waitForLoadState('networkidle')

  const addBtn = page.locator('button:text-matches(".*корзин.*|.*добавить.*", "i")').first()
  await addBtn.waitFor({ state: 'visible' })
  await addBtn.click()

  const ctaOrder = page.getByTestId('cta-order-now')
  await ctaOrder.waitFor({ state: 'visible' })
  await ctaOrder.click()

  await page.getByPlaceholder('Иван Иванов').fill('Тест Пользователь')
  await page.getByRole('button', { name: 'Далее' }).click()
  // Шаг 2: способ связи уже выбран по умолчанию (Telegram)
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByPlaceholder('@username / номер').fill('@testuser')
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByPlaceholder('Коротко о пожеланиях').fill('Связаться днём')
  await page.getByRole('button', { name: 'Создать заявку' }).click()

  await expect(page.getByText(/APP-\d{6}-\d{3,4}/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Поделиться/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /К отслеживанию/ })).toBeVisible()
})
