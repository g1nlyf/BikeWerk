import { test, expect } from '@playwright/test'

test.describe('Рабочий CTA блок', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('находится ниже секции быстрой доставки и имеет нужный стиль', async ({ page }) => {
    await page.goto('http://localhost:5175/')
    await page.waitForLoadState('networkidle')

    const delivery = page.getByTestId('best-delivery-section')
    const ctaBlock = page.getByTestId('work-cta-block')
    const cta = page.getByTestId('work-cta')

    await expect(delivery).toBeVisible()
    await expect(ctaBlock).toBeVisible()
    await expect(cta).toBeVisible()

    const deliveryBox = await delivery.boundingBox()
    const blockBox = await ctaBlock.boundingBox()
    expect(deliveryBox).toBeTruthy(); expect(blockBox).toBeTruthy()
    expect(Math.round(blockBox!.y)).toBeGreaterThanOrEqual(Math.round((deliveryBox!.y + deliveryBox!.height)))

    const styles = await cta.evaluate(el => {
      const cs = getComputedStyle(el)
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        borderColor: cs.borderColor,
        borderWidth: parseFloat(cs.borderWidth),
        radius: parseFloat(cs.borderRadius),
        fontSize: parseFloat(cs.fontSize),
        fontWeight: parseInt(cs.fontWeight, 10),
        boxShadow: cs.boxShadow,
        transform: cs.transform,
      }
    })
    expect(styles.bg).toMatch(/rgb\(255,\s*255,\s*255\)/)
    expect(styles.color).toMatch(/rgb\(0,\s*0,\s*0\)/)
    expect(styles.borderColor).toMatch(/rgb\(0,\s*0,\s*0\)/)
    expect(styles.borderWidth).toBeGreaterThanOrEqual(2)
    expect(styles.radius).toBeGreaterThanOrEqual(20)
    expect(styles.fontSize).toBeGreaterThanOrEqual(20)
    expect(styles.fontWeight).toBeGreaterThanOrEqual(800)
    expect(styles.boxShadow.length).toBeGreaterThan(0)

    // hover increases scale
    await cta.hover()
    const hoverMatrix = await cta.evaluate(el => getComputedStyle(el).transform)
    if (hoverMatrix && hoverMatrix !== 'none') {
      const parts = hoverMatrix.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(s => parseFloat(s.trim())) || []
      if (parts.length === 6) {
        const scaleX = parts[0]
        expect(scaleX).toBeGreaterThan(1)
      }
    }

    // active reduces scale without navigation
    await cta.hover()
    await page.mouse.down()
    const activeMatrix = await cta.evaluate(el => getComputedStyle(el).transform)
    await page.mouse.up()
    if (activeMatrix && activeMatrix !== 'none') {
      const parts = activeMatrix.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(s => parseFloat(s.trim())) || []
      if (parts.length === 6) {
        const scaleX = parts[0]
        expect(scaleX).toBeLessThanOrEqual(1)
      }
    }
  })

  test('мобильный вид: кнопка на полную ширину и мягкие края', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:5175/')
    await page.waitForLoadState('networkidle')
    const cta = page.getByTestId('work-cta')
    const box = await cta.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(320)
    const radius = await cta.evaluate(el => parseFloat(getComputedStyle(el).borderRadius))
    expect(radius).toBeGreaterThanOrEqual(20)
  })
})