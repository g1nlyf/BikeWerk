import { Router } from 'express'
import { createClient } from '@supabase/supabase-js';

const router = Router()
const crmApiMod = require('../../../../scripts/crm-api.js')
const crmApi = crmApiMod.initializeCRM()
const geminiClient = require('../../../services/geminiProcessor');
// const geminiClient = new GeminiProcessor(); // It's already instantiated in the export

// Initialize Supabase for complex queries
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- Applications ---

router.post('/applications', async (req, res) => {
  try {
    const { name, contact_method, contact_value, notes } = req.body || {}
    const payload = {
      source: 'website',
      customer_name: String(name || ''),
      contact_method: String(contact_method || ''),
      contact_value: String(contact_value || ''),
      application_notes: notes ? String(notes) : null
    }
    const result = await crmApi.createApplication(payload)
    const created = Array.isArray(result) ? result[0] : result
    const application_id = created?.application_id || payload['application_id'] || crmApi.generateUUID()
    let application_number = created?.application_number || created?.application?.application_number || null
    if (!application_number) {
      application_number = await crmApi.generateApplicationNumber()
    }
    const origin = `http://localhost:${process.env.PORT || 8081}`
    const tracking_url = `${origin}/api/v1/pages/order-tracking/${application_id}`
    res.json({ success: true, application_id, application_number, tracking_url })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'CRM error' })
  }
})

// --- Orders (Sprint 3: Tracking & Reporting) ---

