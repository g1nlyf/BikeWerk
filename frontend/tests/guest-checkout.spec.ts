import { test, expect } from '@playwright/test';

test.describe('Guest checkout overlay', () => {
  test('shows friendly overlay on Add to Cart for unauth user', async ({ page }) => {
    const run = async (viewport: { width: number; height: number }) => {
      await page.setViewportSize(viewport)
      await page.goto('http://localhost:5175/test/2');
      await page.waitForLoadState('networkidle');
      const addButtons = page.getByRole('button', { name: /Добавить в корзину|В корзину/ });
      await addButtons.first().waitFor({ state: 'visible' });
      await addButtons.first().click();
      const orderNow = page.getByTestId('cta-order-now');
      await expect(orderNow).toBeVisible();

      await orderNow.click()
      const booking = page.getByTestId('booking-overlay-content')
      await expect(booking).toBeVisible()

      const noVScroll = await booking.evaluate(el => el.scrollHeight <= el.clientHeight + 2)
      expect(noVScroll).toBeTruthy()
      const noHScroll = await booking.evaluate(el => el.scrollWidth <= el.clientWidth + 2)
      expect(noHScroll).toBeTruthy()

      const cta = page.getByRole('button', { name: /Внести задаток/i })
      await expect(cta).toBeVisible()
      const box = await cta.boundingBox()
      expect(box).toBeTruthy()
      if (box) {
        expect(box.y).toBeGreaterThanOrEqual(-1)
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
      }
    }

    await run({ width: 390, height: 844 })
    await run({ width: 375, height: 667 })
  });
});
