import { test, expect } from '@playwright/test'

test.describe('Каталог: визуал фильтров', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('Группа MTB без чекбокса, только chevron', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog')
    await page.waitForLoadState('networkidle')
    const grp = page.getByTestId('sidebar-group-mtb')
    await expect(grp).toBeVisible()
    const ch = grp.getByRole('checkbox')
    await expect(ch).toHaveCount(0)
    const icons = await grp.locator('svg').count()
    expect(icons).toBeGreaterThan(0)
  })

  test('Блок «Тип объявления: Все/Новые/Б/У» присутствует', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog')
    await page.waitForLoadState('networkidle')
    const block = page.getByTestId('listing-type-block')
    await expect(block).toBeVisible()
    await expect(block.getByRole('button', { name: 'Все' })).toBeVisible()
    await expect(block.getByRole('button', { name: 'Новые' })).toBeVisible()
    await expect(block.getByRole('button', { name: 'Б/У' })).toBeVisible()
  })

  test('Поле поиска имеет обводку', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog')
    await page.waitForLoadState('networkidle')
    const input = page.getByPlaceholder('Поиск по названию, бренду...')
    const bw = await input.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))
    expect(bw).toBeGreaterThanOrEqual(1)
  })

  test('Кнопки фильтров с обводкой: Марки, Размеры, Цена, Сортировка', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog')
    await page.waitForLoadState('networkidle')
    for (const name of ['Марки', 'Размеры']) {
      const btn = page.getByRole('button', { name })
      const bw = await btn.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))
      expect(bw).toBeGreaterThanOrEqual(1)
    }
    const priceBtn = page.getByRole('button', { name: /Цена:/ })
    const bwp = await priceBtn.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))
    expect(bwp).toBeGreaterThanOrEqual(1)

    const typeBtn = page.locator('button[role="combobox"]').first()
    const bwt = await typeBtn.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))
    const rdt = await typeBtn.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))
    expect(bwt).toBeGreaterThanOrEqual(1)
    expect(rdt).toBeGreaterThan(6)
  })

  test('«Все типы» и блок «Тип объявления» — с обводкой и скруглением', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog')
    await page.waitForLoadState('networkidle')
    const types = page.locator('button[role="combobox"]').first()
    const bwTypes = await types.evaluate(n => parseFloat(getComputedStyle(n).borderTopWidth))
    const brTypes = await types.evaluate(n => parseFloat(getComputedStyle(n).borderTopLeftRadius))
    expect(bwTypes).toBeGreaterThanOrEqual(1)
    expect(brTypes).toBeGreaterThan(6)
    const listingTypeBlock = page.getByTestId('listing-type-block')
    const bwLT = await listingTypeBlock.evaluate(n => parseFloat(getComputedStyle(n).borderTopWidth))
    const brLT = await listingTypeBlock.evaluate(n => parseFloat(getComputedStyle(n).borderTopLeftRadius))
    expect(bwLT).toBeGreaterThanOrEqual(1)
    expect(brLT).toBeGreaterThan(6)
  })

  test('Сайдбар содержит только «Горячие предложения» из верхних пунктов', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog')
    await page.waitForLoadState('networkidle')
    const sidebar = page.locator('aside nav')
    await expect(sidebar.getByText('Восстановленные')).toHaveCount(0)
    await expect(sidebar.getByText('Новинки')).toHaveCount(0)
    await expect(page.getByTestId('sidebar-hot-toggle')).toBeVisible()
  })

  test('Верхняя панель категорий без «Восстановленные» и «Новинки», поиск с обводкой', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog')
    await page.waitForLoadState('networkidle')
    const topBar = page.locator('#app-header').first()
    await expect(topBar.getByText('Восстановленные')).toHaveCount(0)
    await expect(topBar.getByText('Новинки')).toHaveCount(0)
    const headerSearch = topBar.locator('input[name="desktop-search"]').first()
    const bw = await headerSearch.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))
    expect(bw).toBeGreaterThanOrEqual(1)
    const br = await headerSearch.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))
    expect(br).toBeGreaterThan(6)
  })

  test('Горячие предложения — чёрная пилюля при активации', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog')
    await page.waitForLoadState('networkidle')
    const hot = page.getByTestId('sidebar-hot-toggle')
    await hot.click()
    const bgColor = await hot.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bgColor).toMatch(/rgb\(0, 0, 0\)|black/i)
    const arrow = await hot.locator('svg').count()
    expect(arrow).toBeGreaterThan(0)
  })

  test('Переключатель «Тип объявления» не изменяет подкатегории', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog#mtb')
    await page.waitForLoadState('networkidle')
    const subs = page.locator('[data-testid^="sub-checkbox-mtb-"]')
    const before = await subs.evaluateAll((nodes) => nodes.filter((n)=> (n.getAttribute('data-state') === 'checked' || n.getAttribute('aria-checked') === 'true')).length)
    await page.getByTestId('listing-type-block').getByRole('button', { name: 'Новые' }).click()
    const after = await subs.evaluateAll((nodes) => nodes.filter((n)=> (n.getAttribute('data-state') === 'checked' || n.getAttribute('aria-checked') === 'true')).length)
    expect(after).toBe(before)
  })
})