import { test, expect } from '@playwright/test'

const base = 'http://localhost:5175/test/2'

test.describe('Категории на лендинге', () => {
  test.describe('Мобильная 390x844', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('заголовок «Категории» и стиль', async ({ page }) => {
      await page.goto(base)
      await page.waitForLoadState('networkidle')
      const title = page.getByTestId('categories-title')
      await expect(title).toHaveText('Категории каталога')
      const styles = await title.evaluate(el => {
        const cs = getComputedStyle(el)
        return { fontSize: parseFloat(cs.fontSize), fontWeight: parseInt(cs.fontWeight, 10) }
      })
      expect(styles.fontSize).toBeGreaterThanOrEqual(24)
      expect(styles.fontWeight).toBeGreaterThanOrEqual(700)
    })

    test('сетка 2x2 без горизонтальной прокрутки', async ({ page }) => {
      await page.goto(base)
      await page.waitForLoadState('networkidle')
      const grid = page.getByTestId('categories-grid-mobile')
      await expect(grid).toBeVisible()
      const cards = grid.locator('[data-testid^="category-card-"]')
      await expect(cards).toHaveCount(4)
      const hasHScroll = await grid.evaluate(el => el.scrollWidth > el.clientWidth)
      expect(hasHScroll).toBeFalsy()
    })

    test('карточка увеличена ~20% (соотношение h/w ≥ 1.55)', async ({ page }) => {
      await page.goto(base)
      await page.waitForLoadState('networkidle')
      const firstCard = page.getByTestId('category-card-mtb')
      const box = await firstCard.locator('.relative').first().boundingBox()
      expect(box).toBeTruthy()
      const ratio = (box!.height) / (box!.width)
      expect(ratio).toBeGreaterThanOrEqual(1.55)
    })
  })

  test.describe('Десктоп 1280x800', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('мобильная сетка скрыта, видна десктопная', async ({ page }) => {
      await page.goto(base)
      await page.waitForLoadState('networkidle')
      const mobileGrid = page.getByTestId('categories-grid-mobile')
      await expect(mobileGrid).toBeHidden()
      const desktopGrid = page.getByTestId('categories-grid-desktop')
      await expect(desktopGrid).toBeVisible()
      const cards = desktopGrid.locator('a.group')
      await expect(cards).toHaveCount(4)
    })

    test('карточка увеличена ~20% (соотношение h/w ≥ 1.55)', async ({ page }) => {
      await page.goto(base)
      await page.waitForLoadState('networkidle')
      const card = page.getByTestId('categories-grid-desktop').locator('a.group .relative').first()
      const box = await card.boundingBox()
      expect(box).toBeTruthy()
      const ratio = (box!.height) / (box!.width)
      expect(ratio).toBeGreaterThanOrEqual(1.55)
    })
  })

  test('видео отсутствует на странице', async ({ page }) => {
    await page.goto(base)
    await page.waitForLoadState('networkidle')
    const iframes = page.locator('iframe')
    await expect(iframes).toHaveCount(0)
  })
})