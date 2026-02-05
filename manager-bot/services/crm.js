const { createClient } = require('@supabase/supabase-js');

class CRMService {
    constructor(url, key) {
        this.supabase = createClient(url, key);
    }

    async getOrder(orderId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
        
        if (isUuid) {
             // Try UUID
            const { data, error } = await this.supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();
            
            if (data) return data;
        }

        // Try Order Code (always safe if order_code is text)
        const { data, error } = await this.supabase
            .from('orders')
            .select('*')
            .eq('order_code', orderId)
            .single();
            
        return data;
    }

    async createInspection(orderId, data) {
        const { defects, grade, summary_ru, photos } = data;
        
        // Resolve order first to get the correct UUID if needed for foreign keys
        // Assuming inspections.order_id is TEXT (referencing order_code or human-readable ID)
        // If inspections.order_id is UUID, we MUST find the UUID of the order.
        
        const order = await this.getOrder(orderId);
        if (!order) throw new Error(`Order not found: ${orderId}`);

        // 1. Create Inspection Record
        const { data: inspection, error } = await this.supabase
            .from('inspections')
            .insert({
                order_id: order.id, // Use the actual ID from the DB record
                stage: 'remote', // Default to remote for bot
                defects_found: defects,
                ai_verdict: grade,
                manager_notes: summary_ru,
                photos: photos || []
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Update Order Quality
        const initialQuality = order.initial_quality || 'A';
        
        // Logic: A=3, B=2, C=1
        const map = { 'A': 3, 'B': 2, 'C': 1 };
        const isDegraded = (map[grade] || 0) < (map[initialQuality] || 0);

        await this.supabase
            .from('orders')
            .update({
                final_quality: grade,
                is_refundable: isDegraded
            })
            .eq('id', order.id); // Use valid ID from fetched order

        return { inspection, isDegraded };
    }

    async recordNegotiation(orderId, data) {
        const { final_price, summary_ru, seller_name, success } = data;

        const order = await this.getOrder(orderId);
        if (!order) throw new Error(`Order not found: ${orderId}`);

        // 1. Create Negotiation Record
        await this.supabase
            .from('negotiations')
            .insert({
                order_id: order.id,
                final_price: final_price,
                success: success,
                chat_transcript: summary_ru,
                seller_platform: seller_name
            });

        // 2. Update Order Price if successful
        if (success && final_price) {
            await this.supabase
                .from('orders')
                .update({
                    negotiated_price_eur: final_price,
                    status: 'payment' // Move to payment stage? Or keep in negotiation?
                })
                .eq('id', order.id);
        }
    }

    async updateOrderStatus(orderCode, status, meta = {}) {
        const updateData = { status: status };
        if (meta.manager) updateData.assigned_manager = meta.manager;
        if (meta.notes) updateData.manager_notes = meta.notes;

        const { data, error } = await this.supabase
            .from('orders')
            .update(updateData)
            .eq('order_code', orderCode)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async uploadPhoto(buffer, name) {
        const path = `bot_uploads/${Date.now()}_${name}.jpg`;
        const { data, error } = await this.supabase.storage
            .from('order-assets') // Assuming this bucket exists
            .upload(path, buffer, { contentType: 'image/jpeg' });
        
        if (error) return null;
        
        const { data: { publicUrl } } = this.supabase.storage
            .from('order-assets')
            .getPublicUrl(path);
            
        return publicUrl;
    }
}

module.exports = CRMService;