// Search Orders
router.get('/orders/search', async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q) return res.json({ orders: [] });

        // Search by order_code or customer_name
        // Using Supabase ILIKE
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

        const { data, error } = await supabase
            .from('orders')
            .select('id, order_code, status, final_price_eur, bike_name')
            .or(`order_code.ilike.%${q}%,bike_name.ilike.%${q}%`)
            .limit(Number(limit) || 5);

        if (error) throw error;

        // Map to frontend format
        const orders = data.map((o: any) => ({
            order_id: o.id,
            order_number: o.order_code,
            status: o.status,
            total_amount: o.final_price_eur,
            bike_name: o.bike_name
        }));

        res.json({ orders });
    } catch (error: any) {
        console.error('Search Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Helper for fetching order by various means (ID, Code, Token)
async function fetchOrderDetails(identifier: string, type: 'id' | 'code' | 'token', supabase: any) {
    let query = supabase.from('orders').select('*, users(name)');
    
    if (type === 'id') {
        query = query.eq('id', identifier);
    } else if (type === 'code') {
        query = query.eq('order_code', identifier);
    } else if (type === 'token') {
        query = query.eq('magic_link_token', identifier);
    }

    const { data: orderData, error: orderError } = await query.single();
    
    if (orderError || !orderData) {
        return null;
    }

    const orderStringID = orderData.id;
    const orderUUID = orderData.old_uuid_id; // UUID or null

    const isUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const validUUID = (orderUUID && isUUID(orderUUID)) ? orderUUID : null;

    // Fetch Relations Parallelly
    // Note: Legacy tables (tasks, negotiations, shipments, payments) likely use UUID.
    // New tables (inspections) use String ID (ORD-...).
    // If legacy tables are migrated to Text FK, we can use StringID, but for now safe-guard against 500s.
    
    const [tasksRes, negRes, logRes, payRes, inspRes] = await Promise.all([
        validUUID ? supabase.from('tasks').select('*').eq('order_id', validUUID).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        validUUID ? supabase.from('negotiations').select('*').eq('order_id', validUUID).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        validUUID ? supabase.from('shipments').select('*').eq('order_id', validUUID) : Promise.resolve({ data: [] }),
        validUUID ? supabase.from('payments').select('*').eq('order_id', validUUID).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
        supabase.from('inspections').select('*').eq('order_id', orderStringID).order('created_at', { ascending: false }).limit(1)
    ]);

    const tasks = tasksRes.data || [];
    const negotiations = negRes.data || [];
    const logistics = logRes.data || [];
    const payments = payRes.data || [];
    const inspection = inspRes.data?.[0] || null;

    // Calculate Finances
    const finalPrice = Number(orderData.final_price_eur) || 0;
    const bookingAmount = Number(orderData.booking_amount_eur) || 0;
    const commission = Number(orderData.commission_eur) || Math.round(finalPrice * 0.1);
    
    const paidAmount = payments
        .filter((p: any) => ['completed', 'pending'].includes(p.status) && p.direction === 'incoming')
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    const finances = {
        total: finalPrice,
        commission: commission,
        deposit_expected: bookingAmount,
        paid: paidAmount,
        remainder: Math.max(0, finalPrice - paidAmount),
        currency: 'EUR',
        ledger: payments
    };

    return {
        order: {
            order_id: orderData.id,
            order_number: orderData.order_code,
            status: orderData.status,
            total_amount: orderData.final_price_eur,
            booking_amount: orderData.booking_amount_eur,
            commission: orderData.commission_eur,
            bike_name: orderData.bike_name,
            bike_snapshot: orderData.bike_snapshot,
            manager_notes: orderData.manager_notes,
            initial_quality: orderData.initial_quality,
            final_quality: orderData.final_quality,
            is_refundable: orderData.is_refundable,
            assigned_manager: orderData.users?.name || orderData.assigned_manager
        },
        history: [], 
        finances: finances,
        logistics: logistics,
        tasks: tasks,
        negotiations: negotiations,
        inspection: inspection,
        live_feed: generateLiveFeed(tasks, negotiations)
    };
}

// Track by Token
router.get('/orders/track/:token', async (req, res) => {
    try {
        const { token } = req.params;
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

        const result = await fetchOrderDetails(token, 'token', supabase);
        if (!result) return res.status(404).json({ error: 'Order not found or token invalid' });

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get Order Details (The "Truth Report" Endpoint)
router.get('/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
        const isNewID = /^ORD-\d{8}-\d{4}$/.test(orderId); // Support for new string IDs
        const type = (isUUID || isNewID) ? 'id' : 'code';

        const result = await fetchOrderDetails(orderId, type, supabase);
        if (!result) return res.status(404).json({ error: 'Order not found' });

        res.json(result);
    } catch (error: any) {
        console.error('Get Order Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Client asks a question (Creates task for manager & Notifies via Telegram)
router.post('/orders/:orderId/ask', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { question } = req.body;
        
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
        if (!question) return res.status(400).json({ error: 'Question required' });

        // Resolve Order UUID
        const { data: order } = await supabase.from('orders').select('id, old_uuid_id, assigned_manager, order_code, bike_name').eq('order_code', orderId).single();
        const uuid = order?.old_uuid_id || order?.id || orderId;

        // Create Task
        const { data: task, error } = await supabase.from('tasks').insert([{
            order_id: uuid,
            title: 'Client Inquiry',
            description: `Client asked: "${question}"`,
            priority: 'high',
            status: 'pending'
        }]).select().single();

        if (error) throw error;

        // --- Telegram Notification Logic ---
        try {
            const { ManagerBotService } = require('../../../services/ManagerBotService'); // Adjust path as needed, or use global
            // Or use axios if simpler
            const botToken = process.env.BOT_TOKEN || '8422123572:AAEOO0PoP3QOmkgmpa53USU_F24hJdSNA3g'; // Hardcoded fallback for now
            const axios = require('axios');

            // Find Manager TG ID
            let managerTgId = null;
            if (order.assigned_manager) {
                // Try to find in users
                const { data: user } = await supabase.from('users').select('telegram_id').eq('username', order.assigned_manager).single();
                if (user) managerTgId = user.telegram_id;
            }

            // Fallback to Admin/Group if no manager or manager has no TG
            const targetChatId = managerTgId || process.env.ADMIN_CHAT_ID || '183921355'; // Fallback to main admin

            const msg = `
📩 <b>ВОПРОС ОТ КЛИЕНТА</b>
Заказ: <b>${order.order_code}</b> (${order.bike_name})

❓ <i>"${question}"</i>

👉 <a href="https://t.me/EubikeManagerBot?start=view_tasks:${order.order_code}">Ответить через бота</a>
            `.trim();

            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: targetChatId,
                text: msg,
                parse_mode: 'HTML'
            });
            console.log(`[CRM] Notification sent to ${targetChatId}`);

        } catch (notifyError: any) {
            console.error('[CRM] Failed to notify manager:', notifyError.message);
            // Don't fail the request
        }

        res.json({ success: true, task });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update Delivery Method & Recalculate Prices
router.post('/orders/:orderId/delivery', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { method } = req.body;
        
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
        if (!method) return res.status(400).json({ error: 'Method required' });

        // 1. Resolve Order
        let orderIdToUse = orderId;
        const { data: order } = await supabase.from('orders')
            .select('id, order_code, bike_price_eur, exchange_rate, booking_amount_rub, final_price_eur, shipping_cost_eur, service_fee_eur, payment_commission_eur')
            .eq('order_code', orderId)
            .single();
            
        if (order) orderIdToUse = order.id;
        else return res.status(404).json({ error: 'Order not found' });

        // 2. Recalculate Logic (Mirroring Frontend)
        const bikePriceEur = Number(order.bike_price_eur) || (Number(order.final_price_eur) * 0.85); // Approx fallback
        const rate = Number(order.exchange_rate) || 105;
        
        const shippingRates: any = {
            'Cargo': 170,
            'EMS': 220,
            'Premium': 650
        };
        const newShippingCost = shippingRates[method] || 170;

        // Margin Logic
        let mAgent = 0;
        if (bikePriceEur < 1500) mAgent = 250;
        else if (bikePriceEur < 3500) mAgent = 400;
        else if (bikePriceEur < 6000) mAgent = 600;
        else mAgent = bikePriceEur * 0.10;

        const fTransfer = (bikePriceEur + newShippingCost) * 0.07;
        const fWarehouse = 80;
        const fService = Math.max(0, mAgent - fWarehouse);
        
        // Insurance (Assume false for now, or fetch from order if stored? defaulting false to match simple update)
        // Better: Keep existing insurance logic or assume standard included
        const insuranceCost = 0; // Assuming standard

        const newTotalEur = bikePriceEur + newShippingCost + insuranceCost + fTransfer + fWarehouse + fService;
        const newTotalRub = Math.ceil(newTotalEur * rate);

        // 3. Update DB
        const { error } = await supabase.from('orders')
            .update({ 
                delivery_method: method,
                shipping_cost_eur: newShippingCost,
                payment_commission_eur: Number(fTransfer.toFixed(2)),
                final_price_eur: Number(newTotalEur.toFixed(2)),
                total_price_rub: newTotalRub,
                // booking_amount_rub: DO NOT CHANGE
            })
            .eq('id', orderIdToUse);

        if (error) throw error;

        // 4. Notify Manager
        try {
            const botToken = process.env.BOT_TOKEN || '8422123572:AAEOO0PoP3QOmkgmpa53USU_F24hJdSNA3g';
            const axios = require('axios');
            const targetChatId = process.env.ADMIN_CHAT_ID || '183921355'; // Admin fallback

            const msg = `
🚚 <b>СМЕНА ДОСТАВКИ</b>
Заказ: <b>${order.order_code}</b>
Новый метод: <b>${method}</b>
Новая цена: <b>${newTotalEur.toFixed(0)}€</b> (${newTotalRub.toLocaleString()}₽)
            `.trim();

            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: targetChatId,
                text: msg,
                parse_mode: 'HTML'
            });
        } catch (e) { console.error('Notify Error:', e); }

        res.json({ success: true, method, newTotalEur, newTotalRub });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Generate Digital Report (Sprint 3)
router.post('/orders/:orderId/report', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

        // Resolve Order UUID
        const { data: order } = await supabase.from('orders').select('id, old_uuid_id, order_code, bike_name, status, manager_notes, final_quality').eq('order_code', orderId).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        
        const uuid = order.old_uuid_id || order.id || orderId;

        // Fetch Context
        const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', uuid);
        const { data: negotiations } = await supabase.from('negotiations').select('*').eq('order_id', order.id); // Try Readable ID for chats based on script findings

        // Generate Report
        const report = await gemini.generateDigitalReport(order, tasks || [], negotiations || []);
        
        res.json({ success: true, report });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Checkout / Create Planned Payment (Sprint 4)
router.post('/orders/:orderId/checkout', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { amount, method } = req.body; // method: 'card', 'bank_transfer', etc.

        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

        // Resolve Order
        const { data: order } = await supabase.from('orders').select('id, old_uuid_id, final_price_eur, booking_amount_eur').eq('order_code', orderId).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        
        const uuid = order.old_uuid_id || order.id; // Use UUID for foreign keys usually, but let's check table definition. payments.order_id is uuid.

        // Calculate Amount if not provided (Remainder)
        // If booking_amount_eur is null, remainder = final_price_eur
        const total = Number(order.final_price_eur) || 0;
        const paid = Number(order.booking_amount_eur) || 0; // Assuming booking amount is already paid deposit
        
        // Check existing payments to be precise
        const { data: existingPayments } = await supabase.from('payments').select('amount').eq('order_id', uuid).eq('direction', 'incoming').in('status', ['completed', 'pending']);
        const actuallyPaid = (existingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        
        // Use actuallyPaid if greater than bookingAmount (which might be static), otherwise bookingAmount
        const effectivePaid = Math.max(paid, actuallyPaid);
        const remainder = Math.max(0, total - effectivePaid);

        const paymentAmount = amount ? Number(amount) : remainder;

        if (paymentAmount <= 0) {
            return res.status(400).json({ error: 'Order is already fully paid' });
        }

        // Create Planned Payment
        // Map legacy/frontend methods to valid enum values (online_cashbox, etc)
        let safeMethod = method || 'online_cashbox';
        if (['card', 'stripe', 'cash'].includes(safeMethod)) safeMethod = 'online_cashbox';

        const { data: payment, error } = await supabase.from('payments').insert({
            order_id: uuid,
            direction: 'incoming',
            role: 'client_payment',
            method: safeMethod,
            amount: paymentAmount,
            currency: 'EUR',
            status: 'planned',
            external_reference: `PAY-${Date.now()}` // Mock ref
        }).select().single();

        if (error) throw error;

        // Mock Payment Link
        const paymentUrl = `https://checkout.bike-eu.com/pay/${payment.id}`;

        res.json({ 
            success: true, 
            payment_id: payment.id, 
            amount: paymentAmount, 
            currency: 'EUR',
            payment_url: paymentUrl // In real life, this comes from Stripe/Provider
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Confirm Payment (Sprint 4 - Simulation)
router.post('/payments/:paymentId/confirm', async (req, res) => {
    try {
        const { paymentId } = req.params;
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

        // Update Payment
        const { data: payment, error } = await supabase.from('payments')
            .update({ status: 'completed' })
            .eq('id', paymentId)
            .select()
            .single();

        if (error || !payment) throw error || new Error('Payment not found');

        // Check Order Balance
        const orderId = payment.order_id;
        // Try matching ID or Old UUID
        let { data: order } = await supabase.from('orders').select('id, final_price_eur').eq('id', orderId).single();
        if (!order) {
             const { data: order2 } = await supabase.from('orders').select('id, final_price_eur').eq('old_uuid_id', orderId).single();
             order = order2;
        }
        
        if (order) {
            // Recalculate total paid
            const { data: allPayments } = await supabase.from('payments')
                .select('amount')
                .eq('order_id', orderId) // Payments use the UUID link
                .eq('direction', 'incoming')
                .eq('status', 'completed');
            
            const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
            
            console.log(`[ConfirmPayment] Order: ${order.id}, TotalPaid: ${totalPaid}, FinalPrice: ${order.final_price_eur}`);

            // Update Order Status if Fully Paid
            if (totalPaid >= (Number(order.final_price_eur) || 0)) {
                console.log(`[ConfirmPayment] Marking order as closed (fully_paid is invalid enum)`);
                const { error: updateError } = await supabase.from('orders')
                    .update({ status: 'closed' }) // Using valid enum value
                    .eq('id', order.id); // Use the ACTUAL order ID (which might be text)
                if (updateError) console.error('[ConfirmPayment] Update Error:', updateError);

                // Sprint 5: Auto-create Shipment
                console.log(`[ConfirmPayment] Auto-creating shipment for order ${order.id}`);
                
                // Fetch Bike Snapshot for Gemini
                const { data: orderFull } = await supabase.from('orders').select('bike_name, bike_snapshot').eq('id', order.id).single();
                const bikeName = orderFull?.bike_name || 'Bike';
                const snapshot = orderFull?.bike_snapshot || {};
                
                // Generate Customs Description
                let customsDesc = 'Used Bicycle';
                try {
                    customsDesc = await geminiClient.generateCustomsDescription(bikeName, snapshot);
                    console.log(`[Gemini] Customs Description: ${customsDesc}`);
                } catch (e: any) {
                    console.error('[Gemini] Failed to generate description:', e.message);
                }

                // Create Shipment
                const { error: shipError } = await supabase.from('shipments').insert({
                    order_id: order.id, // Using readable ID as FK
                    provider: 'rusbid',
                    estimated_delivery_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // +14 days default
                    ruspost_status: { 
                        customs_declaration: customsDesc,
                        status: 'created'
                    }
                });
                
                if (shipError) console.error('[ConfirmPayment] Shipment Creation Error:', shipError);
                else console.log('[ConfirmPayment] Shipment created successfully');
            }
        }

        res.json({ success: true, payment });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- Logistics (Sprint 5) ---

// Update Shipment (Tracking, Warehouse)
router.post('/shipments/:shipmentId/update', async (req, res) => {
    try {
        const { shipmentId } = req.params;
        const { tracking_number, warehouse_received, warehouse_photos_received } = req.body;
        
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

        const updates: any = {};
        if (tracking_number !== undefined) updates.tracking_number = tracking_number;
        if (warehouse_received !== undefined) updates.warehouse_received = warehouse_received;
        if (warehouse_photos_received !== undefined) updates.warehouse_photos_received = warehouse_photos_received;

        // If warehouse photos received, maybe update status?
        // Logic: if photos received, notify client (mock notification via console for now)
        if (warehouse_photos_received) {
             console.log(`[Logistics] Warehouse photos received for shipment ${shipmentId}. Notify client.`);
        }

        const { data, error } = await supabase.from('shipments')
            .update(updates)
            .eq('id', shipmentId)
            .select()
            .single();

        if (error) throw error;
        
        res.json({ success: true, shipment: data });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Helper to merge tasks and negotiations into a chronological feed
function generateLiveFeed(tasks: any[], negotiations: any[]) {
    const feed = [];

    // Add Tasks
    tasks.forEach(t => {
        feed.push({
            type: 'task',
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            date: t.created_at,
            is_ai: t.ai_generated
        });
    });

    // Add Negotiations (Chats)
    negotiations.forEach(n => {
        feed.push({
            type: 'negotiation',
            id: n.id,
            transcript: n.chat_transcript,
            summary: n.ocr_metadata?.summary || 'Chat update',
            date: n.created_at
        });
    });

    // Sort by date descending
    return feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// --- Final Closure & Feedback (Sprint 6) ---

// Confirm Receipt
router.post('/orders/:orderId/confirm-receipt', async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

        // Resolve Order
        console.log(`[CRM] Confirm Receipt for orderId: '${orderId}'`);
        
        let order;
        const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(orderId);
        
        if (isUUID) {
             const { data } = await supabase.from('orders').select('id, status, customer_id, final_price_eur, order_code').eq('id', orderId).single();
             order = data;
             if (!order) {
                 const { data: d2 } = await supabase.from('orders').select('id, status, customer_id, final_price_eur, order_code').eq('old_uuid_id', orderId).single();
                 order = d2;
             }
        } else {
             // Try ID (Readable)
             const { data: d1 } = await supabase.from('orders').select('id, status, customer_id, final_price_eur, order_code').eq('id', orderId).single();
             if (d1) {
                 order = d1;
                 console.log(`[CRM] Found order by ID: ${order.id}`);
             } else {
                 // Try Order Code
                 const { data: d2 } = await supabase.from('orders').select('id, status, customer_id, final_price_eur, order_code').eq('order_code', orderId).single();
                 order = d2;
                 if (order) console.log(`[CRM] Found order by Code: ${order.order_code}`);
             }
        }

        if (!order) {
            console.log(`[CRM] Order not found for ${orderId}`);
            return res.status(404).json({ error: 'Order not found' });
        }

        // 1. Update Shipment
        await supabase.from('shipments')
            .update({ client_received: true })
            .eq('order_id', order.id);

        // 2. Update Order Status
        const { data: updatedOrder, error: updateError } = await supabase.from('orders')
            .update({ status: 'delivered' })
            .eq('id', order.id)
            .select()
            .single();

        if (updateError) throw updateError;

        // 3. Audit Log
        try {
            await supabase.from('audit_log').insert({
                action: 'order_delivered',
                entity: 'orders',
                entity_id: order.id,
                payload: {
                    message: 'Client confirmed receipt',
                    final_price: order.final_price_eur,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (auditError) {
            console.warn('[CRM] Failed to create audit log:', auditError);
        }

        // 4. Close Tasks
        try {
            await supabase.from('tasks')
                .update({ status: 'completed' })
                .eq('order_id', order.id)
                .neq('status', 'completed');
        } catch (taskError) {
            console.warn('[CRM] Failed to close tasks:', taskError);
        }

        // 5. Notify Manager (Final Review Task)
        try {
             await supabase.from('tasks').insert({
                order_id: order.id,
                title: 'Final Review: Order Delivered',
                description: `Order ${order.order_code || order.id} has been confirmed as received by client. Please perform final closure review.`,
                priority: 'high',
                status: 'pending'
            });
        } catch (notifyError) {
            console.warn('[CRM] Failed to notify manager:', notifyError);
        }

        res.json({ success: true, order: updatedOrder });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Feedback & Review
router.post('/orders/:orderId/feedback', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { rating, comment } = req.body;
        
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

        // Resolve Order
        let order;
        const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(orderId);
        
        if (isUUID) {
             const { data } = await supabase.from('orders').select('id, customer_id').eq('id', orderId).single();
             order = data;
             if (!order) {
                 const { data: d2 } = await supabase.from('orders').select('id, customer_id').eq('old_uuid_id', orderId).single();
                 order = d2;
             }
        } else {
             // Try ID (Readable)
             const { data: d1 } = await supabase.from('orders').select('id, customer_id').eq('id', orderId).single();
             if (d1) {
                 order = d1;
             } else {
                 // Try Order Code
                 const { data: d2 } = await supabase.from('orders').select('id, customer_id').eq('order_code', orderId).single();
                 order = d2;
             }
        }

        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Analyze Sentiment
        const sentiment = await geminiClient.analyzeSentiment(comment || '');
        
        // Save Review
        const { data: review, error: reviewError } = await supabase.from('reviews').insert({
            order_id: order.id,
            customer_id: order.customer_id,
            rating: Number(rating),
            comment: comment,
            sentiment_score: sentiment.score,
            sentiment_label: sentiment.label
        }).select().single();

        if (reviewError) throw reviewError;

        // Generate Coupon if positive
        let coupon = null;
        if (sentiment.score > 0.5 || rating >= 5) {
            const code = `BONUS-${Date.now().toString().slice(-6)}`;
            const { data: newCoupon } = await supabase.from('coupons').insert({
                code: code,
                discount_amount: 50.00,
                customer_id: order.customer_id,
                expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
            }).select().single();
            coupon = newCoupon;
        }

        res.json({ success: true, review, coupon });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router
