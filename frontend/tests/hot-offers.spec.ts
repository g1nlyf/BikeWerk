import { test, expect, request } from '@playwright/test';

test('Hot offers flow', async ({ page, request }) => {
  // 1. Login via API to get token
  const loginRes = await request.post('http://localhost:8081/api/auth/login', {
    data: { email: 'admin@gmail.com', password: '12345678' }
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginData = await loginRes.json();
  expect(loginData.success).toBeTruthy();
  expect(loginData.token).toBeTruthy();
  expect(loginData.user.role).toBe('admin');

  // 2. Set localStorage and go to catalog
  await page.goto('http://localhost:5175/'); // Go to valid domain first
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('authToken', token);
  }, { user: loginData.user, token: loginData.token });

  await page.goto('http://localhost:5175/catalog');
  await page.waitForSelector('.group.relative'); // Wait for bike cards
  
  // Verify admin button logic
  const firstBikeLink = page.locator('.group.relative').first();
  await firstBikeLink.click();
  
  // 3. Toggle Hot status
  // Scope to the main product gallery to avoid buttons in "Similar products"
  const galleryCard = page.getByTestId('product-gallery-card');
  const toggleButton = galleryCard.getByRole('button', { name: /Make Hot|HOT/i }).first();
  await expect(toggleButton).toBeVisible();
  
  const buttonText = await toggleButton.innerText();
  if (buttonText === 'HOT') {
    console.log('Bike is already hot');
    // Toggle off then on? Or just verify it's hot.
    // Let's toggle OFF then ON to test full flow.
    await toggleButton.click();
    await expect(galleryCard.getByRole('button', { name: 'Make Hot' })).toBeVisible();
    await toggleButton.click();
    await expect(galleryCard.getByRole('button', { name: 'HOT' })).toBeVisible();
  } else {
    // Make hot
    await toggleButton.click();
    await expect(galleryCard.getByRole('button', { name: 'HOT' })).toBeVisible();
  }

  // Verify badge
  await expect(galleryCard.getByText('Горячее предложение!')).toBeVisible();
  
  // Verify red price
  const price = page.locator('.text-red-600').first();
  await expect(price).toBeVisible();

  // 4. Check Landing Page "Лучшие предложения"
  await page.goto('http://localhost:5175/test/2');
  // Wait for mini catalog
  await page.waitForSelector('[data-testid="mini-section"]');
  const miniSection = page.locator('[data-testid="mini-section"]').first();
  await expect(miniSection.getByText('Лучшие предложения')).toBeVisible();
  
  // Check for red prices in this section
  // Note: There might be mobile (hidden) and desktop (visible) elements. We want visible ones.
  const redPriceInMini = miniSection.locator('.text-red-600:visible').first();
  await expect(redPriceInMini).toBeVisible({ timeout: 10000 });

  // 5. Check Catalog Hot category
  await page.goto('http://localhost:5175/catalog#hot');
  await page.waitForTimeout(2000); // hashchange
  
  // Check if URL has #hot
  expect(page.url()).toContain('#hot');
  
  // Check for red prices
  const catalogRedPrice = page.locator('.text-red-600').first();
  await expect(catalogRedPrice).toBeVisible();

});
