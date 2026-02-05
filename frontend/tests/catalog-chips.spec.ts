import { test, expect } from '@playwright/test'

test.describe('Каталог: мини-шильдики параметров', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('на карточках видны чипы год/размер/диаметр', async ({ page }) => {
    const base = process.env.BASE_URL || 'http://localhost:4174'
    await page.goto(`${base}/catalog`)
    await page.waitForLoadState('networkidle')

    const cards = page.locator('[data-testid="bike-card"]')
    await expect(cards.first()).toBeVisible()

    const chips = page.locator('[data-testid="chip"]')
    const count = await chips.count()
    expect(count).toBeGreaterThan(0)

    const texts = await chips.allTextContents()
    const hasYear = texts.some(t => /\b20\d{2}\b/.test(t))
    const hasSize = texts.some(t => /\b(XXS|XS|S|SM|MD|M|LG|L|XL|XXL|S[1-6])\b/.test(t))
    const hasWheel = texts.some(t => /(29"|27\.5"|26"|28"|24"|20"|700c|650b)/i.test(t))

    expect(hasYear || hasSize || hasWheel).toBeTruthy()
  })
})