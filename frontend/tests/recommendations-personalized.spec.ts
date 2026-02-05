import { test, expect } from '@playwright/test'

const FRONT = process.env.FRONT_URL || 'http://localhost:5176/test/2'
const API = process.env.API_URL || 'http://localhost:8081/api'

test.describe('Персонализация «Подобрали специально для тебя»', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('сессия влияет на рекомендации по категории', async ({ page, request }) => {
    await page.goto(FRONT)
    await page.waitForLoadState('networkidle')

    const sid = await page.evaluate(() => {
      const ex = localStorage.getItem('sid')
      if (ex) return ex
      const v = (crypto && 'randomUUID' in crypto) ? crypto.randomUUID() : String(Date.now())
      localStorage.setItem('sid', v)
      return v
    })

    const bikesRes = await request.get(`${API}/bikes?limit=5`)
    const bikesJson = await bikesRes.json()
    const any = (Array.isArray(bikesJson?.bikes) ? bikesJson.bikes[0] : null)
    expect(any).toBeTruthy()

    // Отправляем событие просмотра детали
    const evRes = await request.post(`${API}/metrics/events`, { data: { events: [{ bikeId: any.id, type: 'detail_open', session_id: sid, source_path: '/test/2' }] } })
    const ok = await evRes.json()
    expect(ok?.success).toBeTruthy()

    // Запрашиваем рекомендации с той же сессией
    const recRes = await request.get(`${API}/recommendations/personalized?limit=8`, { headers: { 'x-session-id': sid } })
    const recJson = await recRes.json()
    const recs = Array.isArray(recJson?.bikes) ? recJson.bikes : []
    expect(recs.length).toBeGreaterThan(0)
    const hasSameCategory = recs.some((b: any) => b.category && b.category === any.category)
    expect(hasSameCategory).toBeTruthy()

    // На странице второй блок мини‑каталога содержит карточки
    const secondHeading = page.getByTestId('mini-heading').nth(1)
    await expect(secondHeading).toHaveText('Подобрали специально для тебя')
    const section = secondHeading.locator('xpath=ancestor::section[1]')
    const links = section.locator('.hidden.md\\:block a[href^="/product/"]')
    await expect(links.first()).toBeVisible()
  })
})