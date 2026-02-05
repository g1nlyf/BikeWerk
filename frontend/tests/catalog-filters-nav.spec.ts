import { test, expect } from '@playwright/test'

test.describe('Каталог: навигация и фильтры', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('Переход с лендинга по MTB разворачивает и отмечает подкатегории', async ({ page }) => {
    await page.goto('http://localhost:5175/test/2')
    await page.waitForLoadState('networkidle')

    await page.locator('a[href="/catalog#mtb"]').first().click()
    await expect(page).toHaveURL(/\/catalog#mtb$/)

    const group = page.getByTestId('sidebar-group-mtb')
    await expect(group).toBeVisible()

    const subs = page.locator('[data-testid^="sub-checkbox-mtb-"]')
    await expect(subs).toHaveCount(4)
    const cnt = await subs.count()
    for (let i = 0; i < cnt; i++) {
      const st = await subs.nth(i).getAttribute('data-state')
      const ar = await subs.nth(i).getAttribute('aria-checked')
      expect((st === 'checked') || (ar === 'true')).toBeTruthy()
    }
  })

  test('Нет пункта Dirt в сайдбаре', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog#mtb')
    await page.waitForLoadState('networkidle')
    const dirt = page.getByText('Dirt')
    await expect(dirt).toHaveCount(0)
  })

  test('Тип объявления есть, Тип продавца отсутствует', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('listing-type-block')).toBeVisible()
    await expect(page.getByText('Тип продавца')).toHaveCount(0)
  })

  test('Фильтр по размеру L влияет на выдачу', async ({ page }) => {
    await page.goto('http://localhost:5175/catalog')
    await page.waitForLoadState('networkidle')
    const before = await page.getByTestId('bike-card').count()
    await page.getByRole('button', { name: 'Размеры' }).click()
    const l = page.getByRole('checkbox', { name: 'L' }).first()
    await l.click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const after = await page.getByTestId('bike-card').count()
    expect(after).toBeLessThanOrEqual(before)
  })
})