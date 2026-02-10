import { Router } from 'express';
const bookingService = require('../../../services/BookingService');

const router = Router();

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

        if (!bike_id || !customer || !bike_details) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

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

        res.json(result);
    } catch (error: any) {
        console.error('Booking Error:', error.message);
        // Handle explicit 400 errors from service
        const statusCode = error.message && error.message.startsWith('400:') ? 400 : 500;
        res.status(statusCode).json({ success: false, error: error.message || 'Internal Server Error' });
    }
});

export default router;
