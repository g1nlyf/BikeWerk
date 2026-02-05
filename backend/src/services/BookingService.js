const supabase = require('./supabase');
const managerBot = require('./ManagerBotService');
const orderDispatcher = require('./OrderDispatcher');
const { v4: uuidv4 } = require('uuid');

const priceCalculator = require('./PriceCalculatorService');

class BookingService {
    
    /**
     * Handle a new booking request
     * @param {Object} payload
     * @param {string} payload.bike_id
     * @param {Object} payload.customer { name, email, phone, telegram_id, full_name }
     * @param {Object} payload.bike_details { brand, model, price, image_url, bike_url } (Snapshot for consistency)
     */
    async createBooking({ bike_id, customer, bike_details, total_price_rub, booking_amount_rub, exchange_rate, final_price_eur, delivery_method }) {
        console.log(`🚲 New Booking Request for Bike ${bike_id}`);

        // 🛡️ Delivery Method Guard
        let shippingMethod = delivery_method;
        
        if (!shippingMethod) {
            // Gemini 3 Pro fallback parsing
            try {
                const gemini = require('./geminiProcessor');
                console.log(`🧠 Invoking Gemini 3.0 Pro to parse shipping option for ${bike_id}...`);
                const parsed = await gemini.parseBikeSnapshot(bike_details);
                shippingMethod = parsed.shipping_option;
            } catch (e) {
                console.error('Gemini Parsing Failed for shipping option:', e.message);
            }
        }

        // Strict validation: Delivery Method MUST be defined
        if (!shippingMethod) {
            throw new Error('400: Delivery method is required. Please select shipping option.');
        }

        // 1. Create/Update Customer in Supabase
        // Ensure full_name is present
        const customerPayload = { ...customer, name: customer.full_name || customer.name };
        const customerData = await this._upsertCustomer(customerPayload);
        if (!customerData) throw new Error('Failed to create customer');

        // 2. Create Lead (Intent)
        // Pass bike_url explicitly if available
        let bikeUrl = bike_details.bike_url || (bike_id ? `/bike/${bike_id}` : null);

        // 🛡️ URL Validator (Gemini 3 Pro Fallback)
        if (!bikeUrl || !bikeUrl.startsWith('http')) {
            console.log('🔍 Bike URL is missing or internal. Invoking Gemini to find external link...');
            try {
                const gemini = require('./geminiProcessor');
                const foundUrl = await gemini.findBikeUrl(bike_details);
                if (foundUrl && foundUrl.startsWith('http')) {
                    console.log(`✅ Gemini found external URL: ${foundUrl}`);
                    bikeUrl = foundUrl;
                } else {
                    console.warn('⚠️ Gemini could not find a valid external URL.');
                }
            } catch (e) {
                console.error('❌ Gemini URL Extraction Failed:', e.message);
            }
        }

        const lead = await this._createLead(customerData.id, bike_id, bikeUrl);

        // 3. Create Order (Active Deal)
        const magicToken = this._generateMagicToken();
        const orderCode = this._generateOrderCode();
        
        const order = await this._createOrder({
            customer_id: customerData.id,
            lead_id: lead.id,
            bike_id: bike_id,
            order_code: orderCode,
            magic_link_token: magicToken,
            bike_snapshot: bike_details,
            status: 'awaiting_payment',
            total_price_rub,
            booking_amount_rub,
            exchange_rate,
            final_price_eur,
            delivery_method: shippingMethod,
            bike_url: bikeUrl // Explicitly passing bike_url
        });

        // 4. Auto-Dispatch (Manager Assignment + AI Tasks)
        let assignedManager = null;
        let aiTasks = [];
        try {
            const dispatchResult = await orderDispatcher.dispatchOrder(order, bike_details);
            assignedManager = dispatchResult.manager;
            aiTasks = dispatchResult.tasks;
        } catch (e) {
            console.error('Auto-Dispatch failed:', e);
        }

        // 5. Notify Manager Bot
        try {
            // Use customerData (DB record) instead of raw customer payload to ensure correct fields
            await managerBot.notifyNewOrder(order, bike_details, customerData, { manager: assignedManager, tasks: aiTasks });
            
            // 🚀 MILLION DOLLAR IDEA: Auto-Pre-fill Inspection Checklist
            console.log(`[BookingService] Triggering Auto-Inspection for ${orderCode}...`);
            const gemini = require('./geminiProcessor');
            
            // Run in background (fire and forget)
            (async () => {
                try {
                    const bikeData = {
                        title: bike_details.title || (bike_details.brand ? `${bike_details.brand} ${bike_details.model}` : 'Bike'),
                        description: bike_details.description || '',
                        attributes: bike_details.attributes || {},
                        images: bike_details.images || [],
                        bike_snapshot: bike_details
                    };
                    
                    const inspectionResult = await gemini.performInitialInspection(bikeData);
                    
                    if (inspectionResult.error) {
                        console.error(`[BookingService] Auto-Inspection Error for ${orderCode}:`, inspectionResult.error);
                        return;
                    }
                    
                    // Save to DB
                    const { checklist, photos_status, german_inquiry_message } = inspectionResult;
                    
                    const payload = {
                        order_id: order.id,
                        stage: 'inspection',
                        checklist,
                        photos_status,
                        next_action_suggestion: german_inquiry_message,
                        updated_at: new Date()
                    };
                    
                    // Check existing
                    const { data: existingInsp } = await supabase.supabase
                        .from('inspections')
                        .select('id')
                        .eq('order_id', order.id)
                        .maybeSingle(); // Use maybeSingle to avoid error if not found
                        
                    const { error: upsertError } = await supabase.supabase
                        .from('inspections')
                        .upsert(existingInsp ? { ...existingInsp, ...payload } : payload);
                        
                    if (upsertError) {
                        console.error('[BookingService] Inspection DB Save Failed:', upsertError.message);
                    } else {
                        console.log(`[BookingService] Auto-Inspection Saved for ${orderCode}`);
                    }
                } catch (err) {
                    console.error('[BookingService] Background Inspection Critical Error:', err);
                }
            })();

        } catch (e) {
            console.error('Failed to notify manager bot:', e.message);
        }

        // 6. Return Magic Link URL
        return {
            success: true,
            magic_link_url: `/track/${magicToken}`,
            order_code: orderCode,
            status: 'accepted'
        };
    }

