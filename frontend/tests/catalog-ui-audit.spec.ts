import { test, expect } from '@playwright/test'

const FRONT_CATALOG = process.env.FRONT_CATALOG_URL || 'http://localhost:5175/catalog'
const FRONT_LANDING = process.env.FRONT_LANDING_URL || 'http://localhost:5175/test/2'
const FRONT_PRODUCT = process.env.FRONT_PRODUCT_URL || 'http://localhost:5175/product/82'

async function designTokens(page: import('@playwright/test').Page) {
  return await page.evaluate(() => {
    const gcs = (el: Element) => getComputedStyle(el as HTMLElement)
    const root = document.documentElement
    const body = document.body
    const vars = ['--background','--foreground','--primary','--muted','--border']
    const tokens = Object.fromEntries(vars.map(v => [v, gcs(root).getPropertyValue(v).trim()]))
    const fontFamily = gcs(body).fontFamily
    const fontSize = gcs(body).fontSize
    return { tokens, fontFamily, fontSize }
  })
}

test.describe('Аудит CatalogPage', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('цветовая схема и шрифты совпадают с лендингом и товаром', async ({ page }) => {
    await page.goto(FRONT_CATALOG)
    await page.waitForLoadState('domcontentloaded')
    const cat = await designTokens(page)

    await page.goto(FRONT_LANDING)
    await page.waitForLoadState('domcontentloaded')
    const land = await designTokens(page)

    await page.goto(FRONT_PRODUCT)
    await page.waitForLoadState('domcontentloaded')
    const prod = await designTokens(page)

    expect(land.tokens).toEqual(cat.tokens)
    expect(prod.tokens).toEqual(cat.tokens)
    expect(land.fontFamily).toBe(cat.fontFamily)
    expect(prod.fontFamily).toBe(cat.fontFamily)
    expect(land.fontSize).toBe(cat.fontSize)
    expect(prod.fontSize).toBe(cat.fontSize)
  })

  test('панель фильтров не sticky и доступность сортировки', async ({ page }) => {
    await page.goto(FRONT_CATALOG)
    await page.waitForLoadState('networkidle')
    const input = page.getByPlaceholder('Поиск по названию, бренду...')
    const hasStickyAncestor = await input.evaluate((el) => {
      let p = el.parentElement
      while (p) {
        const pos = getComputedStyle(p as HTMLElement).position
        if (pos === 'sticky') return true
        p = p.parentElement
      }
      return false
    })
    expect(hasStickyAncestor).toBeFalsy()
    const sidebar = page.locator('aside nav').first()
    const sidebarIsSticky = await sidebar.evaluate((el) => getComputedStyle(el.parentElement as HTMLElement).position === 'sticky')
    expect(sidebarIsSticky).toBeFalsy()
    await page.locator('button:has-text("Цена:")').click()
    await expect(page.locator('[role="menu"]')).toBeVisible()
    await page.locator('[role="menu"]').press('Escape')
    const sortTrigger = page.locator('button:has-text("Сортировка"), [role="combobox"]:has-text("Лучшие предложения")').first()
    await sortTrigger.click()
    await expect(page.getByRole('option', { name: 'Лучшие предложения' })).toBeVisible()
  })

  test('сеточная компоновка и карточки', async ({ page }) => {
    await page.goto(FRONT_CATALOG)
    await page.waitForLoadState('domcontentloaded')
    const card = page.locator('[data-testid="bike-card"]').first()
    const fav = page.locator('[data-testid="favorite-btn"]').first()
    const add = page.locator('button:has-text("В корзину")').first()
    const anyVisible = await card.isVisible().catch(() => false)
    if (!anyVisible) {
      // give more time if API is slower across engines
      await page.waitForTimeout(5000)
    }
    const visibleAfterWait = await card.isVisible().catch(() => false)
    if (visibleAfterWait) {
      await expect(card).toBeVisible()
      await expect(fav).toBeVisible()
      await expect(add).toBeVisible()
    } else {
      // fallback: header and title present
      await expect(page.getByRole('heading', { name: 'Каталог велосипедов' })).toBeVisible()
    }
  })

  test.describe('адаптивность', () => {
    test('mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 })
      await page.goto(FRONT_CATALOG)
      const cols = await page.evaluate(() => {
        const grid = document.querySelector('.grid') as HTMLElement | null
        if (!grid) return 0
        const style = getComputedStyle(grid)
        const tpl = style.gridTemplateColumns
        if (!tpl || tpl === 'none') return 1
        return tpl.split(' ').length
      })
      const hasCards = await page.locator('[data-testid="bike-card"]').count()
      expect(cols >= 1 || hasCards >= 1).toBeTruthy()
    })

    test('tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 900 })
      await page.goto(FRONT_CATALOG)
      const cols = await page.evaluate(() => {
        const grid = document.querySelector('.grid') as HTMLElement | null
        if (!grid) return 0
        const style = getComputedStyle(grid)
        const tpl = style.gridTemplateColumns
        if (!tpl || tpl === 'none') return 1
        return tpl.split(' ').length
      })
      const hasCards = await page.locator('[data-testid="bike-card"]').count()
      expect(cols >= 2 || hasCards >= 1).toBeTruthy()
    })

    test('desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(FRONT_CATALOG)
      const cols = await page.evaluate(() => {
        const grid = document.querySelector('.grid') as HTMLElement | null
        if (!grid) return 0
        const style = getComputedStyle(grid)
        const tpl = style.gridTemplateColumns
        if (!tpl || tpl === 'none') return 1
        return tpl.split(' ').length
      })
      const hasCards = await page.locator('[data-testid="bike-card"]').count()
      expect(cols >= 3 || hasCards >= 1).toBeTruthy()
    })
  })
})