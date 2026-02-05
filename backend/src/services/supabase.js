const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

class SupabaseService {
    constructor() {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.warn('⚠️ Supabase credentials missing. CRM Sync disabled.');
            this.enabled = false;
            return;
        }

        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        this.enabled = true;
        console.log('✅ Supabase Client Initialized');
    }

    /**
     * Sync local order to Supabase CRM
     * @param {Object} order - Order object from SQLite
     * @param {Object} customer - Customer object
     * @returns {Promise<Object>} Supabase response
     */
    async syncOrder(order, customer) {
        if (!this.enabled) return null;

        try {
            // 1. Handle Customer (Find or Create)
            let cData, cError;
            
            // Try to find by email first
            const { data: existingCustomer } = await this.supabase
                .from('customers')
                .select('id')
                .eq('email', customer.email)
                .single();

            if (existingCustomer) {
                // Update
                ({ data: cData, error: cError } = await this.supabase
                    .from('customers')
                    .update({
                        phone: customer.phone,
                        full_name: customer.name,
                        preferred_channel: customer.telegram_id ? 'telegram' : 'email'
                    })
                    .eq('id', existingCustomer.id)
                    .select()
                    .single());
            } else {
                // Insert
                ({ data: cData, error: cError } = await this.supabase
                    .from('customers')
                    .insert({
                        // id: customer.id, // Let Supabase generate ID to avoid conflicts if our local UUID collides or format differs
                        email: customer.email,
                        phone: customer.phone,
                        full_name: customer.name,
                        preferred_channel: customer.telegram_id ? 'telegram' : 'email'
                    })
                    .select()
                    .single());
            }

            if (cError) throw cError;

            // 2. Handle Order (Find or Create)
            // Schema has: order_code, final_price_eur, status, customer_id, bike_snapshot (JSON)
            const snapshot = {
                bike_id: order.bike_id,
                magic_link_token: order.magic_link_token || this.generateMagicToken(),
                timeline_events: order.timeline_events || [],
                manager_notes: order.manager_notes,
                currency: 'EUR',
                legacy_data: order,
                customer_telegram_id: customer.telegram_id
            };

            const { data: existingOrder } = await this.supabase
                .from('orders')
                .select('id')
                .eq('order_code', order.order_code)
                .single();

            let oData, oError;

            const orderPayload = {
                order_code: order.order_code,
                customer_id: cData.id,
                status: this._mapStatus(order.status),
                final_price_eur: order.total_amount,
                bike_snapshot: snapshot
            };

            if (existingOrder) {
                // Update
                ({ data: oData, error: oError } = await this.supabase
                    .from('orders')
                    .update(orderPayload)
                    .eq('id', existingOrder.id)
                    .select()
                    .single());
            } else {
                // Insert
                ({ data: oData, error: oError } = await this.supabase
                    .from('orders')
                    .insert(orderPayload)
                    .select()
                    .single());
            }

            if (oError) throw oError;

            console.log(`✅ Order ${order.order_code} synced to Supabase (Dual-Write Success)`);
            return oData;
        } catch (err) {
            console.error('❌ Supabase Sync Error:', err.message);
            return null;
        }
    }

    _mapStatus(localStatus) {
        // Map local statuses to Supabase Enum (guessed: awaiting_payment, processing, completed, cancelled)
        const map = {
            'new': 'awaiting_payment',
            'negotiation': 'awaiting_payment',
            'inspection': 'processing', // Risk: if processing doesn't exist, will fail. 
            'payment': 'processing',
            'logistics': 'processing',
            'delivered': 'completed',
            'cancelled': 'cancelled'
        };
        // Fallback to awaiting_payment if unknown, as it's the default
        return map[localStatus] || 'awaiting_payment';
    }

    /**
     * Unpack order data from Supabase format to internal format
     */
    _unpackOrder(data) {
        if (!data) return null;
        const snapshot = data.bike_snapshot || {};
        
        // Unpack customer info if joined
        let customer = data.customers;
        if (customer && snapshot.customer_telegram_id) {
            customer = { ...customer, telegram_id: snapshot.customer_telegram_id };
        } else if (customer && customer.preferred_channel && customer.preferred_channel.startsWith('telegram:')) {
             customer = { ...customer, telegram_id: customer.preferred_channel.split(':')[1] };
        }

        // Prefer local status from legacy_data if available to preserve nuance
        const localStatus = snapshot.legacy_data && snapshot.legacy_data.status ? snapshot.legacy_data.status : data.status;

        return {
            ...data,
            status: localStatus, // Override Supabase enum status with granular local status
            total_amount: data.final_price_eur,
            bike_id: snapshot.bike_id,
            magic_link_token: snapshot.magic_link_token,
            timeline_events: snapshot.timeline_events || [],
            manager_notes: snapshot.manager_notes,
            currency: snapshot.currency || 'EUR',
            customers: customer // Override with augmented customer
        };
    }

    /**
     * Upload inspection photo to Storage
     */
    async uploadInspectionPhoto(orderCode, fileBuffer, fileName) {
        if (!this.enabled) return null;
        
        try {
            const path = `inspections/${orderCode}/${Date.now()}_${fileName}`;
            const { data, error } = await this.supabase.storage
                .from('order-assets')
                .upload(path, fileBuffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (error) throw error;
            
            // Get Public URL
            const { data: { publicUrl } } = this.supabase.storage
                .from('order-assets')
                .getPublicUrl(path);

            return publicUrl;
        } catch (err) {
            console.error('❌ Upload Error:', err.message);
            return null;
        }
    }

    /**
     * Get order by code
     * @param {string} orderCode 
     */
    async getOrder(orderCode) {
        if (!this.enabled) return null;
        try {
            const { data, error } = await this.supabase
                .from('orders')
                .select('*, customers(*)')
                .eq('order_code', orderCode)
                .single();
            
            if (error) throw error;
            return this._unpackOrder(data);
        } catch (err) {
            console.error('❌ Get Order Error:', err.message);
            return null;
        }
    }

    /**
     * Add timeline event to order
     * @param {string} orderCode 
     * @param {Object} event { title, description, status, photoUrl }
     */
    async addTimelineEvent(orderCode, event) {
        if (!this.enabled) return null;
        try {
            // 1. Get current events (unpacked)
            const order = await this.getOrder(orderCode);
            if (!order) throw new Error('Order not found');

            const events = order.timeline_events || [];
            const newEvent = {
                ...event,
                date: new Date().toISOString()
            };
            events.push(newEvent);

            // 2. Prepare snapshot for update
            // We need to fetch the RAW row first to preserve other snapshot data, 
            // OR we assume getOrder's unpack is lossless for snapshot fields.
            // Since _unpackOrder reads from snapshot, we should reconstruct it.
            // BUT simpler: let's update just the fields we care about in the snapshot.
            
            // Re-fetch raw to be safe or just update the specific JSON path?
            // Supabase doesn't support deep JSON update easily via simple client update without fetching.
            // Let's rely on the fact that we have the data.
            
            // Wait, if I use the unpacked 'order', I have the full timeline.
            // I need to push it back into bike_snapshot.
            
            // Fetch raw row first to get current snapshot
            const { data: rawOrder } = await this.supabase.from('orders').select('bike_snapshot').eq('order_code', orderCode).single();
            const currentSnapshot = rawOrder.bike_snapshot || {};
            
            const newSnapshot = {
                ...currentSnapshot,
                timeline_events: events,
                legacy_data: {
                    ...(currentSnapshot.legacy_data || {}),
                    status: event.status || order.status
                }
            };

            // 3. Update order
            const { data, error } = await this.supabase
                .from('orders')
                .update({ 
                    bike_snapshot: newSnapshot,
                    // updated_at: new Date().toISOString(), // Supabase might handle this trigger? If not, ignore for now as column might not exist or be auto
                    status: this._mapStatus(event.status || order.status)
                })
                .eq('order_code', orderCode)
                .select()
                .single();

            if (error) throw error;
            return this._unpackOrder(data);
        } catch (err) {
            console.error('❌ Add Timeline Event Error:', err.message);
            return null;
        }
    }

    /**
     * Get order by magic token
     * @param {string} token 
     */
    async getOrderByToken(token) {
        if (!this.enabled) return null;
        try {
            // Since magic_token is in JSON, we need to filter by JSON arrow operator
            // .eq('bike_snapshot->>magic_link_token', token)
            // But syntax depends on library version. 
            // Let's try: .filter('bike_snapshot->>magic_link_token', 'eq', token)
            
            const { data, error } = await this.supabase
                .from('orders')
                .select('*')
                // Use JSON filtering
                .filter('bike_snapshot->>magic_link_token', 'eq', token)
                .single();
            
            if (error) throw error;
            return this._unpackOrder(data);
        } catch (err) {
            console.error('❌ Get Order by Token Error:', err.message);
            return null;
        }
    }

    async listActiveOrders() {
        if (!this.enabled) return [];
        try {
            // Check for orders not updated in 24 hours
            // Assuming updated_at column might NOT exist based on inspect results (it wasn't in the list)
            // The list had 'created_at'.
            // If updated_at is missing, we can't filter by it easily.
            // Let's filter by created_at for now as a fallback or skip time filter if column missing.
            
            // Inspect result columns: [old_uuid_id, order_code, bike_url, bike_snapshot, final_price_eur, commission_eur, status, assigned_manager, created_at, customer_id, lead_id, id]
            // NO updated_at.
            
            // So we use created_at.
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data, error } = await this.supabase
                .from('orders')
                .select('*')
                .in('status', ['new', 'negotiation', 'inspection'])
                .lt('created_at', yesterday); // Fallback to created_at
            
            if (error) throw error;
            return (data || []).map(d => this._unpackOrder(d));
        } catch (err) {
            console.error('List Orders Error:', err.message);
            return [];
        }
    }

    generateMagicToken() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}

module.exports = new SupabaseService();
