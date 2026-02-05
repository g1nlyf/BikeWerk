import { test, expect } from '@playwright/test'

test.describe('Кнопка «Подробнее о безопасной оплате»', () => {
  test('расположена под блоком Оплата', async ({ page }) => {
    await page.goto('http://localhost:5175/product/1')
    await page.waitForLoadState('networkidle')
    const paymentTitle = page.getByText('Оплата', { exact: true })
    await expect(paymentTitle).toBeVisible()
    const detailsBtn = page.getByRole('button', { name: /Подробнее о безопасной оплате/i })
    await expect(detailsBtn).toBeVisible()
    const isBelow = await detailsBtn.evaluate((el) => {
      const btnRect = el.getBoundingClientRect()
      const payment = [...document.querySelectorAll('*')].find(n => n.textContent?.trim() === 'Оплата') as HTMLElement | undefined
      if (!payment) return false
      const pr = payment.getBoundingClientRect()
      return btnRect.top > pr.bottom - 4
    })
    expect(isBelow).toBeTruthy()
  })
})