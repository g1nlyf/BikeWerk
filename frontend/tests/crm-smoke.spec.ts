import { test, expect, type APIRequestContext } from '@playwright/test'

const BACKEND_URL = process.env.CRM_BACKEND_URL || 'http://127.0.0.1:8082'

type AuthSession = {
  token: string
  user: { id?: string; role?: string; email?: string }
  email: string
  password: string
}

function pickSearchTerm(text: string): string {
  const words = text
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9-]/g, ''))
    .filter((word) => word.length >= 4)
  return words[0] || text.slice(0, 4)
}

async function loginAsManager(request: APIRequestContext): Promise<AuthSession | null> {
  const envEmail = String(process.env.CRM_TEST_EMAIL || '').trim()
  const envPassword = String(process.env.CRM_TEST_PASSWORD || '').trim()
  const candidates = [
    ...(envEmail && envPassword ? [{ email: envEmail, password: envPassword }] : []),
    { email: 'hackerios222@gmail.com', password: '12345678' },
    { email: 'crm.manager@local', password: 'crmtest123' },
    { email: 'admin@eubike.com', password: 'admin123' },
    { email: 'admin@gmail.com', password: '12345678' },
  ]

  for (const candidate of candidates) {
    try {
      const response = await request.post(`${BACKEND_URL}/api/auth/login`, {
        data: candidate,
      })
      if (!response.ok()) continue
      const payload = await response.json()
      const token = payload?.token || payload?.data?.token || null
      const user = payload?.user || payload?.data?.user || null
      const success = Boolean(payload?.success)
      if (!success || !token || !user) continue
      const role = String(user.role || '').toLowerCase()
      if (role !== 'manager' && role !== 'admin') continue
      return { token, user, email: candidate.email, password: candidate.password }
    } catch (error) {
      console.warn('CRM smoke auth candidate failed', candidate.email, error)
    }
  }
  return null
}

async function createSmokeBooking(request: APIRequestContext): Promise<boolean> {
  const stamp = Date.now()
  try {
    const response = await request.post(`${BACKEND_URL}/api/v1/booking`, {
      data: {
        bike_id: `SMOKE-${stamp}`,
        customer: {
          full_name: `Smoke User ${stamp}`,
          name: `Smoke User ${stamp}`,
          email: `smoke-${stamp}@example.com`,
          phone: `+7999000${String(stamp).slice(-4)}`
        },
        bike_details: {
          bike_id: `SMOKE-${stamp}`,
          bike_url: `https://example.com/listings/${stamp}`,
          external_bike_ref: `smoke-${stamp}`,
          title: `Smoke Bike ${stamp}`,
          brand: 'Trek',
          model: 'Domane',
          year: 2022,
          size: '56',
          price: 1200,
          main_photo_url: 'https://ik.imagekit.io/demo/default-image.jpg',
          images: ['https://ik.imagekit.io/demo/default-image.jpg']
        },
        total_price_rub: 100000,
        booking_amount_rub: 2000,
        exchange_rate: 100,
        final_price_eur: 1000,
        delivery_method: 'Cargo',
        booking_form: {
          city: 'Moscow',
          delivery_option: 'Cargo',
          contact_method: 'email'
        }
      }
    })
    if (!response.ok()) return false
    const payload = await response.json()
    return Boolean(payload?.success)
  } catch {
    return false
  }
}

async function resolveFirstOrderRouteKey(request: APIRequestContext, token: string): Promise<string | null> {
  try {
    const response = await request.get(`${BACKEND_URL}/api/v1/crm/orders?limit=20`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!response.ok()) return null
    const payload = await response.json()
    const rows = Array.isArray(payload?.orders) ? payload.orders : []
    if (!rows.length) return null
    const first = rows[0] || {}
    const key = first.order_number || first.order_id || first.id || null
    return key == null ? null : String(key)
  } catch {
    return null
  }
}

