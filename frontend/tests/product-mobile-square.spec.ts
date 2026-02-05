import { test, expect } from '@playwright/test'

const mobiles = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
]

for (const vp of mobiles) {
  test.describe(`Мобильная галерея не выше квадрата ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp })

    test('product/80: высота <= ширины', async ({ page }) => {
      await page.goto('http://localhost:5175/product/80')
      await page.waitForLoadState('networkidle')

      const card = page.getByTestId('product-gallery-card')
      await expect(card).toBeVisible()

      const box = await card.boundingBox()
      expect(box).toBeTruthy()
      const w = Math.round(box!.width)
      const h = Math.round(box!.height)
      expect(h).toBeLessThanOrEqual(w)
    })
  })
}