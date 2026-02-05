import { test, expect } from '@playwright/test'

test.describe('Мобильная вёрстка планеты', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Ширина сферы = 70% ширины карточки, края внутри', async ({ page }) => {
    await page.goto('http://localhost:5175/test/2')
    await page.waitForLoadState('networkidle')

    const card = page.getByTestId('globe-card')
    const wrap = page.getByTestId('globe-wrapper')
    await expect(card).toBeVisible()
    await expect(wrap).toBeVisible()

    const cBox = await card.boundingBox()
    const wBox = await wrap.boundingBox()
    expect(cBox).toBeTruthy()
    expect(wBox).toBeTruthy()
    if (!cBox || !wBox) return

    const ratio = wBox.width / cBox.width
    expect(ratio).toBeGreaterThan(0.68)
    expect(ratio).toBeLessThan(0.72)

    const wLeft = wBox.x
    const wRight = wBox.x + wBox.width
    const cLeft = cBox.x
    const cRight = cBox.x + cBox.width
    const wBottom = wBox.y + wBox.height
    const cBottom = cBox.y + cBox.height
    const wTop = wBox.y
    const cTop = cBox.y

    expect(wLeft).toBeGreaterThanOrEqual(cLeft)
    expect(wRight).toBeLessThanOrEqual(cRight)

    expect(Math.abs(wBottom - cBottom)).toBeLessThanOrEqual(2)

    expect(wTop - cTop).toBeGreaterThanOrEqual(10)
  })
})