test('@smoke CRM critical manager flow', async ({ page, request }) => {
  const auth = await loginAsManager(request)
  expect(auth, 'Could not authenticate with available CRM manager/admin test accounts').not.toBeNull()
  const blockedImageErrors: string[] = []
  page.on('console', (msg) => {
    const text = msg.text()
    if (/ERR_BLOCKED_BY_RESPONSE|NotSameOrigin|image-proxy/i.test(text)) {
      blockedImageErrors.push(text)
    }
  })

  await page.goto('/crm/login')
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('authToken', token)
    localStorage.setItem('currentUser', JSON.stringify(user))
  }, { token: auth!.token, user: auth!.user })

  await page.goto('/crm/dashboard')
  if (page.url().includes('/crm/login')) {
    await page.locator('input').first().fill(auth!.email)
    await page.locator('input[type="password"]').first().fill(auth!.password)
    await page.getByRole('button', { name: /sign in|войти/i }).click()
  }
  await expect(page).toHaveURL(/\/crm\/dashboard/)
  await expect(page.getByText(/Orders last week|Заказы за неделю/i)).toBeVisible()
  await expect(page.getByText('undefined')).toHaveCount(0)

  await page.goto('/crm/orders')
  const searchInput = page.getByPlaceholder(/Search by order, customer, or bike|Поиск по заказу, клиенту или байку/i)
  await expect(searchInput).toBeVisible()

  let openButtons = page.locator('table tbody tr td:last-child button:last-child')
  if ((await openButtons.count()) === 0 && (await page.locator('table tbody tr').count()) === 0) {
    await createSmokeBooking(request)
    await page.reload()
    await page.waitForTimeout(1500)
    openButtons = page.locator('table tbody tr td:last-child button:last-child')
  }
  await expect(page.locator('table tbody tr').first()).toBeVisible()

  const firstRow = page.locator('table tbody tr').first()
  const bikeText = (await firstRow.locator('td').nth(1).innerText()).trim()
  const searchTerm = pickSearchTerm(bikeText)
  await searchInput.fill(searchTerm)
  await page.waitForTimeout(800)
  await expect(page.locator('table tbody tr').first()).toContainText(new RegExp(searchTerm, 'i'))
  await page.reload()
  await expect(searchInput).toHaveValue(searchTerm)
  if ((await page.locator('table tbody tr').count()) === 0) {
    const resetFiltersButton = page.getByRole('button', { name: /Reset filters|Reset|Сбросить фильтры|Сбросить/i }).first()
    if (await resetFiltersButton.count()) {
      await resetFiltersButton.click()
      await page.waitForTimeout(1000)
    }
  }

  const routeKey = await resolveFirstOrderRouteKey(request, auth!.token)
  expect(routeKey, 'Could not resolve an order route key from CRM API').not.toBeNull()
  await page.goto(`/crm/orders/${routeKey!}`)
  await expect(page).toHaveURL(/\/crm\/orders\/(?!undefined)/)

  const statusSelect = page.locator('select').first()
  await expect(statusSelect).toBeVisible()
  const currentStatus = await statusSelect.inputValue()
  const optionValues = await statusSelect.locator('option').evaluateAll((options) =>
    options
      .map((option) => (option as HTMLOptionElement).value)
      .filter((value) => typeof value === 'string' && value.length > 0)
  )
  const nextStatus = optionValues.find((value) => value !== currentStatus) || null
  if (nextStatus) {
    const [statusUpdateResponse] = await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/api/v1/crm/orders/')
        && response.url().includes('/status')
        && ['PATCH', 'PUT'].includes(response.request().method())
      ),
      statusSelect.selectOption(nextStatus)
    ])
    expect(statusUpdateResponse.status(), 'Order status update should not return 500').toBeLessThan(500)
    await page.waitForTimeout(700)
    await page.reload()
    const persistedStatus = await page.locator('select').first().inputValue()
    expect(persistedStatus.length).toBeGreaterThan(0)
  }

  const priceInput = page.getByTestId('order-price-input')
  await expect(priceInput).toBeVisible()
  const currentPrice = Number(await priceInput.inputValue() || '0')
  const newPrice = Number.isFinite(currentPrice) ? Math.max(1, Math.round(currentPrice) + 1) : 1000
  await priceInput.fill(String(newPrice))
  await page.getByTestId('order-price-save').click()
  await page.waitForTimeout(700)
  await page.reload()
  const reloadedPrice = Number(await page.getByTestId('order-price-input').inputValue() || '0')
  expect(reloadedPrice).toBe(newPrice)

  const trackingNumber = `SMOKE-${Date.now()}`
  const today = new Date().toISOString().slice(0, 10)
  await page.getByTestId('order-shipment-provider').fill('rusbid')
  await page.getByTestId('order-shipment-tracking').fill(trackingNumber)
  await page.getByTestId('order-shipment-date').fill(today)
  await page.getByTestId('order-shipment-add').click()
  await expect(page.locator(`input[value="${trackingNumber}"]`).first()).toBeVisible()
  await page.reload()
  await expect(page.locator(`input[value="${trackingNumber}"]`).first()).toBeVisible()

  const keepTaskTitle = `SMOKE keep ${Date.now()}`
  const deleteTaskTitle = `SMOKE delete ${Date.now()}`
  await page.getByTestId('order-quick-task-input').fill(keepTaskTitle)
  await page.getByTestId('order-quick-task-add').click()
  await expect(page.getByText(keepTaskTitle)).toBeVisible()
  await page.getByTestId('order-quick-task-input').fill(deleteTaskTitle)
  await page.getByTestId('order-quick-task-add').click()
  await expect(page.getByText(deleteTaskTitle)).toBeVisible()

  await page.goto('/crm/tasks')
  await expect(page.getByText(keepTaskTitle)).toBeVisible()
  await expect(page.getByText(deleteTaskTitle)).toBeVisible()
  const deleteRow = page.locator('tr').filter({ hasText: deleteTaskTitle })
  page.once('dialog', (dialog) => dialog.accept())
  await deleteRow.locator('button[title]').first().click()
  await expect(page.getByText(deleteTaskTitle)).toHaveCount(0)
  await expect(page.getByText(keepTaskTitle)).toBeVisible()

  const keepRow = page.locator('tr').filter({ hasText: keepTaskTitle })
  if (await keepRow.count()) {
    page.once('dialog', (dialog) => dialog.accept())
    await keepRow.locator('button[title]').first().click()
  }

  await page.goto('/crm/orders?view=kanban')
  const kanbanCards = page.locator('.cursor-grab')
  if (await kanbanCards.count()) {
    const firstCard = kanbanCards.first()
    await expect(firstCard).toBeVisible()
    const hasImage = await firstCard.locator('img').count()
    const hasFallback = await firstCard.getByText('No image').count()
    expect(hasImage + hasFallback).toBeGreaterThan(0)
  }

  await page.goto('/crm/leads')
  const leadRows = page.locator('table tbody tr')
  if (await leadRows.count()) {
    const firstStatusSelect = leadRows.first().locator('select').first()
    const currentLeadStatus = await firstStatusSelect.inputValue()
    const nextLeadStatus = currentLeadStatus === 'new' ? 'in_progress' : 'new'
    const [leadUpdateResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/v1/crm/leads/') && ['PATCH', 'PUT'].includes(response.request().method())),
      firstStatusSelect.selectOption(nextLeadStatus)
    ])
    expect(leadUpdateResponse.status(), 'Lead status update should not return 500').toBeLessThan(500)
    await expect(firstStatusSelect).toHaveValue(nextLeadStatus)
  }

  await page.goto('/crm/customers')
  if ((await page.locator('table tbody tr').count()) === 0) {
    return
  }
  const firstCustomerRow = page.locator('table tbody tr').first()
  await firstCustomerRow.click()
  await expect(page.getByTestId('customer-total-orders')).toBeVisible()
  await expect(page.getByTestId('customer-total-spent')).toBeVisible()
  const totalOrders = Number((await page.getByTestId('customer-total-orders').innerText()).trim() || '0')
  const ordersInHistory = await page.getByTestId('customer-order-item').count()
  expect(totalOrders).toBe(ordersInHistory)
  const totalSpentText = await page.getByTestId('customer-total-spent').innerText()
  expect(totalSpentText).not.toContain('NaN')
  expect(blockedImageErrors, `Found blocked image console errors: ${blockedImageErrors.join(' | ')}`).toHaveLength(0)
})
