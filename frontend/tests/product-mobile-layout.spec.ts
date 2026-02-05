import { test, expect } from '@playwright/test'

test.describe('Мобильная верстка карточки товара', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('product/80: без горизонтальной прокрутки и корректная ширина', async ({ page }) => {
    await page.goto('http://localhost:5175/product/80')
    await page.waitForLoadState('networkidle')
    const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
    expect(noHScroll).toBeTruthy()
    const addBtn = page.getByRole('button', { name: /Добавить в корзину/i })
    await expect(addBtn).toBeVisible()
    const askBtn = page.getByRole('button', { name: /Задать вопрос/i })
    await expect(askBtn).toBeVisible()
  })

  test('product/76: страница не листается по горизонтали', async ({ page }) => {
    await page.goto('http://localhost:5175/product/76')
    await page.waitForLoadState('networkidle')
    const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
    expect(noHScroll).toBeTruthy()
  })
})