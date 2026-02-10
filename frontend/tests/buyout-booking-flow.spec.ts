import { test, expect } from '@playwright/test';

test('Booking API creates order and tracking shows reserve block', async ({ page, request }) => {
  const resp = await request.get('http://localhost:8082/api/bikes?limit=1');
  const data = await resp.json();
  const id = String(data?.bikes?.[0]?.id || data?.bikes?.[0]?.bike_id || 1);

  const bikeResp = await request.get(`http://localhost:8082/api/bikes/${id}`);
  const bikeData = await bikeResp.json();
  const bike = bikeData?.bike || bikeData;
  const price = Number(bike?.price || bike?.price_eur || bike?.priceEU || 0) || 0;

  const payload = {
    bike_id: id,
    customer: {
      name: 'Test User',
      phone: '+79990000000',
      contact_method: 'phone',
      contact_value: '+79990000000',
      city: 'Москва',
    },
    bike_details: { ...bike, price },
    delivery_method: 'Cargo',
    booking_form: {
      city: 'Москва',
      contact_method: 'phone',
      contact_value: '+79990000000',
      delivery_option: 'Cargo',
      addons_selection: {},
    },
  };

  const bookingResp = await request.post('http://localhost:8082/api/v1/booking', { data: payload });
  const booking = await bookingResp.json();
  expect(booking?.success).toBeTruthy();

  const orderCode = booking?.order_code || booking?.orderNumber || booking?.order?.order_number;
  expect(orderCode).toBeTruthy();

  await page.goto(`http://localhost:5175/order-tracking/${orderCode}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/Резервирование/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Оплатить резерв/i })).toBeVisible();
});
