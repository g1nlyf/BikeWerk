import { test, expect } from '@playwright/test'

test.describe('CTA на тестовом лендинге /test/2', () => {
  test('кнопка присутствует и расположена ниже блока доставки', async ({ page }) => {
    await page.goto('http://localhost:5175/test/2')
    await page.waitForLoadState('networkidle')
    const delivery = page.getByTestId('best-delivery-section')
    const block = page.getByTestId('work-cta-block')
    const cta = page.getByTestId('work-cta')
    await expect(delivery).toBeVisible()
    await expect(block).toBeVisible()
    await expect(cta).toBeVisible()
    const d = await delivery.boundingBox()
    const b = await block.boundingBox()
    expect(Math.round(b!.y)).toBeGreaterThanOrEqual(Math.round(d!.y + d!.height))
  })
})