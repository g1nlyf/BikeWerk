import { test, expect } from '@playwright/test'

test.describe('Планета: мобильная позиция и обрезка', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('подтягиваем планету ближе к заголовку и не сжимаем', async ({ page }) => {
    await page.goto('http://localhost:5175/about')
    await page.waitForLoadState('networkidle')

    const card = page.getByTestId('globe-card')
    const wrapper = page.getByTestId('globe-wrapper')
    await expect(card).toBeVisible()
    await expect(wrapper).toBeVisible()

    // Заголовок‑шильдик
    const badge = page.locator('text=Карта доставок за 2024 год').first()
    const badgeBox = await badge.boundingBox()
    const cardBox = await card.boundingBox()
    expect(badgeBox).toBeTruthy(); expect(cardBox).toBeTruthy()

    // Проверяем transform: translateY ≈ 15% высоты контейнера (раньше было 50%)
    const ty = await wrapper.evaluate(el => {
      const m = getComputedStyle(el).transform // matrix(a,b,c,d,tx,ty)
      if (!m || m === 'none') return 0
      const parts = m.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(s => parseFloat(s.trim())) || []
      return parts.length === 6 ? parts[5] : 0
    })
    const h = cardBox!.height
    const ratio = ty / h
    expect(ratio).toBeLessThan(0.3) // раньше было 0.5; теперь ~0.15

    // Обрезка существует: overflow:hidden на карточке
    const overflowHidden = await card.evaluate(el => getComputedStyle(el).overflow === 'hidden' || getComputedStyle(el).overflowY === 'hidden')
    expect(overflowHidden).toBeTruthy()

    // Планета не сжимается: масштаб = 1 на мобильном
    const matrix = await wrapper.evaluate(el => getComputedStyle(el).transform)
    if (matrix && matrix !== 'none') {
      const parts = matrix.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(s => parseFloat(s.trim())) || []
      if (parts.length === 6) {
        const a = parts[0], d = parts[3]
        expect(Math.round(a * 1000) / 1000).toBe(1)
        expect(Math.round(d * 1000) / 1000).toBe(1)
      }
    }
  })
})