    async _upsertCustomer(customer) {
        // Try to find by email
        const { data: existing } = await supabase.supabase
            .from('customers')
            .select('id')
            .eq('email', customer.email)
            .single();

        if (existing) {
            const { data, error } = await supabase.supabase
                .from('customers')
                .update({
                    full_name: customer.name,
                    phone: customer.phone,
                    preferred_channel: customer.telegram_id ? 'telegram' : 'email',
                    contact_value: customer.telegram_id || customer.email
                })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase.supabase
                .from('customers')
                .insert({
                    email: customer.email,
                    full_name: customer.name,
                    phone: customer.phone,
                    preferred_channel: customer.telegram_id ? 'telegram' : 'email',
                    contact_value: customer.telegram_id || customer.email
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    }

    async _createLead(customerId, bikeId, bikeUrl) {
        const { data, error } = await supabase.supabase
            .from('leads')
            .insert({
                customer_id: customerId,
                source: 'website_booking',
                status: 'new',
                bike_url: bikeUrl || (bikeId ? `/bike/${bikeId}` : null)
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    async _createOrder({ customer_id, lead_id, bike_id, order_code, magic_link_token, bike_snapshot, status, total_price_rub, booking_amount_rub, exchange_rate, final_price_eur, delivery_method, bike_url }) {
        // Calculate booking amount
        let price = Number(bike_snapshot.price || 0);
        let bikeName = bike_snapshot.title || (bike_snapshot.brand ? `${bike_snapshot.brand} ${bike_snapshot.model}` : '');
        let initialQuality = bike_snapshot.condition || 'good';

        // 🛡️ Data Guard (Gemini 3 Pro)
        // Always invoke AI for reliable parsing of "Unknown Bike"
        try {
            const gemini = require('./geminiProcessor');
            console.log(`🧠 Invoking Gemini 3.0 Pro to parse snapshot for ${order_code}...`);
            const parsed = await gemini.parseBikeSnapshot(bike_snapshot);
            
            if (parsed.bike_name === 'Unknown' || parsed.bike_name === 'Unknown Bike') {
                throw new Error('AI could not identify bike name');
            }
            
            bikeName = parsed.bike_name;
            if (price === 0) price = parsed.listing_price_eur;
            initialQuality = parsed.initial_quality;
        } catch (e) {
            console.error('Gemini Parsing Failed:', e.message);
            // If strictly required to fail on unknown, we could throw here. 
            // User said: "Если ИИ вернул "Unknown", падать с ошибкой 400"
            if (e.message === 'AI could not identify bike name') {
                throw new Error('400: Bike DNA Identification Failed. Please contact support.');
            }
        }

        // Price Calculation - Single Source of Truth
        // Backend calculates everything based on the Bike Price and Delivery Method.
        const shippingMethod = delivery_method || 'Cargo';
        // Assume Insurance is included (true) as per standard flow, or could be passed in options if needed.
        const calc = priceCalculator.calculate(price, shippingMethod, true);

        const { data, error } = await supabase.supabase
            .from('orders')
            .insert({
                customer_id,
                lead_id,
                bike_id: String(bike_id),
                order_code,
                magic_link_token,
                status: status || 'awaiting_payment',
                bike_snapshot: {
                    ...bike_snapshot,
                    financials: {
                        total_price_rub: calc.total_price_rub,
                        booking_amount_rub: calc.booking_amount_rub,
                        ...calc.details
                    }
                }, 
                // Unpack snapshot fields for analytics/search
                bike_name: bikeName,
                bike_url: bike_url, // Sprint 2.1: Save to orders table
                listing_price_eur: price,
                initial_quality: initialQuality,
                
                // Financials (Calculated on Backend)
                final_price_eur: calc.details.final_price_eur,
                total_price_rub: calc.total_price_rub,
                booking_amount_rub: calc.booking_amount_rub,
                exchange_rate: calc.details.exchange_rate,
                delivery_method: calc.details.shipping_method,
                
                // Legacy / Compat
                booking_amount_eur: Math.round(calc.booking_amount_rub / calc.details.exchange_rate),
                
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    _generateMagicToken() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    _generateOrderCode() {
        return 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    }
}

module.exports = new BookingService();
