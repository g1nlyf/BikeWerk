import { Router } from 'express';
const bookingService = require('../../../services/BookingService');

const router = Router();

async function logBookingMetric(req: any, eventType: string, bikeId: number | null, metadata: Record<string, unknown> = {}) {
    try {
        if (!bookingService?.db || typeof bookingService.db.query !== 'function') return;
        const sessionId = req.headers?.['x-session-id'] ? String(req.headers['x-session-id']) : null;
        const userId = req.user?.id || null;
        const referrer = req.headers?.referer ? String(req.headers.referer) : null;
        const sourcePath = req.headers?.['x-source-path'] ? String(req.headers['x-source-path']) : '/booking';
        const attribution = {
            utm_source: req.headers?.['x-utm-source'] ? String(req.headers['x-utm-source']) : null,
            utm_medium: req.headers?.['x-utm-medium'] ? String(req.headers['x-utm-medium']) : null,
            utm_campaign: req.headers?.['x-utm-campaign'] ? String(req.headers['x-utm-campaign']) : null,
            utm_last_source: req.headers?.['x-utm-last-source'] ? String(req.headers['x-utm-last-source']) : null,
            utm_last_medium: req.headers?.['x-utm-last-medium'] ? String(req.headers['x-utm-last-medium']) : null,
            utm_last_campaign: req.headers?.['x-utm-last-campaign'] ? String(req.headers['x-utm-last-campaign']) : null,
            click_id: req.headers?.['x-click-id'] ? String(req.headers['x-click-id']) : null,
            landing_path: req.headers?.['x-landing-path'] ? String(req.headers['x-landing-path']) : null
        };

        await bookingService.db.query(
            'INSERT INTO metric_events (bike_id, event_type, value, metadata, created_at, session_id, referrer, source_path, user_id) VALUES (?, ?, ?, ?, datetime("now"), ?, ?, ?, ?)',
            [bikeId, eventType, 1, JSON.stringify({ ...metadata, attribution }), sessionId, referrer, sourcePath, userId]
        );
    } catch {
        // Best effort only: booking flow must not fail due metrics logging.
    }
}

router.post('/', async (req, res) => {
    try {
        const { 
            bike_id, 
            customer, 
            bike_details,
            total_price_rub,
            booking_amount_rub,
            exchange_rate,
            final_price_eur,
            delivery_method,
            shipping_option, // Fallback alias
            addons,
            booking_form
        } = req.body;
        const parsedBikeId = Number.isFinite(Number(bike_id)) ? Number(bike_id) : null;

        if (!bike_id || !customer || !bike_details) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        await logBookingMetric(req, 'booking_start', parsedBikeId, { source: 'v1_booking_route' });

        const result = await bookingService.createBooking({
            bike_id,
            customer,
            bike_details,
            total_price_rub,
            booking_amount_rub,
            exchange_rate,
            final_price_eur,
            delivery_method: delivery_method || shipping_option, // Pass it through
            addons,
            booking_form
        });

        await logBookingMetric(req, 'booking_success', parsedBikeId, {
            source: 'v1_booking_route',
            order_code: result?.order_code || null
        });
        await logBookingMetric(req, 'order', parsedBikeId, {
            source: 'v1_booking_route',
            order_code: result?.order_code || null
        });

        res.json(result);
    } catch (error: any) {
        const parsedBikeId = Number.isFinite(Number(req.body?.bike_id)) ? Number(req.body?.bike_id) : null;
        await logBookingMetric(req, 'booking_failed', parsedBikeId, {
            source: 'v1_booking_route',
            error: String(error?.message || 'unknown')
        });
        console.error('Booking Error:', error.message);
        // Handle explicit 400 errors from service
        const statusCode = error.message && error.message.startsWith('400:') ? 400 : 500;
        res.status(statusCode).json({ success: false, error: error.message || 'Internal Server Error' });
    }
});

export default router;
