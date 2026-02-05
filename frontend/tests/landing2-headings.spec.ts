import { test, expect } from '@playwright/test'

test.describe('Заголовки первых трёх модулей /test/2', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('контент и единый стиль', async ({ page }) => {
    await page.goto('http://localhost:5175/test/2')
    await page.waitForLoadState('networkidle')

    const firstHeading = page.getByTestId('mini-heading').first()
    const catsHeading = page.getByTestId('categories-title')
    const secondHeading = page.getByTestId('mini-heading').nth(1)

    await expect(firstHeading).toHaveText('Лучшие предложения')
    await expect(catsHeading).toHaveText('Категории каталога')
    await expect(secondHeading).toHaveText('Подобрали специально для тебя')

    const s1 = await firstHeading.evaluate(el => { const cs = getComputedStyle(el); return { fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight, 10), ls: parseFloat(cs.letterSpacing), lh: parseFloat(cs.lineHeight), mb: parseFloat(cs.marginBottom) } })
    const s2 = await catsHeading.evaluate(el => { const cs = getComputedStyle(el); return { fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight, 10), ls: parseFloat(cs.letterSpacing), lh: parseFloat(cs.lineHeight), mb: parseFloat(cs.marginBottom) } })
    const s3 = await secondHeading.evaluate(el => { const cs = getComputedStyle(el); return { fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight, 10), ls: parseFloat(cs.letterSpacing), lh: parseFloat(cs.lineHeight), mb: parseFloat(cs.marginBottom) } })

    expect(Math.round(s1.fs)).toBe(Math.round(s2.fs))
    expect(Math.round(s2.fs)).toBe(Math.round(s3.fs))
    expect(s1.fw).toBeGreaterThanOrEqual(700)
    expect(s2.fw).toBeGreaterThanOrEqual(700)
    expect(s3.fw).toBeGreaterThanOrEqual(700)
    expect(Math.round(s1.ls * 1000)/1000).toBe(Math.round(s2.ls * 1000)/1000)
    expect(Math.round(s2.ls * 1000)/1000).toBe(Math.round(s3.ls * 1000)/1000)
    expect(Math.round(s1.mb)).toBe(Math.round(s2.mb))
  })
})