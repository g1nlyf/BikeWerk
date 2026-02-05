import { test, expect } from '@playwright/test'

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
]

for (const vp of viewports) {
  test.describe(`Статичность галереи при скролле ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp })

    test('product/80: блок галереи не двигается при скролле', async ({ page }) => {
      await page.goto('http://localhost:5175/product/80')
      await page.waitForLoadState('networkidle')

      const gallery = page.getByTestId('product-gallery')
      await expect(gallery).toBeVisible()

      const position = await gallery.evaluate(el => getComputedStyle(el).position)
      expect(position === 'fixed' || position === 'sticky').toBeFalsy()

      const topBefore = await gallery.boundingBox().then(b => b?.y ?? 0)

      await page.evaluate(() => window.scrollTo({ top: 1000, behavior: 'instant' as ScrollBehavior }))
      await page.waitForTimeout(200)

      const topAfter = await gallery.boundingBox().then(b => b?.y ?? 0)

      expect(Math.round(topBefore)).not.toBe(Math.round(topAfter))
    })
  })
}