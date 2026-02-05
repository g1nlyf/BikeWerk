import { test, expect } from '@playwright/test'

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
]

for (const vp of viewports) {
  test.describe(`Каталог: адаптивность ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp })

    test('нет горизонтального скролла, фильтры доступны', async ({ page }) => {
      await page.goto('http://localhost:5175/catalog')
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(6)
      await expect(page.getByTestId('listing-type-block')).toBeVisible()
      const cards = page.getByTestId('bike-card')
      await expect(cards.first()).toBeVisible()
    })
  })
}