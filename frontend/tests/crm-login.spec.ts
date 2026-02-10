import { test, expect } from '@playwright/test'

test('CRM login renders', async ({ page }) => {
  await page.goto('http://localhost:5175/crm/login')
  await expect(page.getByRole('heading', { name: /sign in to crm/i })).toBeVisible()
  await expect(page.getByPlaceholder('email or phone')).toBeVisible()
  await expect(page.getByPlaceholder('Enter password')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
})

test('CRM dashboard redirects to login when unauthenticated', async ({ page }) => {
  await page.goto('http://localhost:5175/crm/dashboard')
  await expect(page).toHaveURL(/\/crm\/login/)
  await expect(page.getByRole('heading', { name: /sign in to crm/i })).toBeVisible()
})
