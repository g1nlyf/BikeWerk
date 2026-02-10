import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:5175';

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

test('@catalog list filters sort page size and save search', async ({ page }) => {
  await page.goto(`${BASE_URL}/catalog`);
  await expect(page.getByRole('heading', { name: 'Каталог BikeWerk' })).toBeVisible();

  const cards = page.locator('a[href^="/product/"]');
  await expect(cards.first()).toBeVisible();

  await page.getByLabel('Количество на странице').selectOption('12');
  await expect(page).toHaveURL(/page_size=12/);

  const nextButton = page.getByRole('button', { name: 'Вперед' });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();
  await expect(page).toHaveURL(/page=2/);

  await page.getByLabel('Поиск').fill('Canyon');
  await expect(page).toHaveURL(/q=Canyon/);

  await page.getByRole('button', { name: 'Hot offer' }).click();
  await page.getByRole('button', { name: 'Ready to ship' }).click();
  await expect(page).toHaveURL(/is_hot_offer=true/);
  await expect(page).toHaveURL(/ready_to_ship=true/);

  const savedName = `Smoke ${uniqueSuffix()}`;
  page.once('dialog', async (dialog) => {
    await dialog.accept(savedName);
  });
  await page.getByRole('button', { name: 'Сохранить текущий' }).click();

  await page.getByRole('button', { name: 'Сбросить' }).click();
  await page.getByRole('button', { name: savedName }).click();
  await expect(page).toHaveURL(/q=Canyon/);
});

test('@catalog pdp gallery and booking request succeeds', async ({ page }) => {
  await page.goto(`${BASE_URL}/catalog`);
  const firstProduct = page.locator('a[href^="/product/"]').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();

  await expect(page).toHaveURL(/\/product\//);
  await expect(page.getByRole('button', { name: 'Забронировать велосипед' })).toBeVisible();

  const thumbnails = page.locator('button img[alt*=" 2"]');
  if ((await thumbnails.count()) > 0) {
    await thumbnails.first().click();
  }

  await page.getByRole('button', { name: 'Забронировать велосипед' }).click();
  await expect(page.getByRole('heading', { name: /Бронирование/i })).toBeVisible();

  const bookingResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/v1/booking') && response.request().method() === 'POST';
  });

  await page.getByPlaceholder('Имя').fill(`Playwright User ${uniqueSuffix()}`);
  await page.getByPlaceholder('Контакт: email / телефон / Telegram').fill(`pw_${uniqueSuffix()}@test.local`);
  await page.getByPlaceholder('Город получения').fill('Moscow');
  await page.getByLabel('Я прочитал, что вход в отслеживание будет доступен по данным из подтверждения бронирования.').check();
  await page.getByRole('button', { name: 'Подтвердить бронирование' }).click();

  const response = await bookingResponse;
  expect(response.status()).toBe(200);
  await expect(page.getByText('Бронь успешно создана')).toBeVisible();
});
