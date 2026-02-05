import { test, expect } from '@playwright/test'

test.describe('Акцент цены в «Лучшие предложения»', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('цены подсвечены красным', async ({ page }) => {
    await page.goto('http://localhost:5175/test/2')
    await page.waitForLoadState('networkidle')
    const section = page.locator('section').filter({ has: page.getByTestId('mini-heading').filter({ hasText: 'Лучшие предложения' }) }).first()
    const price = section.locator('.hidden.md\\:block span:has-text("₽")').first()
    await expect(price).toBeVisible()
    const hasClass = await price.evaluate(el => el.classList.contains('text-red-600'))
    expect(hasClass).toBeTruthy()
  })
})