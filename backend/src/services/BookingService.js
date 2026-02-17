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
const {
    ORDER_STATUS,
    TERMINAL_ORDER_STATUSES,
    normalizeOrderStatus
} = require('../domain/orderLifecycle');

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

    _isPreferredChannelEnumError(error) {
        const text = String(error?.message || error || '').toLowerCase();
        return text.includes('preferred_channel_enum') || text.includes('preferred_channel');
    }

    _normalizePreferredChannel(raw, fallback = 'whatsapp') {
        const value = String(raw || '').trim().toLowerCase();
        if (!value) return fallback;
        if (value === 'email') return 'email';
        if (value === 'telegram' || value.startsWith('telegram:')) return 'telegram';
        if (value === 'phone' || value === 'call' || value === 'whatsapp' || value === 'sms') return 'whatsapp';
        return fallback;
    }

    _extractBikePriceEur(snapshot = null) {
        const src = (snapshot && typeof snapshot === 'object') ? snapshot : {};
        const value = Number(
            src.price ??
            src.listing_price_eur ??
            src.price_eur ??
            src.final_price_eur ??
            src?.financials?.bike_price_eur ??
            0
        );
        if (!Number.isFinite(value) || value <= 0) return null;
        return value;
    }

    _assertBikePriceWithinCompliance(snapshot = null) {
        const bikePriceEur = this._extractBikePriceEur(snapshot);
        if (!bikePriceEur) return;
        if (bikePriceEur < 500) {
            throw new Error('400: Bike price below EUR 500 minimum policy');
        }
        if (bikePriceEur > 5000) {
            throw new Error('400: Bike price exceeds EUR 5,000 compliance limit');
        }
    }
    _isTerminalOrderStatus(status) {
        const normalized = normalizeOrderStatus(status);
        return Boolean(normalized && TERMINAL_ORDER_STATUSES.includes(normalized));
    }
    _isFreeBookingStatus(status) {
        const normalized = normalizeOrderStatus(status);
        if (!normalized) return false;
        return [
            ORDER_STATUS.BOOKED,
            ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
            ORDER_STATUS.CHECK_READY,
            ORDER_STATUS.AWAITING_CLIENT_DECISION,
            ORDER_STATUS.FULL_PAYMENT_PENDING
        ].includes(normalized);
    }
    async _assertFreeBookingQuota(customerId) {
        const customerKey = String(customerId || '').trim();
        if (!customerKey) return;
        try {
            const rows = await this.db.query('SELECT id, status FROM orders WHERE customer_id = ?', [customerKey]);
            const activeFreeBookings = (rows || []).filter((order) => {
                if (this._isTerminalOrderStatus(order.status)) return false;
                return this._isFreeBookingStatus(order.status);
            });
            if (activeFreeBookings.length >= 3) {
                throw new Error('400: Free booking limit reached (max 3 active bookings)');
            }
            return;
        } catch (localError) {
            if (!this._useSupabase()) throw localError;
            const { data, error } = await supabase.supabase
                .from('orders')
                .select('id,status')
                .eq('customer_id', customerKey);
            if (error) throw error;
            const activeFreeBookings = (data || []).filter((order) => {
                if (this._isTerminalOrderStatus(order.status)) return false;
                return this._isFreeBookingStatus(order.status);
            });
            if (activeFreeBookings.length >= 3) {
                throw new Error('400: Free booking limit reached (max 3 active bookings)');
            }
        }
    }
    _isMissingCustomersCityError(error) {
        const text = String(error?.message || error || '').toLowerCase();
        if (!text) return false;
        return (
            text.includes("could not find the 'city' column") ||
            text.includes('column customers_1.city does not exist') ||
            text.includes('column customers.city does not exist')
        );
    }

    async _enqueueSyncOutbox(entityType, entityId, operation, payload, errorMessage = null) {
        if (!this.db || typeof this.db.query !== 'function') return;
        try {
            await this.db.query(
                `INSERT INTO crm_sync_outbox (id, entity_type, entity_id, operation, payload, status, retry_count, last_error, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    uuidv4(),
                    entityType,
                    String(entityId || ''),
                    operation,
                    payload ? JSON.stringify(payload) : null,
                    errorMessage ? String(errorMessage) : null
                ]
            );
        } catch (error) {
            console.warn('[BookingService] Failed to enqueue CRM sync outbox:', error.message || error);
        }
    }

    async _mirrorBookingToSupabase({ customer, lead, order, bikeSnapshot, bikeUrl, shippingMethod }) {
        if (!this._useSupabase()) return;
        const sb = supabase?.supabase;
        if (!sb) return;

        const customerPayload = {
            id: customer.id,
            email: customer.email || null,
            full_name: customer.full_name || customer.name || null,
            phone: customer.phone || null,
            preferred_channel: this._normalizePreferredChannel(customer.preferred_channel || customer.contact_method || null),
            contact_value: customer.contact_value || customer.phone || customer.email || null,
            city: customer.city || null,
            updated_at: new Date().toISOString()
        };

        try {
            let upsertRes = await sb
                .from('customers')
                .upsert(customerPayload, { onConflict: 'id' })
                .select()
                .single();
            if (upsertRes.error && this._isMissingCustomersCityError(upsertRes.error)) {
                const payloadNoCity = { ...customerPayload };
                delete payloadNoCity.city;
                upsertRes = await sb
                    .from('customers')
                    .upsert(payloadNoCity, { onConflict: 'id' })
                    .select()
                    .single();
            }
            if (upsertRes.error && this._isPreferredChannelEnumError(upsertRes.error)) {
                const fallbackPayload = { ...customerPayload, preferred_channel: 'telegram' };
                upsertRes = await sb
                    .from('customers')
                    .upsert(fallbackPayload, { onConflict: 'id' })
                    .select()
                    .single();
            }
            if (upsertRes.error) throw upsertRes.error;
        } catch (error) {
            await this._enqueueSyncOutbox('customers', customer.id, 'upsert', customerPayload, error.message || error);
        }

        const leadPayload = {
            id: lead.id,
            source: lead.source || 'website_booking',
            customer_id: customer.id,
            bike_url: bikeUrl || lead.bike_url || null,
            bike_snapshot: bikeSnapshot || null,
            status: lead.status || 'new',
            contact_method: lead.contact_method || null,
            contact_value: lead.contact_value || null,
            updated_at: new Date().toISOString()
        };

        try {
            let upsertLeadRes = await sb
                .from('leads')
                .upsert(leadPayload, { onConflict: 'id' })
                .select()
                .single();
            if (upsertLeadRes.error && String(upsertLeadRes.error.message || '').toLowerCase().includes('bike_snapshot')) {
                const fallbackLeadPayload = { ...leadPayload };
                delete fallbackLeadPayload.bike_snapshot;
                upsertLeadRes = await sb
                    .from('leads')
                    .upsert(fallbackLeadPayload, { onConflict: 'id' })
                    .select()
                    .single();
            }
            if (upsertLeadRes.error) throw upsertLeadRes.error;
        } catch (error) {
            await this._enqueueSyncOutbox('leads', lead.id, 'upsert', leadPayload, error.message || error);
        }

        const normalizedSnapshot = this._normalizeBikeSnapshot(bikeSnapshot, order.bike_id, bikeUrl);
        const financials = normalizedSnapshot?.financials || normalizedSnapshot?.booking_meta?.financials || {};
        const exchangeRate = Number(order.exchange_rate || financials.exchange_rate || 96) || 96;
        const bookingAmountRub = Number(order.booking_amount_rub || order.booking_price || financials.booking_amount_rub || 0) || 0;

        const orderPayload = {
            id: order.id,
            customer_id: customer.id,
            lead_id: lead.id,
            bike_id: order.bike_id || normalizedSnapshot.bike_id || null,
            order_code: order.order_code,
            status: normalizeOrderStatus(order.status) || ORDER_STATUS.BOOKED,
            bike_snapshot: normalizedSnapshot,
            bike_name: order.bike_name || normalizedSnapshot.title || null,
            bike_url: bikeUrl || order.bike_url || normalizedSnapshot.bike_url || null,
            listing_price_eur: Number(order.listing_price_eur || normalizedSnapshot.listing_price_eur || normalizedSnapshot.price || 0) || null,
            initial_quality: order.initial_quality || normalizedSnapshot.condition || null,
            final_price_eur: Number(order.final_price_eur || financials.final_price_eur || 0) || null,
            total_price_rub: Number(order.total_price_rub || financials.total_price_rub || 0) || null,
            booking_amount_rub: bookingAmountRub || null,
            booking_amount_eur: bookingAmountRub ? Math.round(bookingAmountRub / exchangeRate) : null,
            exchange_rate: exchangeRate,
            delivery_method: shippingMethod || order.delivery_method || null,
            updated_at: new Date().toISOString()
        };

        try {
            const upsertOrderRes = await sb
                .from('orders')
                .upsert(orderPayload, { onConflict: 'id' })
                .select()
                .single();
            if (upsertOrderRes.error) throw upsertOrderRes.error;

            try {
                await sb.from('order_status_events').insert({
                    id: uuidv4(),
                    order_id: order.id,
                    old_status: null,
                    new_status: orderPayload.status,
                    changed_by: 'system_local_first',
                    created_at: order.created_at || new Date().toISOString()
                });
            } catch (eventError) {
                console.warn('[BookingService] order_status_events mirror warning:', eventError.message || eventError);
            }
        } catch (error) {
            await this._enqueueSyncOutbox('orders', order.id, 'upsert', orderPayload, error.message || error);
        }
    }

    async _mirrorCustomerToLocal(customer = {}) {
        if (!this.db || typeof this.db.query !== 'function') return;
        const customerId = customer.id ? String(customer.id) : null;
        if (!customerId) return;

        try {
            await this.db.query(
                `INSERT INTO customers (id, full_name, phone, email, preferred_channel, country, city, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
                 ON CONFLICT(id) DO UPDATE SET
                    full_name = excluded.full_name,
                    phone = COALESCE(excluded.phone, customers.phone),
                    email = COALESCE(excluded.email, customers.email),
                    preferred_channel = COALESCE(excluded.preferred_channel, customers.preferred_channel),
                    country = COALESCE(excluded.country, customers.country),
                    city = COALESCE(excluded.city, customers.city)`,
                [
                    customerId,
                    customer.full_name || null,
                    customer.phone || null,
                    customer.email || null,
                    this._normalizePreferredChannel(customer.preferred_channel || null, null),
                    customer.country || null,
                    customer.city || null,
                    customer.created_at || null
                ]
            );
        } catch (error) {
            console.warn('[BookingService] Local customer mirror failed:', error.message || error);
        }
    }

    async _mirrorLeadToLocal(lead = {}, fallback = {}) {
        if (!this.db || typeof this.db.query !== 'function') return;
        const leadId = lead.id ? String(lead.id) : null;
        if (!leadId) return;

        try {
            await this.db.query(
                `INSERT INTO leads (id, source, customer_id, bike_url, bike_snapshot, status, created_at, contact_method, contact_value)
                 VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    source = excluded.source,
                    customer_id = excluded.customer_id,
                    bike_url = COALESCE(excluded.bike_url, leads.bike_url),
                    bike_snapshot = COALESCE(excluded.bike_snapshot, leads.bike_snapshot),
                    status = COALESCE(excluded.status, leads.status),
                    contact_method = COALESCE(excluded.contact_method, leads.contact_method),
                    contact_value = COALESCE(excluded.contact_value, leads.contact_value)`,
                [
                    leadId,
                    lead.source || fallback.source || 'website_booking',
                    lead.customer_id || fallback.customer_id || null,
                    lead.bike_url || fallback.bike_url || null,
                    (lead.bike_snapshot || fallback.bike_snapshot) ? JSON.stringify(lead.bike_snapshot || fallback.bike_snapshot) : null,
                    lead.status || fallback.status || 'new',
                    lead.created_at || null,
                    fallback.contact_method || null,
                    fallback.contact_value || null
                ]
            );
        } catch (error) {
            console.warn('[BookingService] Local lead mirror failed:', error.message || error);
        }
    }

    async _mirrorOrderToLocal(order = {}, fallback = {}) {
        if (!this.db || typeof this.db.query !== 'function') return;
        const orderId = order.id ? String(order.id) : null;
        if (!orderId) return;

        try {
            const localBikeId = await this._resolveLocalBikeId(
                order.bike_id ??
                fallback.bike_id ??
                fallback?.bike_snapshot?.bike_id
            );
            const snapshot = order.bike_snapshot || fallback.bike_snapshot || null;
            const normalizedStatus = normalizeOrderStatus(order.status || fallback.status) || ORDER_STATUS.BOOKED;

            await this.db.query(
                `INSERT INTO orders (id, order_code, customer_id, lead_id, bike_url, bike_snapshot, final_price_eur, commission_eur, status, assigned_manager, created_at, is_refundable, booking_price, bike_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    order_code = excluded.order_code,
                    customer_id = excluded.customer_id,
                    lead_id = excluded.lead_id,
                    bike_url = COALESCE(excluded.bike_url, orders.bike_url),
                    bike_snapshot = COALESCE(excluded.bike_snapshot, orders.bike_snapshot),
                    final_price_eur = COALESCE(excluded.final_price_eur, orders.final_price_eur),
                    commission_eur = COALESCE(excluded.commission_eur, orders.commission_eur),
                    status = COALESCE(excluded.status, orders.status),
                    assigned_manager = COALESCE(excluded.assigned_manager, orders.assigned_manager),
                    is_refundable = COALESCE(excluded.is_refundable, orders.is_refundable),
                    booking_price = COALESCE(excluded.booking_price, orders.booking_price),
                    bike_id = COALESCE(excluded.bike_id, orders.bike_id)`,
                [
                    orderId,
                    order.order_code || fallback.order_code || null,
                    order.customer_id || fallback.customer_id || null,
                    order.lead_id || fallback.lead_id || null,
                    order.bike_url || fallback.bike_url || null,
                    snapshot ? JSON.stringify(snapshot) : null,
                    Number(order.final_price_eur || fallback.final_price_eur || 0) || null,
                    Number(order.commission_eur || fallback.commission_eur || 0) || 0,
                    normalizedStatus,
                    order.assigned_manager || fallback.assigned_manager || null,
                    order.created_at || null,
                    Number(order.is_refundable ?? fallback.is_refundable ?? 1),
                    Number(order.booking_price || fallback.booking_price || 0) || null,
                    localBikeId
                ]
            );

            await this.db.query(
                'INSERT OR IGNORE INTO order_status_events (id, order_id, old_status, new_status, changed_by, created_at) VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))',
                [
                    uuidv4(),
                    orderId,
                    null,
                    normalizedStatus,
                    'system_mirror',
                    order.created_at || null
                ]
            );
        } catch (error) {
            console.warn('[BookingService] Local order mirror failed:', error.message || error);
        }
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
        this._assertBikePriceWithinCompliance(normalizedBikeSnapshot);

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

        const contactMethod = customer.contact_method || booking_form.contact_method || (customer.email ? 'email' : (customer.phone ? 'whatsapp' : (customer.telegram_id ? 'telegram' : 'whatsapp')));
        const contactValue = customer.contact_value || booking_form.contact_value || customer.email || customer.phone || customer.telegram_id || null;
        const city = booking_form.city || customer.city || null;

        // 1. Local-first CRM write path with remote fallback/mirror
        const customerPayload = { ...customer, name: customer.full_name || customer.name, contact_method: contactMethod, contact_value: contactValue, city };
        let customerData = null;
        let lead = null;
        let order = null;
        let usedRemoteFallback = false;

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

        const magicToken = this._generateMagicToken();
        const orderCode = this._generateOrderCode();

        try {
            customerData = await this._upsertCustomerLocal(customerPayload);
            if (!customerData) throw new Error('Local customer upsert failed');
            await this._assertFreeBookingQuota(customerData.id);

            lead = await this._createLeadLocal(customerData.id, bike_id, bikeUrl);
            lead = {
                ...lead,
                source: 'website_booking',
                status: 'new',
                contact_method: contactMethod,
                contact_value: contactValue
            };

            order = await this._createOrderLocal({
                customer_id: customerData.id,
                lead_id: lead.id,
                bike_id: bike_id,
                order_code: orderCode,
                magic_link_token: magicToken,
                bike_snapshot: bikeSnapshotWithUrl,
                status: ORDER_STATUS.BOOKED,
                total_price_rub,
                booking_amount_rub,
                exchange_rate,
                final_price_eur,
                delivery_method: shippingMethod,
                bike_url: bikeUrl,
                addons,
                booking_form: { ...booking_form, contact_method: contactMethod, contact_value: contactValue, city, delivery_option: shippingMethod }
            });

            if (this._useSupabase()) {
                await this._mirrorBookingToSupabase({
                    customer: customerData,
                    lead,
                    order,
                    bikeSnapshot: order.bike_snapshot || bikeSnapshotWithUrl,
                    bikeUrl,
                    shippingMethod
                });
            }
        } catch (localError) {
            if (!this._useSupabase()) throw localError;
            usedRemoteFallback = true;
            console.warn('[BookingService] Local-first flow failed, using Supabase fallback:', localError.message || localError);

            customerData = await this._upsertCustomer(customerPayload);
            if (!customerData) throw new Error('Failed to create customer');
            await this._assertFreeBookingQuota(customerData.id);

            lead = await this._createLead(customerData.id, bike_id, bikeUrl, bikeSnapshotWithUrl);
            order = await this._createOrder({
                customer_id: customerData.id,
                lead_id: lead.id,
                bike_id: bike_id,
                order_code: orderCode,
                magic_link_token: magicToken,
                bike_snapshot: bikeSnapshotWithUrl,
                status: ORDER_STATUS.BOOKED,
                total_price_rub,
                booking_amount_rub,
                exchange_rate,
                final_price_eur,
                delivery_method: shippingMethod,
                bike_url: bikeUrl,
                addons,
                booking_form: { ...booking_form, contact_method: contactMethod, contact_value: contactValue, city, delivery_option: shippingMethod }
            });
        }

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
                        if (!gemini || typeof gemini.performInitialInspection !== 'function') {
                            console.warn('[BookingService] performInitialInspection is unavailable, skip background inspection.');
                            return;
                        }
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
                name: customer.name || customer.full_name || 'ÐšÐ»Ð¸ÐµÐ½Ñ‚',
                email: customer.email,
                phone: customer.phone || ((contactMethod === 'phone' || contactMethod === 'whatsapp') ? contactValue : null)
            });
        } catch (e) {
            console.error('Auto-user creation failed:', e.message || e);
        }

        return {
            success: true,
            magic_link_url: orderCode ? `/order-tracking/${orderCode}` : null,
            order_code: orderCode,
            status: 'accepted',
            storage_mode: usedRemoteFallback ? 'supabase_fallback' : 'local_primary',
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
            preferred_channel: this._normalizePreferredChannel(
                customer.contact_method || (customer.telegram_id ? 'telegram' : (customer.email ? 'email' : 'whatsapp'))
            ),
            contact_value: customer.contact_value || customer.telegram_id || customer.email || customer.phone,
            city: customer.city || null
        };

        const payloadNoCity = { ...payload };
        delete payloadNoCity.city;

        if (existing) {
            let result = await supabase.supabase
                .from('customers')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single();
            if (result.error && this._isMissingCustomersCityError(result.error)) {
                result = await supabase.supabase
                    .from('customers')
                    .update(payloadNoCity)
                    .eq('id', existing.id)
                    .select()
                    .single();
            }
            if (result.error && this._isPreferredChannelEnumError(result.error)) {
                const fallbackPayload = { ...payloadNoCity, preferred_channel: 'telegram' };
                result = await supabase.supabase
                    .from('customers')
                    .update(fallbackPayload)
                    .eq('id', existing.id)
                    .select()
                    .single();
            }
            if (result.error) throw result.error;
            await this._mirrorCustomerToLocal(result.data || { ...payload, id: existing.id });
            return result.data;
        }

        let result = await supabase.supabase
            .from('customers')
            .insert(payload)
            .select()
            .single();
        if (result.error && this._isMissingCustomersCityError(result.error)) {
            result = await supabase.supabase
                .from('customers')
                .insert(payloadNoCity)
                .select()
                .single();
        }
        if (result.error && this._isPreferredChannelEnumError(result.error)) {
            result = await supabase.supabase
                .from('customers')
                .insert({ ...payloadNoCity, preferred_channel: 'telegram' })
                .select()
                .single();
        }
        if (result.error) throw result.error;
        await this._mirrorCustomerToLocal(result.data || payload);
        return result.data;
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
        await this._mirrorLeadToLocal(insertResult.data || {}, payload);
        return insertResult.data;
    }

    async _createOrder({ customer_id, lead_id, bike_id, order_code, magic_link_token, bike_snapshot, status, total_price_rub, booking_amount_rub, exchange_rate, final_price_eur, delivery_method, bike_url, addons, booking_form }) {
        this._assertBikePriceWithinCompliance(bike_snapshot);
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

        if (price < 500) {
            throw new Error('400: Bike price below EUR 500 minimum policy');
        }
        if (price > 5000) {
            throw new Error('400: Bike price exceeds EUR 5,000 compliance limit');
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
                status: normalizeOrderStatus(status) || ORDER_STATUS.BOOKED,
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
        await this._mirrorOrderToLocal(data || {}, {
            order_code,
            customer_id,
            lead_id,
            bike_id: durableSnapshot.bike_id || null,
            bike_url: durableSnapshot.bike_url || bike_url || null,
            bike_snapshot: { ...durableSnapshot, financials, booking_meta: bookingMeta },
            final_price_eur: finalEur,
            commission_eur: 0,
            status: normalizeOrderStatus(status) || ORDER_STATUS.BOOKED,
            assigned_manager: null,
            is_refundable: 1,
            booking_price: bookingRub,
            created_at: new Date().toISOString()
        });
        return data;
    }

    async _upsertCustomerLocal(customer) {
        const email = customer.email ? String(customer.email).trim().toLowerCase() : null;
        const phone = customer.phone ? String(customer.phone).trim() : null;
        const preferred = this._normalizePreferredChannel(
            customer.contact_method || (customer.telegram_id ? 'telegram' : (email ? 'email' : (phone ? 'whatsapp' : 'whatsapp')))
        );

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

        if (price < 500) {
            throw new Error('400: Bike price below EUR 500 minimum policy');
        }
        if (price > 5000) {
            throw new Error('400: Bike price exceeds EUR 5,000 compliance limit');
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
            queue_hint: booking_form?.queue_hint || 'Ð’Ñ‹ #2 Ð² Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸ (Ð·Ð°Ð³Ð»ÑƒÑˆÐºÐ°)'
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
                normalizeOrderStatus(status) || ORDER_STATUS.BOOKED,
                null,
                1,
                bookingRub,
                localBikeId
            ]
        );

        await this.db.query(
            'INSERT INTO order_status_events (id, order_id, old_status, new_status, changed_by, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [uuidv4(), id, null, normalizeOrderStatus(status) || ORDER_STATUS.BOOKED, 'system']
        );

        return {
            id,
            order_code,
            customer_id,
            lead_id,
            bike_id: localBikeId,
            bike_url: normalizedSnapshot.bike_url || bike_url || null,
            bike_snapshot: snapshot,
            bike_name: bikeName || null,
            listing_price_eur: price || null,
            initial_quality: normalizedSnapshot.condition || null,
            final_price_eur: finalEur,
            total_price_rub: totalRub,
            booking_amount_rub: bookingRub,
            exchange_rate: fx,
            delivery_method: shippingMethod,
            status: normalizeOrderStatus(status) || ORDER_STATUS.BOOKED,
            created_at: new Date().toISOString()
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
            const result = await this.db.query('INSERT INTO users (name, email, phone, password, must_change_password, must_set_email, temp_password) VALUES (?, ?, ?, ?, 0, ?, ?)', [name || 'ÐšÐ»Ð¸ÐµÐ½Ñ‚', placeholderEmail, phoneNorm, hashed, mustSetEmail, tempPassword]);
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

