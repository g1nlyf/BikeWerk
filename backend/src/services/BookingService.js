const supabase = require('./supabase');
const managerBot = require('./ManagerBotService');
const orderDispatcher = require('./OrderDispatcher');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DatabaseManager } = require('../js/mysql-config');
const axios = require('axios');

const priceCalculator = require('./PriceCalculatorService');
const imageKitService = require('./ImageKitService');

class BookingService {
    constructor() {
        this.db = new DatabaseManager();
        this.jwtSecret = process.env.JWT_SECRET || null;
        this.maxSnapshotImagesToCache = Math.max(1, Number(process.env.BOOKING_IMAGE_CACHE_LIMIT || 2));
        this.maxSnapshotImageBytes = Math.max(512 * 1024, Number(process.env.BOOKING_IMAGE_MAX_BYTES || 8 * 1024 * 1024));
        this.snapshotImageTimeoutMs = Math.max(3000, Number(process.env.BOOKING_IMAGE_TIMEOUT_MS || 10000));
    }

    _useSupabase() {
        return Boolean(supabase && supabase.supabase);
    }

    _normalizeBikeSnapshot(bikeDetails = {}, bikeId = null, bikeUrl = null) {
        const source = (bikeDetails && typeof bikeDetails === 'object') ? { ...bikeDetails } : {};
        const rawImages = [];
        const rawCachedImages = [];
        const pushImage = (value) => {
            if (!value) return;
            if (Array.isArray(value)) {
                value.forEach(pushImage);
                return;
            }
            if (typeof value !== 'string') return;
            const trimmed = value.trim();
            if (trimmed) rawImages.push(trimmed);
        };
        const pushCachedImage = (value) => {
            if (!value) return;
            if (Array.isArray(value)) {
                value.forEach(pushCachedImage);
                return;
            }
            if (typeof value !== 'string') return;
            const trimmed = value.trim();
            if (trimmed) rawCachedImages.push(trimmed);
        };

        pushImage(source.main_photo_url);
        pushImage(source.main_image);
        pushImage(source.image_url);
        pushImage(source.image);
        pushImage(source.photo);
        pushImage(source.photos);
        pushImage(source.images);
        pushImage(source.gallery);
        pushImage(source.image_urls);
        pushCachedImage(source.cached_images);
        pushCachedImage(source.cachedImages);

        const images = Array.from(new Set(rawImages));
        const cachedImages = Array.from(new Set(rawCachedImages));
        const normalizedBikeUrl = source.bike_url || source.url || source.listing_url || bikeUrl || null;
        const titleFromBrandModel = [source.brand, source.model].filter(Boolean).join(' ').trim();
        const title = source.title || source.name || titleFromBrandModel || 'Bike';
        const price = Number(source.price ?? source.listing_price_eur ?? source.price_eur ?? source.final_price_eur ?? 0) || 0;

        return {
            ...source,
            bike_id: source.bike_id ?? (bikeId != null ? String(bikeId) : null),
            bike_url: normalizedBikeUrl,
            external_bike_ref: source.external_bike_ref || source.listing_id || source.external_id || normalizedBikeUrl || null,
            title,
            name: source.name || title,
            brand: source.brand || null,
            model: source.model || null,
            year: source.year || source.model_year || null,
            size: source.size || source.frame_size || source.frame || null,
            price,
            listing_price_eur: Number(source.listing_price_eur ?? source.price_eur ?? price) || price,
            main_photo_url: source.main_photo_url || source.main_image || source.image_url || source.image || images[0] || null,
            images,
            cached_images: cachedImages
        };
    }

    _safeSlug(value) {
        return String(value || 'order').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    }

    async _resolveLocalBikeId(rawBikeId) {
        if (rawBikeId == null || rawBikeId === '') return null;
        const numericBikeId = Number(rawBikeId);
        if (!Number.isFinite(numericBikeId) || numericBikeId <= 0) return null;
        try {
            const rows = await this.db.query('SELECT id FROM bikes WHERE id = ? LIMIT 1', [numericBikeId]);
            return rows && rows[0] ? numericBikeId : null;
        } catch {
            return null;
        }
    }

