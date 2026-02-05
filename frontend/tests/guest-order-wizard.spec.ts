import { test, expect } from '@playwright/test'

test.describe('Гостевой мастер заявки', () => {
  test('Успешный путь: оверлей → мастер → успех', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem('authToken'); localStorage.removeItem('currentUser'); } catch {}
    })
    await page.goto('http://localhost:5175/product/1')

    const addBtn = page.getByRole('button', { name: /Добавить в корзину/i })
    await addBtn.click()

    const cta = page.getByTestId('cta-order-now')
    await expect(cta).toBeVisible()
    await cta.click()

    await expect(page).toHaveURL(/guest-order/)

    await page.getByLabel('Как к вам обращаться\?').fill('Иван Иванов')
    await page.getByRole('button', { name: 'Telegram' }).click()
    await page.getByLabel('Номер телефона').fill('+7 999 111-22-33')

    const next = page.getByRole('button', { name: /Далее/ })
    await next.click()

    // Expect redirect to home
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 })
  })
})