    _isSafeExternalImageUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return false;
        let parsed;
        try {
            parsed = new URL(rawUrl);
        } catch {
            return false;
        }
        if (parsed.protocol !== 'https:') return false;
        if (parsed.username || parsed.password) return false;
        if (parsed.port && parsed.port !== '443') return false;
        const hostname = String(parsed.hostname || '').toLowerCase();
        if (!hostname) return false;

        const privatePatterns = [
            /^localhost$/i,
            /^127\./,
            /^10\./,
            /^192\.168\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^0\./,
            /^169\.254\./,
            /^::1$/,
            /^fc00:/i,
            /^fd00:/i,
            /^\[::1\]$/,
            /\.local$/i,
            /\.internal$/i
        ];
        return !privatePatterns.some((pattern) => pattern.test(hostname));
    }

    _isImageKitUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return false;
        try {
            const host = new URL(rawUrl).hostname.toLowerCase();
            return host === 'ik.imagekit.io' || host.endsWith('.imagekit.io');
        } catch {
            return false;
        }
    }

    async _downloadSnapshotImage(imageUrl) {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: this.snapshotImageTimeoutMs,
            maxContentLength: this.maxSnapshotImageBytes,
            maxBodyLength: this.maxSnapshotImageBytes,
            headers: {
                'User-Agent': 'EUBikeBookingImageCache/1.0',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            },
            validateStatus: (statusCode) => statusCode >= 200 && statusCode < 400
        });
        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        if (!contentType.startsWith('image/')) {
            throw new Error('snapshot-image-not-an-image');
        }
        const extension = contentType.includes('png')
            ? 'png'
            : contentType.includes('webp')
                ? 'webp'
                : contentType.includes('gif')
                    ? 'gif'
                    : 'jpg';
        return { buffer: Buffer.from(response.data), extension };
    }

    async _cacheSnapshotImages(snapshot, orderCode) {
        if (!snapshot || typeof snapshot !== 'object') return [];

        const existingCached = Array.isArray(snapshot.cached_images)
            ? snapshot.cached_images
            : (typeof snapshot.cached_images === 'string' && snapshot.cached_images.trim() ? [snapshot.cached_images.trim()] : []);

        const validExisting = existingCached.filter((url) => typeof url === 'string' && url.trim()).map((url) => url.trim());
        if (validExisting.length >= this.maxSnapshotImagesToCache) {
            return Array.from(new Set(validExisting)).slice(0, this.maxSnapshotImagesToCache);
        }

        const rawCandidates = [];
        const pushCandidate = (value) => {
            if (!value) return;
            if (Array.isArray(value)) {
                value.forEach(pushCandidate);
                return;
            }
            if (typeof value !== 'string') return;
            const trimmed = value.trim();
            if (trimmed) rawCandidates.push(trimmed);
        };

        pushCandidate(snapshot.main_photo_url);
        pushCandidate(snapshot.main_image);
        pushCandidate(snapshot.image_url);
        pushCandidate(snapshot.image);
        pushCandidate(snapshot.images);
        pushCandidate(snapshot.photos);
        pushCandidate(snapshot.gallery);
        pushCandidate(snapshot.image_urls);

        const uniqueCandidates = Array.from(new Set(rawCandidates))
            .filter((url) => this._isSafeExternalImageUrl(url))
            .slice(0, this.maxSnapshotImagesToCache);

        const cached = [...validExisting];
        const folder = `/orders/${this._safeSlug(orderCode || snapshot.external_bike_ref || snapshot.bike_id || 'order')}`;
        let fileIndex = 0;

        for (const sourceUrl of uniqueCandidates) {
            if (cached.length >= this.maxSnapshotImagesToCache) break;
            if (cached.includes(sourceUrl)) continue;
            if (this._isImageKitUrl(sourceUrl)) {
                cached.push(sourceUrl);
                continue;
            }
            try {
                const { buffer, extension } = await this._downloadSnapshotImage(sourceUrl);
                fileIndex += 1;
                const uploaded = await imageKitService.uploadImage(buffer, `img-${fileIndex}.${extension}`, folder);
                if (uploaded?.url) {
                    cached.push(uploaded.url);
                }
            } catch (error) {
                console.warn('[BookingService] snapshot image cache failed:', error.message || error);
            }
        }

        return Array.from(new Set(cached)).slice(0, this.maxSnapshotImagesToCache);
    }

    /**
     * Handle a new booking request (free booking, optional reservation later)
     */
    async createBooking({ bike_id, customer, bike_details, total_price_rub, booking_amount_rub, exchange_rate, final_price_eur, delivery_method, addons = [], booking_form = {} }) {
        const normalizedBikeSnapshot = this._normalizeBikeSnapshot(bike_details, bike_id, bike_details?.bike_url || bike_details?.url || null);

        // Delivery method
        let shippingMethod = delivery_method || booking_form.delivery_option || null;

        if (!shippingMethod) {
            try {
                const gemini = require('./geminiProcessor');
                if (typeof gemini.parseBikeSnapshot === 'function') {
                    const parsed = await gemini.parseBikeSnapshot(normalizedBikeSnapshot);
                    shippingMethod = parsed?.shipping_option || null;
                }
            } catch (e) {
                console.error('Gemini parsing for shipping option failed:', e.message);
            }
        }

        if (!shippingMethod) {
            throw new Error('400: Delivery method is required. Please select shipping option.');
        }

        const contactMethod = customer.contact_method || booking_form.contact_method || (customer.email ? 'email' : (customer.phone ? 'phone' : (customer.telegram_id ? 'telegram' : 'other')));
        const contactValue = customer.contact_value || booking_form.contact_value || customer.email || customer.phone || customer.telegram_id || null;
        const city = booking_form.city || customer.city || null;

        // 1. Create/Update Customer in Supabase
        const customerPayload = { ...customer, name: customer.full_name || customer.name, contact_method: contactMethod, contact_value: contactValue, city };
        const customerData = await this._upsertCustomer(customerPayload);
        if (!customerData) throw new Error('Failed to create customer');

        // 2. Lead
        let bikeUrl = normalizedBikeSnapshot.bike_url || (bike_id ? `/bike/${bike_id}` : null);
        if (!bikeUrl || !bikeUrl.startsWith('http')) {
            try {
                const gemini = require('./geminiProcessor');
                const foundUrl = await gemini.findBikeUrl(normalizedBikeSnapshot);
                if (foundUrl && foundUrl.startsWith('http')) bikeUrl = foundUrl;
            } catch (e) {
                console.warn('Gemini URL extraction failed:', e.message);
            }
        }
        const bikeSnapshotWithUrl = this._normalizeBikeSnapshot(normalizedBikeSnapshot, bike_id, bikeUrl);
        const lead = await this._createLead(customerData.id, bike_id, bikeUrl, bikeSnapshotWithUrl);

        // 3. Order
        const magicToken = this._generateMagicToken();
        const orderCode = this._generateOrderCode();

        const order = await this._createOrder({
            customer_id: customerData.id,
            lead_id: lead.id,
            bike_id: bike_id,
            order_code: orderCode,
            magic_link_token: magicToken,
            bike_snapshot: bikeSnapshotWithUrl,
            status: 'pending_manager',
            total_price_rub,
            booking_amount_rub,
            exchange_rate,
            final_price_eur,
            delivery_method: shippingMethod,
            bike_url: bikeUrl,
            addons,
            booking_form: { ...booking_form, contact_method: contactMethod, contact_value: contactValue, city, delivery_option: shippingMethod }
        });

        // 4. Auto-dispatch + inspection
        let assignedManager = null;
        let aiTasks = [];
        try {
            const dispatchResult = await orderDispatcher.dispatchOrder(order, bikeSnapshotWithUrl);
            assignedManager = dispatchResult.manager;
            aiTasks = dispatchResult.tasks;
        } catch (e) {
            console.error('Auto-Dispatch failed:', e.message || e);
        }

        try {
            await managerBot.notifyNewOrder(order, bikeSnapshotWithUrl, customerData, { manager: assignedManager, tasks: aiTasks });

            // Background inspection + Supabase save only when Supabase is configured
            if (this._useSupabase()) {
                const gemini = require('./geminiProcessor');
                (async () => {
                    try {
                        const fallbackTitle = bikeSnapshotWithUrl.brand
                            ? `${bikeSnapshotWithUrl.brand} ${bikeSnapshotWithUrl.model || ''}`.trim()
                            : 'Bike';
                        const bikeData = {
                            title: bikeSnapshotWithUrl.title || fallbackTitle,
                            description: bikeSnapshotWithUrl.description || '',
                            attributes: bikeSnapshotWithUrl.attributes || {},
                            images: Array.isArray(bikeSnapshotWithUrl.images) ? bikeSnapshotWithUrl.images : [],
                            bike_snapshot: bikeSnapshotWithUrl
                        };

                        const inspectionResult = await gemini.performInitialInspection(bikeData);
                        if (inspectionResult?.error) {
                            console.error('[BookingService] Auto-Inspection Error for', order?.id || orderCode, inspectionResult.error);
                            return;
                        }

                        const { checklist, photos_status, german_inquiry_message } = inspectionResult;
                        const payload = {
                            order_id: order.id,
                            stage: 'inspection',
                            checklist,
                            photos_status,
                            next_action_suggestion: german_inquiry_message,
                            updated_at: new Date()
                        };

                        const { data: existingInsp } = await supabase.supabase
                            .from('inspections')
                            .select('id')
                            .eq('order_id', order.id)
                            .maybeSingle();

                        const { error: upsertError } = await supabase.supabase
                            .from('inspections')
                            .upsert(existingInsp ? { ...existingInsp, ...payload } : payload);

                        if (upsertError) {
                            console.error('[BookingService] Inspection DB Save Failed:', upsertError.message);
                        }
                    } catch (err) {
                        console.error('[BookingService] Background Inspection Critical Error:', err);
                    }
                })();
            }
        } catch (e) {
            console.error('Failed to notify manager bot:', e.message);
        }

        // 5. Auto account
        let userAuth = null;
        try {
            userAuth = await this._ensureLocalUser({
                name: customer.name || customer.full_name || 'Клиент',
                email: customer.email,
                phone: customer.phone || (contactMethod === 'phone' ? contactValue : null)
            });
        } catch (e) {
            console.error('Auto-user creation failed:', e.message || e);
        }

        return {
            success: true,
            magic_link_url: orderCode ? `/order-tracking/${orderCode}` : null,
            order_code: orderCode,
            status: 'accepted',
            auth: userAuth ? {
                token: userAuth.token,
                user: {
                    id: userAuth.id,
                    name: userAuth.name,
                    email: userAuth.email,
                    phone: userAuth.phone,
                    must_change_password: userAuth.must_change_password ?? 0,
                    must_set_email: userAuth.must_set_email ?? 0
                },
                temp_password: userAuth.temp_password
            } : null
        };
    }

    async _upsertCustomer(customer) {
        if (!this._useSupabase()) {
            return this._upsertCustomerLocal(customer);
        }
        // Try to find by email or phone
        let existing = null;
        try {
            if (customer.email) {
                const res = await supabase.supabase
                    .from('customers')
                    .select('id')
                    .eq('email', customer.email)
                    .maybeSingle();
                existing = res.data || null;
            }
            if (!existing && customer.phone) {
                const res = await supabase.supabase
                    .from('customers')
                    .select('id')
                    .eq('phone', customer.phone)
                    .maybeSingle();
                existing = res.data || null;
            }
        } catch (e) {
            console.warn('Customer lookup failed, proceeding to insert:', e.message);
        }

        const payload = {
            email: customer.email || null,
            full_name: customer.name,
            phone: customer.phone || null,
            preferred_channel: customer.contact_method || (customer.telegram_id ? 'telegram' : (customer.email ? 'email' : 'phone')),
            contact_value: customer.contact_value || customer.telegram_id || customer.email || customer.phone,
            city: customer.city || null
        };

        if (existing) {
            const { data, error } = await supabase.supabase
                .from('customers')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase.supabase
                .from('customers')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    }

    async _createLead(customerId, bikeId, bikeUrl, bikeSnapshot = null) {
        if (!this._useSupabase()) {
            return this._createLeadLocal(customerId, bikeId, bikeUrl);
        }
        const payload = {
            customer_id: customerId,
            source: 'website_booking',
            status: 'new',
            bike_url: bikeUrl || (bikeId ? `/bike/${bikeId}` : null)
        };
        if (bikeSnapshot) payload.bike_snapshot = bikeSnapshot;

        let insertResult = await supabase.supabase
            .from('leads')
            .insert(payload)
            .select()
            .single();

        if (insertResult.error && bikeSnapshot && String(insertResult.error.message || '').toLowerCase().includes('bike_snapshot')) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.bike_snapshot;
            insertResult = await supabase.supabase
                .from('leads')
                .insert(fallbackPayload)
                .select()
                .single();
        }

        if (insertResult.error) throw insertResult.error;
        return insertResult.data;
    }

    async _createOrder({ customer_id, lead_id, bike_id, order_code, magic_link_token, bike_snapshot, status, total_price_rub, booking_amount_rub, exchange_rate, final_price_eur, delivery_method, bike_url, addons, booking_form }) {
        if (!this._useSupabase()) {
            return this._createOrderLocal({ customer_id, lead_id, bike_id, order_code, magic_link_token, bike_snapshot, status, total_price_rub, booking_amount_rub, exchange_rate, final_price_eur, delivery_method, bike_url, addons, booking_form });
        }
        const normalizedSnapshot = this._normalizeBikeSnapshot(bike_snapshot, bike_id, bike_url);
        const cachedImages = await this._cacheSnapshotImages(normalizedSnapshot, order_code);
        const durableSnapshot = { ...normalizedSnapshot, cached_images: cachedImages };
        let price = Number(normalizedSnapshot.price || 0);
        let bikeName = normalizedSnapshot.title || (normalizedSnapshot.brand ? `${normalizedSnapshot.brand} ${normalizedSnapshot.model || ''}`.trim() : '');
        let initialQuality = normalizedSnapshot.condition || 'good';

        try {
            const gemini = require('./geminiProcessor');
            if (typeof gemini.parseBikeSnapshot === 'function') {
                const parsed = await gemini.parseBikeSnapshot(normalizedSnapshot);
                if (parsed?.bike_name && parsed.bike_name !== 'Unknown' && parsed.bike_name !== 'Unknown Bike') {
                    bikeName = parsed.bike_name;
                }
                if (price === 0 && parsed?.listing_price_eur) price = parsed.listing_price_eur;
                initialQuality = parsed?.initial_quality || initialQuality;
            }
        } catch (e) {
            console.error('Gemini Parsing Failed:', e.message);
        }

        const shippingMethod = delivery_method || 'Cargo';
        const calc = priceCalculator.calculate(price, shippingMethod, true);
        const totalRub = Number(total_price_rub) || calc.total_price_rub;
        const bookingRub = Number(booking_amount_rub) || Math.ceil(totalRub * 0.02);
        const fx = Number(exchange_rate) || calc.details.exchange_rate;
        const finalEur = Number(final_price_eur) || calc.details.final_price_eur;

        const financials = {
            total_price_rub: totalRub,
            booking_amount_rub: bookingRub,
            bike_price_eur: price,
            shipping_cost_eur: calc.details.shipping_cost_eur,
            payment_commission_eur: calc.details.payment_commission_eur,
            warehouse_fee_eur: calc.details.warehouse_fee_eur,
            service_fee_eur: calc.details.service_fee_eur,
            margin_total_eur: calc.details.margin_total_eur,
            exchange_rate: fx,
            shipping_method: shippingMethod,
            final_price_eur: finalEur
        };

        const bookingMeta = {
            booking_form: booking_form || null,
            addons: addons || [],
            financials
        };

        const { data, error } = await supabase.supabase
            .from('orders')
            .insert({
                customer_id,
                lead_id,
                bike_id: durableSnapshot.bike_id || null,
                order_code,
                magic_link_token,
                status: status || 'pending_manager',
                bike_snapshot: { ...durableSnapshot, financials, booking_meta: bookingMeta },
                bike_name: bikeName,
                bike_url: durableSnapshot.bike_url || bike_url || null,
                listing_price_eur: price,
                initial_quality: initialQuality,
                final_price_eur: finalEur,
                total_price_rub: totalRub,
                booking_amount_rub: bookingRub,
                exchange_rate: fx,
                delivery_method: shippingMethod,
                booking_amount_eur: Math.round(bookingRub / fx),
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async _upsertCustomerLocal(customer) {
        const email = customer.email ? String(customer.email).trim().toLowerCase() : null;
        const phone = customer.phone ? String(customer.phone).trim() : null;
        const preferred = customer.contact_method || (customer.telegram_id ? 'telegram' : (email ? 'email' : (phone ? 'phone' : 'other')));

        let existing = null;
        if (email) {
            const rows = await this.db.query('SELECT * FROM customers WHERE email = ? LIMIT 1', [email]);
            existing = rows[0];
        }
        if (!existing && phone) {
            const rows = await this.db.query('SELECT * FROM customers WHERE phone = ? LIMIT 1', [phone]);
            existing = rows[0];
        }

        const payload = {
            full_name: customer.name,
            email,
            phone,
            preferred_channel: preferred,
            city: customer.city || null
        };

        if (existing) {
            await this.db.query(
                'UPDATE customers SET full_name = ?, email = COALESCE(?, email), phone = COALESCE(?, phone), preferred_channel = ?, city = COALESCE(?, city) WHERE id = ?',
                [payload.full_name, payload.email, payload.phone, payload.preferred_channel, payload.city, existing.id]
            );
            return { ...existing, ...payload };
        }

        const id = uuidv4();
        await this.db.query(
            'INSERT INTO customers (id, full_name, phone, email, preferred_channel, city, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [id, payload.full_name, payload.phone, payload.email, payload.preferred_channel, payload.city]
        );
        return { id, ...payload };
    }

    async _createLeadLocal(customerId, bikeId, bikeUrl) {
        const id = uuidv4();
        await this.db.query(
            'INSERT INTO leads (id, source, customer_id, bike_url, status, contact_method, contact_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [
                id,
                'website_booking',
                customerId,
                bikeUrl || (bikeId ? `/bike/${bikeId}` : null),
                'new',
                'website',
                null
            ]
        );
        return { id, customer_id: customerId, bike_url: bikeUrl };
    }

    async _createOrderLocal({ customer_id, lead_id, bike_id, order_code, magic_link_token, bike_snapshot, status, total_price_rub, booking_amount_rub, exchange_rate, final_price_eur, delivery_method, bike_url, addons, booking_form }) {
        const normalizedSnapshot = this._normalizeBikeSnapshot(bike_snapshot, bike_id, bike_url);
        const cachedImages = await this._cacheSnapshotImages(normalizedSnapshot, order_code);
        const durableSnapshot = { ...normalizedSnapshot, cached_images: cachedImages };
        const localBikeId = await this._resolveLocalBikeId(durableSnapshot.bike_id || bike_id);
        let price = Number(normalizedSnapshot.price || 0);
        let bikeName = normalizedSnapshot.title || (normalizedSnapshot.brand ? `${normalizedSnapshot.brand} ${normalizedSnapshot.model || ''}`.trim() : '');

        try {
            const gemini = require('./geminiProcessor');
            if (typeof gemini.parseBikeSnapshot === 'function') {
                const parsed = await gemini.parseBikeSnapshot(normalizedSnapshot);
                if (parsed?.bike_name && parsed.bike_name !== 'Unknown' && parsed.bike_name !== 'Unknown Bike') {
                    bikeName = parsed.bike_name;
                }
                if (price === 0 && parsed?.listing_price_eur) price = parsed.listing_price_eur;
            }
        } catch (e) {
            console.error('Gemini Parsing Failed:', e.message);
        }

        const shippingMethod = delivery_method || 'Cargo';
        const calc = priceCalculator.calculate(price, shippingMethod, true);
        const totalRub = Number(total_price_rub) || calc.total_price_rub;
        const bookingRub = Number(booking_amount_rub) || Math.ceil(totalRub * 0.02);
        const fx = Number(exchange_rate) || calc.details.exchange_rate;
        const finalEur = Number(final_price_eur) || calc.details.final_price_eur;

        const financials = {
            total_price_rub: totalRub,
            booking_amount_rub: bookingRub,
            bike_price_eur: price,
            shipping_cost_eur: calc.details.shipping_cost_eur,
            payment_commission_eur: calc.details.payment_commission_eur,
            warehouse_fee_eur: calc.details.warehouse_fee_eur,
            service_fee_eur: calc.details.service_fee_eur,
            margin_total_eur: calc.details.margin_total_eur,
            exchange_rate: fx,
            shipping_method: shippingMethod,
            final_price_eur: finalEur
        };

        const bookingMeta = {
            booking_form: booking_form || null,
            addons: addons || [],
            financials,
            queue_hint: booking_form?.queue_hint || 'Вы #2 в очереди (заглушка)'
        };

        const snapshot = { ...durableSnapshot, financials, booking_meta: bookingMeta, magic_link_token };
        const id = uuidv4();

        await this.db.query(
            'INSERT INTO orders (id, order_code, customer_id, lead_id, bike_url, bike_snapshot, final_price_eur, commission_eur, status, assigned_manager, created_at, is_refundable, booking_price, bike_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)',
            [
                id,
                order_code,
                customer_id,
                lead_id,
                durableSnapshot.bike_url || bike_url || null,
                JSON.stringify(snapshot),
                finalEur,
                0,
                status || 'pending_manager',
                null,
                1,
                bookingRub,
                localBikeId
            ]
        );

        await this.db.query(
            'INSERT INTO order_status_events (id, order_id, old_status, new_status, changed_by, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [uuidv4(), id, null, status || 'pending_manager', 'system']
        );

        return {
            id,
            order_code,
            customer_id,
            lead_id,
            bike_url: normalizedSnapshot.bike_url || bike_url || null,
            bike_snapshot: snapshot,
            status: status || 'pending_manager'
        };
    }

    _generateMagicToken() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    _generateOrderCode() {
        return 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    }

    async _ensureLocalUser({ name, email, phone }) {
        if (!this.db) return null;
        const emailNorm = email ? String(email).trim().toLowerCase() : null;
        const phoneNorm = phone ? String(phone).trim() : null;

        let user = null;
        if (emailNorm) {
            const res = await this.db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [emailNorm]);
            user = res[0];
        }
        if (!user && phoneNorm) {
            const res = await this.db.query('SELECT * FROM users WHERE phone = ? LIMIT 1', [phoneNorm]);
            user = res[0];
        }

        const tempPassword = '12345678';
        const hashed = await bcrypt.hash(tempPassword, 10);

        if (!user) {
            const placeholderEmail = emailNorm || `${phoneNorm || 'user'}@placeholder.local`;
            const mustSetEmail = emailNorm ? 0 : 1;
            const result = await this.db.query('INSERT INTO users (name, email, phone, password, must_change_password, must_set_email, temp_password) VALUES (?, ?, ?, ?, 0, ?, ?)', [name || 'Клиент', placeholderEmail, phoneNorm, hashed, mustSetEmail, tempPassword]);
            user = { id: result.insertId, name, email: placeholderEmail, phone: phoneNorm, role: 'user', must_change_password: 0, must_set_email: mustSetEmail };
        } else {
            await this.db.query('UPDATE users SET password = ?, must_change_password = 0, temp_password = ?, phone = COALESCE(phone, ?) WHERE id = ?', [hashed, tempPassword, phoneNorm, user.id]);
            user.must_change_password = 0;
            user.must_set_email = user.must_set_email ?? (emailNorm ? 0 : 1);
        }

        if (this.jwtSecret) {
            user.token = jwt.sign({ id: user.id, email: user.email, role: user.role || 'user' }, this.jwtSecret, { expiresIn: '30d' });
        }
        user.temp_password = tempPassword;
        return user;
    }
}

module.exports = new BookingService();
