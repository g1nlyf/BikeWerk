import { Router } from 'express'
import { createClient } from '@supabase/supabase-js';
const { DatabaseManager } = require('../../../js/mysql-config');

const router = Router()
const crmApiMod = require('../../../../scripts/crm-api.js')
const crmApi = crmApiMod.initializeCRM()
const geminiClient = require('../../../services/geminiProcessor');
const localDb = new DatabaseManager();
// const geminiClient = new GeminiProcessor(); // It's already instantiated in the export

// Initialize Supabase for complex queries (requires env vars; never ship hardcoded keys).
const supabaseUrl = process.env.SUPABASE_URL || null;
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    null;
const localSupabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
const supabase = crmApi?.supabase || localSupabase;

const ORDER_ID_REGEX = /^ORD-\d{8}-\d{4}$/i;
const ORDER_CODE_REGEX = /^ORD-\d{6}$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CHECKLIST_KEYS = [
    '1_brand_verified', '2_model_verified', '3_year_verified', '4_frame_size_verified',
    '5_serial_number', '6_frame_condition', '7_fork_condition', '8_shock_condition',
    '9_drivetrain_condition', '10_brakes_condition', '11_wheels_condition', '12_tires_condition',
    '13_headset_check', '14_bottom_bracket_check', '15_suspension_service_history', '16_brake_pads_percentage',
    '17_chain_wear', '18_cassette_wear', '19_rotor_condition', '20_bearing_play',
    '21_original_owner', '22_proof_of_purchase', '23_warranty_status', '24_crash_history',
    '25_reason_for_sale', '26_upgrades_verified', '27_test_ride_completed', '28_final_approval'
];

function buildDefaultChecklist() {
    const checklist: Record<string, { status: boolean | null; comment: string; photos: string[]; updated_at?: string }> = {};
    CHECKLIST_KEYS.forEach((key) => {
        checklist[key] = { status: null, comment: '', photos: [] };
    });
    return checklist;
}

function normalizeChecklist(raw: any) {
    const defaults = buildDefaultChecklist();
    let changed = false;

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { checklist: defaults, changed: true };
    }

    const hasAnyKey = CHECKLIST_KEYS.some((key) => Object.prototype.hasOwnProperty.call(raw, key));
    if (!hasAnyKey) changed = true;

    CHECKLIST_KEYS.forEach((key) => {
        const rawItem = raw[key];
        if (rawItem === true || rawItem === false) {
            defaults[key] = { status: rawItem, comment: '', photos: [] };
            changed = true;
            return;
        }
        if (rawItem && typeof rawItem === 'object' && !Array.isArray(rawItem)) {
            const status = rawItem.status ?? null;
            const comment = rawItem.comment ?? '';
            const photos = Array.isArray(rawItem.photos) ? rawItem.photos : [];
            const updated_at = rawItem.updated_at;
            defaults[key] = { status, comment, photos, ...(updated_at ? { updated_at } : {}) };
            return;
        }
        if (typeof rawItem === 'string') {
            defaults[key] = { status: null, comment: rawItem, photos: [] };
            changed = true;
            return;
        }
        if (rawItem !== undefined) {
            changed = true;
        }
    });

    return { checklist: defaults, changed };
}

function safeJsonParse(raw: any) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw !== 'string') return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function getSnapshotContact(snapshot: any) {
    const bookingMeta = snapshot?.booking_meta || {};
    const bookingForm = bookingMeta?.booking_form || {};
    const contactValue =
        bookingForm?.contact_value ||
        bookingMeta?.contact_value ||
        snapshot?.contact_value ||
        null;
    const preferredChannel =
        bookingForm?.contact_method ||
        bookingMeta?.contact_method ||
        snapshot?.preferred_channel ||
        snapshot?.contact_method ||
        null;
    const city =
        bookingForm?.city ||
        bookingMeta?.city ||
        snapshot?.city ||
        snapshot?.destination_city ||
        snapshot?.route_to ||
        null;
    return { contactValue, preferredChannel, city };
}

function mergeCustomerWithSnapshot(customerRaw: any, snapshot: any) {
    const snapshotContact = getSnapshotContact(snapshot || {});
    if (!customerRaw) {
        if (!snapshotContact.contactValue && !snapshotContact.city) return null;
        return {
            full_name: null,
            phone: null,
            email: null,
            city: snapshotContact.city || null,
            country: null,
            contact_value: snapshotContact.contactValue || null,
            preferred_channel: snapshotContact.preferredChannel || null
        };
    }
    return {
        ...customerRaw,
        city: customerRaw.city || customerRaw.country || snapshotContact.city || null,
        contact_value: customerRaw.contact_value || snapshotContact.contactValue || null,
        preferred_channel: customerRaw.preferred_channel || snapshotContact.preferredChannel || null
    };
}

function normalizeLocalDeliveryMethod(method: any) {
    const normalized = String(method || '').trim();
    if (!normalized) return 'Cargo';
    if (normalized === 'CargoProtected') return 'Cargo';
    return normalized;
}

function getInspectionFromBikeRow(row: any) {
    const inspectionJson = safeJsonParse(row?.inspection_json);
    const inspectionData = safeJsonParse(row?.inspection_data);
    const conditionChecklist = safeJsonParse(row?.condition_checklist);

    const candidateChecklist =
        (inspectionJson && typeof inspectionJson === 'object' && inspectionJson.checklist && typeof inspectionJson.checklist === 'object')
            ? inspectionJson.checklist
            : (inspectionData && typeof inspectionData === 'object' && inspectionData.checklist && typeof inspectionData.checklist === 'object')
                ? inspectionData.checklist
                : (conditionChecklist && typeof conditionChecklist === 'object' && conditionChecklist.checklist && typeof conditionChecklist.checklist === 'object')
                    ? conditionChecklist.checklist
                    : inspectionJson || inspectionData || conditionChecklist;

    const normalized = normalizeChecklist(candidateChecklist);
    const existingMeta = [inspectionJson, inspectionData, conditionChecklist].find((src: any) => src && typeof src === 'object') || {};
    const photosStatus = existingMeta?.photos_status && typeof existingMeta.photos_status === 'object' ? existingMeta.photos_status : {};

    return {
        checklist: normalized.checklist,
        changed: normalized.changed,
        photos_status: photosStatus,
        next_action_suggestion: existingMeta?.next_action_suggestion || null,
        quality_score: existingMeta?.quality_score ?? null,
        quality_label: existingMeta?.quality_label || null
    };
}

function buildProgress(checklist: Record<string, any>) {
    const items = Object.values(checklist || {});
    const total = items.length;
    const completed = items.filter((v: any) => v?.status === true || v?.status === false).length;
    const passed = items.filter((v: any) => v?.status === true).length;
    const failed = items.filter((v: any) => v?.status === false).length;
    return {
        total,
        completed,
        passed,
        failed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

function buildInspectionPayload(currentMeta: any, checklist: Record<string, any>, overrides: Record<string, any> = {}) {
    return {
        ...(currentMeta && typeof currentMeta === 'object' ? currentMeta : {}),
        checklist,
        photos_status: overrides.photos_status ?? currentMeta?.photos_status ?? {},
        quality_score: overrides.quality_score ?? currentMeta?.quality_score ?? null,
        quality_label: overrides.quality_label ?? currentMeta?.quality_label ?? null,
        next_action_suggestion: overrides.next_action_suggestion ?? currentMeta?.next_action_suggestion ?? null,
        updated_at: new Date().toISOString()
    };
}

async function persistChecklistToLocalBike(bikeId: number, checklist: Record<string, any>, currentMeta: any, overrides: Record<string, any> = {}) {
    const inspectionPayload = buildInspectionPayload(currentMeta, checklist, overrides);
    const progress = buildProgress(checklist);
    await localDb.query(
        `UPDATE bikes
         SET inspection_json = ?,
             inspection_data = ?,
             condition_checklist = ?,
             checklist_completed = ?,
             checklist_total = ?,
             inspection_completed = ?,
             inspection_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
            JSON.stringify(inspectionPayload),
            JSON.stringify(inspectionPayload),
            JSON.stringify(checklist),
            progress.completed,
            progress.total,
            progress.completed === progress.total && progress.total > 0 ? 1 : 0,
            bikeId
        ]
    );
    return { inspectionPayload, progress };
}

async function persistChecklistToSupabaseBike(supabaseClient: any, bikeId: string | number, checklist: Record<string, any>, currentMeta: any, overrides: Record<string, any> = {}) {
    const inspectionPayload = buildInspectionPayload(currentMeta, checklist, overrides);
    const progress = buildProgress(checklist);
    const updatePayload: Record<string, any> = {
        inspection_json: inspectionPayload,
        inspection_data: inspectionPayload,
        condition_checklist: checklist,
        checklist_completed: progress.completed,
        checklist_total: progress.total,
        inspection_completed: progress.completed === progress.total && progress.total > 0,
        inspection_date: new Date().toISOString()
    };
    const { error } = await supabaseClient.from('bikes').update(updatePayload).eq('id', bikeId);
    if (error) throw error;
    return { inspectionPayload, progress };
}

async function resolveOrderIds(orderId: string, supabaseClient: any) {
    if (!supabaseClient) {
        return { order: null, orderId: orderId, orderCode: null, orderUUID: null };
    }

    const isUUID = UUID_REGEX.test(orderId);
    const isStringId = ORDER_ID_REGEX.test(orderId);
    const isOrderCode = ORDER_CODE_REGEX.test(orderId);

    let order = null;
    if (isUUID || isStringId) {
        const { data } = await supabaseClient.from('orders').select('*').eq('id', orderId).maybeSingle();
        order = data || null;
    }
    if (!order && isOrderCode) {
        const { data } = await supabaseClient.from('orders').select('*').eq('order_code', orderId).maybeSingle();
        order = data || null;
    }
    if (!order && isUUID) {
        const { data } = await supabaseClient.from('orders').select('*').eq('old_uuid_id', orderId).maybeSingle();
        order = data || null;
    }
    if (!order && !isOrderCode && !isStringId) {
        const { data } = await supabaseClient
            .from('orders')
            .select('*')
            .or(`order_code.eq.${orderId},id.eq.${orderId},old_uuid_id.eq.${orderId}`)
            .maybeSingle();
        order = data || null;
    }

    const orderUUID = order?.old_uuid_id && UUID_REGEX.test(order.old_uuid_id) ? order.old_uuid_id : null;
    return {
        order,
        orderId: order?.id || orderId,
        orderCode: order?.order_code || null,
        orderUUID
    };
}

function buildOrderIdCandidates(...ids: Array<string | null | undefined>) {
    return Array.from(new Set(ids.filter(Boolean).map((id) => String(id))));
}

// ==========================================
// BLOCK 1: INTERACTIVE CHECKLIST ENDPOINTS
// ==========================================

// Helper: Get or create inspection for order
async function getOrCreateInspection(orderId: string, supabase: any) {
    if (!supabase) {
        const orderRows = await localDb.query(
            'SELECT id, order_code, bike_id, bike_snapshot FROM orders WHERE id = ? OR order_code = ? LIMIT 1',
            [orderId, orderId]
        );
        const order = orderRows?.[0] || null;
        if (!order) {
            throw new Error('Order not found');
        }

        const snapshot = safeJsonParse(order.bike_snapshot) || {};
        const bikeIdRaw = order.bike_id || snapshot?.bike_id || null;
        const bikeId = Number(bikeIdRaw);
        if (!Number.isFinite(bikeId) || bikeId <= 0) {
            throw new Error('Order has no linked bike');
        }

        const bikeRows = await localDb.query(
            'SELECT id, inspection_json, inspection_data, condition_checklist, checklist_completed, checklist_total, inspection_completed FROM bikes WHERE id = ? LIMIT 1',
            [bikeId]
        );
        const bike = bikeRows?.[0] || null;
        if (!bike) {
            throw new Error('Bike not found for order');
        }

        const parsed = getInspectionFromBikeRow(bike);
        if (parsed.changed) {
            await persistChecklistToLocalBike(bikeId, parsed.checklist, safeJsonParse(bike.inspection_json) || {});
        }

        return {
            id: `bike-${bikeId}`,
            order_id: order.id,
            bike_id: bikeId,
            checklist: parsed.checklist,
            photos_status: parsed.photos_status,
            next_action_suggestion: parsed.next_action_suggestion,
            _storage: 'bike-local'
        };
    }

    const resolved = await resolveOrderIds(orderId, supabase);
    const order = resolved.order;
    const snapshot = safeJsonParse(order?.bike_snapshot) || {};
    const bikeIdRaw = order?.bike_id || snapshot?.bike_id || null;
    const bikeId = bikeIdRaw != null ? String(bikeIdRaw) : null;

    if (bikeId) {
        try {
            const { data: bikeRow } = await supabase
                .from('bikes')
                .select('id, inspection_json, inspection_data, condition_checklist, checklist_completed, checklist_total, inspection_completed')
                .eq('id', bikeId)
                .maybeSingle();

            if (bikeRow) {
                const parsed = getInspectionFromBikeRow(bikeRow);
                if (parsed.changed) {
                    await persistChecklistToSupabaseBike(supabase, bikeId, parsed.checklist, safeJsonParse((bikeRow as any).inspection_json) || {});
                }
                return {
                    id: `bike-${bikeId}`,
                    order_id: resolved.orderId || orderId,
                    bike_id: bikeId,
                    checklist: parsed.checklist,
                    photos_status: parsed.photos_status,
                    next_action_suggestion: parsed.next_action_suggestion,
                    _storage: 'bike-supabase'
                };
            }
        } catch (bikeErr) {
            console.warn('Checklist bikes storage fallback failed:', bikeErr);
        }
    }

    const inspectionOrderId = resolved.orderId || orderId;

    // Legacy fallback: keep old inspections support if bike row is unavailable.
    const { data: existing } = await supabase
        .from('inspections')
        .select('*')
        .eq('order_id', inspectionOrderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existing) {
        const normalized = normalizeChecklist(existing.checklist);
        if (normalized.changed) {
            try {
                await supabase.from('inspections').update({ checklist: normalized.checklist }).eq('id', existing.id);
            } catch (e) {
                console.warn('Checklist normalization update failed:', e);
            }
            existing.checklist = normalized.checklist;
        }
        return { ...existing, _storage: 'inspections' };
    }

    const defaultChecklist = buildDefaultChecklist();
    const { data: newInspection, error: createError } = await supabase
        .from('inspections')
        .insert({
            order_id: inspectionOrderId,
            checklist: defaultChecklist,
            photos_status: {},
            status: 'pending'
        })
        .select()
        .single();

    if (createError) throw createError;
    return { ...(newInspection || {}), _storage: 'inspections' };
}

// GET /api/v1/crm/orders/:orderId/checklist
// Returns the full checklist for an order
router.get('/orders/:orderId/checklist', async (req, res) => {
    try {
        const { orderId } = req.params;

        const inspection = await getOrCreateInspection(orderId, supabase);
        const checklist = normalizeChecklist(inspection.checklist).checklist;
        const progress = buildProgress(checklist);

        res.json({
            success: true,
            inspection_id: inspection.id,
            checklist,
            photos_status: inspection.photos_status,
            progress,
            next_action_suggestion: inspection.next_action_suggestion
        });
    } catch (error: any) {
        console.error('Get Checklist Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/v1/crm/orders/:orderId/checklist/:itemId
// Updates a single checklist item (status, comment)
router.patch('/orders/:orderId/checklist/:itemId', async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { status, comment } = req.body;

        if (!CHECKLIST_KEYS.includes(itemId)) {
            return res.status(400).json({ error: 'Unknown checklist item' });
        }

        // Get current inspection
        const inspection = await getOrCreateInspection(orderId, supabase);
        const normalized = normalizeChecklist(inspection.checklist);
        const currentChecklist = normalized.checklist;

        // Update the specific item
        const currentItem = currentChecklist[itemId] || { status: null, comment: '', photos: [] };
        const updatedItem = {
            ...currentItem,
            status: status !== undefined ? status : currentItem.status,
            comment: comment !== undefined ? comment : currentItem.comment,
            updated_at: new Date().toISOString()
        };

        // Merge back
        const updatedChecklist = {
            ...currentChecklist,
            [itemId]: updatedItem
        };

        if (inspection._storage === 'bike-local') {
            await persistChecklistToLocalBike(
                Number(inspection.bike_id),
                updatedChecklist,
                { photos_status: inspection.photos_status, next_action_suggestion: inspection.next_action_suggestion }
            );
        } else if (inspection._storage === 'bike-supabase') {
            if (!supabase) throw new Error('Database unavailable');
            await persistChecklistToSupabaseBike(
                supabase,
                inspection.bike_id,
                updatedChecklist,
                { photos_status: inspection.photos_status, next_action_suggestion: inspection.next_action_suggestion }
            );
        } else {
            const { error: updateError } = await supabase
                .from('inspections')
                .update({ checklist: updatedChecklist })
                .eq('id', inspection.id);
            if (updateError) throw updateError;
        }

        // Create timeline event
        const statusText = status === true ? 'OK' : status === false ? 'Issue found' : 'Pending';
        if (supabase) {
            try {
            await supabase.from('audit_log').insert({
                action: 'checklist_item_updated',
                    entity: inspection._storage?.startsWith('bike') ? 'bikes' : 'inspections',
                entity_id: inspection._storage?.startsWith('bike') ? inspection.bike_id : inspection.id,
                payload: {
                    item_id: itemId,
                    status: statusText,
                    comment: comment || null,
                    order_id: orderId
                }
            });
            } catch (auditErr) {
                console.warn('Audit log failed:', auditErr);
            }
        }

        const progress = buildProgress(updatedChecklist);

        res.json({
            success: true,
            item: updatedItem,
            progress: {
                total: progress.total,
                completed: progress.completed,
                percentage: progress.percentage
            }
        });
    } catch (error: any) {
        console.error('Update Checklist Item Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/v1/crm/orders/:orderId/checklist/:itemId/photos
// Upload photos for a specific checklist item
router.post('/orders/:orderId/checklist/:itemId/photos', async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { photo_urls } = req.body; // Array of URLs (uploaded via separate file upload endpoint)

        if (!CHECKLIST_KEYS.includes(itemId)) {
            return res.status(400).json({ error: 'Unknown checklist item' });
        }
        if (!photo_urls || !Array.isArray(photo_urls)) {
            return res.status(400).json({ error: 'photo_urls array required' });
        }

        // Get current inspection
        const inspection = await getOrCreateInspection(orderId, supabase);
        const normalized = normalizeChecklist(inspection.checklist);
        const currentChecklist = normalized.checklist;

        // Update the specific item
        const currentItem = currentChecklist[itemId] || { status: null, comment: '', photos: [] };
        const existingPhotos = currentItem.photos || [];
        const updatedItem = {
            ...currentItem,
            photos: [...existingPhotos, ...photo_urls],
            updated_at: new Date().toISOString()
        };

        // Merge back
        const updatedChecklist = {
            ...currentChecklist,
            [itemId]: updatedItem
        };

        if (inspection._storage === 'bike-local') {
            await persistChecklistToLocalBike(
                Number(inspection.bike_id),
                updatedChecklist,
                { photos_status: inspection.photos_status, next_action_suggestion: inspection.next_action_suggestion }
            );
        } else if (inspection._storage === 'bike-supabase') {
            if (!supabase) throw new Error('Database unavailable');
            await persistChecklistToSupabaseBike(
                supabase,
                inspection.bike_id,
                updatedChecklist,
                { photos_status: inspection.photos_status, next_action_suggestion: inspection.next_action_suggestion }
            );
        } else {
            const { error: updateError } = await supabase
                .from('inspections')
                .update({ checklist: updatedChecklist })
                .eq('id', inspection.id);
            if (updateError) throw updateError;
        }

        // Audit log
        if (supabase) {
            try {
                await supabase.from('audit_log').insert({
                    action: 'checklist_photos_added',
                    entity: inspection._storage?.startsWith('bike') ? 'bikes' : 'inspections',
                    entity_id: inspection._storage?.startsWith('bike') ? inspection.bike_id : inspection.id,
                    payload: {
                        item_id: itemId,
                        photos_count: photo_urls.length,
                        order_id: orderId
                    }
                });
            } catch (auditErr) {
                console.warn('Audit log failed:', auditErr);
            }
        }

        res.json({
            success: true,
            item: updatedItem,
            photos_count: updatedItem.photos.length
        });
    } catch (error: any) {
        console.error('Upload Checklist Photos Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/v1/crm/orders/:orderId/checklist/ai-regrade
// Trigger AI re-evaluation of checklist (quality score)
router.post('/orders/:orderId/checklist/ai-regrade', async (req, res) => {
    try {
        const { orderId } = req.params;

        const resolved = supabase ? await resolveOrderIds(orderId, supabase) : null;

        // Get inspection
        const inspection = await getOrCreateInspection(orderId, supabase);
        const checklist = normalizeChecklist(inspection.checklist).checklist;

        // Analyze checklist for quality scoring
        const items = Object.entries(checklist);
        const failed = items.filter(([_, v]: [string, any]) => v.status === false);
        const passed = items.filter(([_, v]: [string, any]) => v.status === true);
        const pending = items.filter(([_, v]: [string, any]) => v.status === null);

        // Simple quality scoring (can be enhanced with AI later)
        let qualityScore = 100;
        const deductions: { item: string; reason: string; points: number }[] = [];

        failed.forEach(([key, val]: [string, any]) => {
            const points = key.includes('frame') || key.includes('fork') ? 15 : 5;
            qualityScore -= points;
            deductions.push({
                item: key,
                reason: (val as any).comment || 'Issue detected',
                points
            });
        });

        qualityScore = Math.max(0, qualityScore);

        // Determine quality label
        let qualityLabel = 'Excellent';
        if (qualityScore < 60) qualityLabel = 'Poor';
        else if (qualityScore < 80) qualityLabel = 'Good';
        else if (qualityScore < 95) qualityLabel = 'Very Good';

        // Generate next action suggestion
        let nextAction = 'All checks passed. Ready for final approval.';
        if (pending.length > 0) {
            nextAction = `${pending.length} items still pending review.`;
        } else if (failed.length > 0) {
            nextAction = `${failed.length} issues found. Review and communicate with seller.`;
        }

        if (inspection._storage === 'bike-local') {
            await persistChecklistToLocalBike(
                Number(inspection.bike_id),
                checklist,
                { photos_status: inspection.photos_status },
                {
                    quality_score: qualityScore,
                    quality_label: qualityLabel,
                    next_action_suggestion: nextAction
                }
            );
        } else if (inspection._storage === 'bike-supabase') {
            if (!supabase) throw new Error('Database unavailable');
            await persistChecklistToSupabaseBike(
                supabase,
                inspection.bike_id,
                checklist,
                { photos_status: inspection.photos_status },
                {
                    quality_score: qualityScore,
                    quality_label: qualityLabel,
                    next_action_suggestion: nextAction
                }
            );
        } else {
            const { error: updateError } = await supabase
                .from('inspections')
                .update({
                    quality_score: qualityScore,
                    next_action_suggestion: nextAction
                })
                .eq('id', inspection.id);
            if (updateError) throw updateError;
        }

        // Also update order quality
        if (supabase && resolved?.orderId) {
            await supabase
            .from('orders')
            .update({ final_quality: qualityLabel })
            .eq('id', resolved.orderId);
        }

        res.json({
            success: true,
            quality_score: qualityScore,
            quality_label: qualityLabel,
            deductions,
            next_action: nextAction,
            summary: {
                passed: passed.length,
                failed: failed.length,
                pending: pending.length,
                total: items.length
            }
        });
    } catch (error: any) {
        console.error('AI Regrade Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// BLOCK 4: EDITABLE LOGISTICS ENDPOINTS
// ==========================================

// GET /api/v1/crm/orders/:orderId/shipments
// Get all shipments for an order
router.get('/orders/:orderId/shipments', async (req, res, next) => {
    try {
        const { orderId } = req.params;
        if (!supabase) return next();

        const resolved = await resolveOrderIds(orderId, supabase);
        const shipmentOrderIds = buildOrderIdCandidates(resolved.orderId, resolved.orderUUID, orderId);
        let query = supabase
            .from('shipments')
            .select('*')
            .order('created_at', { ascending: false });
        if (shipmentOrderIds.length > 1) {
            query = query.in('order_id', shipmentOrderIds);
        } else if (shipmentOrderIds.length === 1) {
            query = query.eq('order_id', shipmentOrderIds[0]);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, shipments: data || [] });
    } catch (error: any) {
        console.error('Get Shipments Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/v1/crm/shipments/:shipmentId
// Update shipment (tracking number, carrier, status, notes)
router.patch('/shipments/:shipmentId', async (req, res, next) => {
    try {
        const { shipmentId } = req.params;
        const {
            tracking_number,
            carrier,
            provider,
            warehouse_received,
            warehouse_photos_received,
            client_received,
            estimated_delivery,
            estimated_delivery_date,
            ruspost_status
        } = req.body;

        if (!supabase) return next();

        const updates: Record<string, any> = {};
        if (tracking_number !== undefined) updates.tracking_number = tracking_number;
        if (provider !== undefined) updates.provider = provider;
        if (carrier !== undefined && provider === undefined && String(carrier).trim().toLowerCase() === 'rusbid') {
            updates.provider = 'rusbid';
        }
        if (warehouse_received !== undefined) updates.warehouse_received = warehouse_received;
        if (warehouse_photos_received !== undefined) updates.warehouse_photos_received = warehouse_photos_received;
        if (client_received !== undefined) updates.client_received = client_received;
        if (estimated_delivery_date !== undefined) updates.estimated_delivery_date = estimated_delivery_date;
        if (estimated_delivery !== undefined && estimated_delivery_date === undefined) updates.estimated_delivery_date = estimated_delivery;
        if (ruspost_status !== undefined) updates.ruspost_status = ruspost_status;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('shipments')
            .update(updates)
            .eq('id', shipmentId)
            .select()
            .single();

        if (error) throw error;

        // Audit log
        try {
            await supabase.from('audit_log').insert({
                action: 'shipment_updated',
                entity: 'shipments',
                entity_id: shipmentId,
                payload: updates
            });
        } catch (auditErr) {
            console.warn('Audit log failed:', auditErr);
        }

        res.json({ success: true, shipment: data });
    } catch (error: any) {
        console.error('Update Shipment Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/v1/crm/orders/:orderId/shipments
// Create new shipment for order
router.post('/orders/:orderId/shipments', async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { carrier, provider, tracking_number, estimated_delivery, estimated_delivery_date } = req.body;

        if (!supabase) return next();

        const resolved = await resolveOrderIds(orderId, supabase);
        const shipmentOrderId = resolved.orderId || resolved.orderUUID || orderId;
        const requestedProvider = String(provider || carrier || 'rusbid').trim().toLowerCase() || 'rusbid';

        const basePayload = {
            order_id: shipmentOrderId,
            provider: requestedProvider,
            tracking_number: tracking_number || null,
            estimated_delivery_date: estimated_delivery_date || estimated_delivery || null
        };

        let { data, error } = await supabase
            .from('shipments')
            .insert(basePayload)
            .select()
            .single();

        if (error && requestedProvider !== 'rusbid') {
            // Fallback for strict provider enums: keep tracking persistent instead of dropping the shipment.
            const fallbackPayload = {
                ...basePayload,
                provider: 'rusbid',
                ruspost_status: { source_provider: requestedProvider }
            };
            const fallback = await supabase
                .from('shipments')
                .insert(fallbackPayload)
                .select()
                .single();
            data = fallback.data;
            error = fallback.error;
        }

        if (error) throw error;

        res.json({ success: true, shipment: data });
    } catch (error: any) {
        console.error('Create Shipment Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/v1/crm/orders/:orderId/notify-tracking
// Send tracking notification to customer (placeholder - implement actual notification service)
router.post('/orders/:orderId/notify-tracking', async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { method } = req.body; // 'email' | 'sms' | 'whatsapp'

        if (!supabase) return next();

        const resolved = await resolveOrderIds(orderId, supabase);
        if (!resolved.order) return res.status(404).json({ error: 'Order not found' });

        const shipmentOrderIds = buildOrderIdCandidates(resolved.orderId, resolved.orderUUID, orderId);

        const { data: customer } = await supabase
            .from('customers')
            .select('full_name, email, phone')
            .eq('id', resolved.order.customer_id)
            .maybeSingle();

        let shipmentQuery = supabase
            .from('shipments')
            .select('tracking_number, provider')
            .order('created_at', { ascending: false })
            .limit(1);
        if (shipmentOrderIds.length > 1) {
            shipmentQuery = shipmentQuery.in('order_id', shipmentOrderIds);
        } else if (shipmentOrderIds.length === 1) {
            shipmentQuery = shipmentQuery.eq('order_id', shipmentOrderIds[0]);
        }
        const { data: shipment } = await shipmentQuery.maybeSingle();

        // Log the notification attempt (actual sending would go here)
        console.log(`[NOTIFY] Order ${resolved.order.order_code || resolved.orderId} tracking via ${method}:`, {
            customer,
            shipment
        });

        // Audit log
        try {
            await supabase.from('audit_log').insert({
                action: 'tracking_notification_sent',
                entity: 'orders',
                entity_id: resolved.order.id || orderId,
                payload: { method, tracking_number: shipment?.tracking_number }
            });
        } catch (auditErr) {
            console.warn('Audit log failed:', auditErr);
        }

        res.json({ success: true, message: `Tracking notification sent via ${method}` });
    } catch (error: any) {
        console.error('Notify Tracking Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// BLOCK 5: EDITABLE FINANCE/TRANSACTIONS
// ==========================================

// GET /api/v1/crm/orders/:orderId/transactions
// Get all transactions for an order
router.get('/orders/:orderId/transactions', async (req, res, next) => {
    try {
        const { orderId } = req.params;
        if (!supabase) return next();

        const resolved = await resolveOrderIds(orderId, supabase);
        if (!resolved.order) return res.status(404).json({ error: 'Order not found' });
        const paymentOrderId = resolved.orderUUID || resolved.orderId || orderId;

        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('order_id', paymentOrderId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate totals
        const payments = data || [];
        const transactions = payments.map((p: any) => ({
            id: p.id,
            order_id: p.order_id,
            amount: p.amount,
            type: p.direction === 'outgoing' ? 'refund' : 'payment',
            method: p.method,
            description: p.role || null,
            transaction_date: p.created_at,
            status: p.status,
            currency: p.currency
        }));

        const totalPaid = payments
            .filter((p: any) => p.direction === 'incoming' && p.status === 'completed')
            .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
        const totalRefunded = payments
            .filter((p: any) => p.direction === 'outgoing' && p.status === 'completed')
            .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

        res.json({
            success: true,
            transactions,
            summary: {
                total_paid: totalPaid,
                total_refunded: totalRefunded,
                balance: totalPaid - totalRefunded
            }
        });
    } catch (error: any) {
        console.error('Get Transactions Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/v1/crm/orders/:orderId/transactions
// Add new transaction (payment, refund, adjustment)
router.post('/orders/:orderId/transactions', async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { amount, type, method, description, transaction_date, status } = req.body;

        if (!supabase) return next();
        if (!amount || !type) {
            return res.status(400).json({ error: 'amount and type required' });
        }

        const resolved = await resolveOrderIds(orderId, supabase);
        if (!resolved.order) return res.status(404).json({ error: 'Order not found' });
        const paymentOrderId = resolved.orderUUID || resolved.orderId || orderId;

        const direction = String(type).toLowerCase().includes('refund') || String(type).toLowerCase().includes('out')
            ? 'outgoing'
            : 'incoming';

        const payload: Record<string, any> = {
            order_id: paymentOrderId,
            direction,
            role: description || (direction === 'outgoing' ? 'refund' : 'client_payment'),
            method: method || 'bank_transfer',
            amount: Number(amount),
            currency: 'EUR',
            status: status || 'completed',
            external_reference: `CRM-MANUAL-${Date.now()}`
        };
        if (transaction_date) payload.created_at = transaction_date;

        const { data, error } = await supabase
            .from('payments')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        // Audit log
        try {
            await supabase.from('audit_log').insert({
                action: 'transaction_added',
                entity: 'payments',
                entity_id: data.id,
                payload: { order_id: paymentOrderId, amount, type, method }
            });
        } catch (auditErr) {
            console.warn('Audit log failed:', auditErr);
        }

        res.json({ success: true, transaction: data });
    } catch (error: any) {
        console.error('Add Transaction Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/v1/crm/transactions/:transactionId
// Delete a transaction
router.delete('/transactions/:transactionId', async (req, res, next) => {
    try {
        const { transactionId } = req.params;

        if (!supabase) return next();

        const { error } = await supabase
            .from('payments')
            .delete()
            .eq('id', transactionId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete Transaction Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

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
            .or(`order_code.ilike.%${q}%,bike_name.ilike.%${q}%,id.ilike.%${q}%`)
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
async function fetchOrderDetails(identifier: string, supabase: any, type: 'id' | 'code' | 'token' | 'auto' = 'auto') {
    const selectWithRelations = '*, users(name), customers(full_name,email,phone,country,city,contact_value,preferred_channel)';
    const selectFallback = '*, customers(full_name,email,phone,country,city,contact_value,preferred_channel)';

    const tryFetch = async (column: string, value: string) => {
        let { data, error } = await supabase
            .from('orders')
            .select(selectWithRelations)
            .eq(column, value)
            .maybeSingle();
        if (error) {
            console.warn(`[CRM] Order fetch error for ${column}=${value}:`, error.message || error);
            const fallback = await supabase
                .from('orders')
                .select(selectFallback)
                .eq(column, value)
                .maybeSingle();
            data = fallback.data || null;
        }
        return data || null;
    };

    let orderData: any = null;
    if (type === 'token') {
        orderData = await tryFetch('magic_link_token', identifier);
    } else {
        // Try ID first
        orderData = await tryFetch('id', identifier);

        // Fallback to order_code
        if (!orderData) {
            orderData = await tryFetch('order_code', identifier);
        }

        // Fallback to old_uuid_id if identifier is UUID
        if (!orderData && UUID_REGEX.test(identifier)) {
            orderData = await tryFetch('old_uuid_id', identifier);
        }
    }

    if (!orderData) {
        return null;
    }

    const orderStringID = orderData.id;
    const orderUUID = orderData.old_uuid_id; // UUID or null

    const isUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const validUUID = (orderUUID && isUUID(orderUUID)) ? orderUUID : null;

    // Fetch relations from both possible key formats (text order id + legacy uuid id).
    const relationIds = buildOrderIdCandidates(orderStringID, validUUID);
    const [tasksRes, negRes, logRes, payRes, inspRes, historyRes] = await Promise.all([
        relationIds.length
            ? supabase.from('tasks').select('*').in('order_id', relationIds).order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
        relationIds.length
            ? supabase.from('negotiations').select('*').in('order_id', relationIds).order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
        relationIds.length
            ? supabase.from('shipments').select('*').in('order_id', relationIds)
            : Promise.resolve({ data: [] }),
        relationIds.length
            ? supabase.from('payments').select('*').in('order_id', relationIds).order('created_at', { ascending: true })
            : Promise.resolve({ data: [] }),
        supabase.from('inspections').select('*').eq('order_id', orderStringID).order('created_at', { ascending: false }).limit(1),
        supabase.from('order_status_events').select('old_status,new_status,change_notes,created_at').eq('order_id', orderStringID).order('created_at', { ascending: true })
    ]);

    const tasks = tasksRes.data || [];
    const negotiations = negRes.data || [];
    const logistics = logRes.data || [];
    const payments = payRes.data || [];
    const inspection = inspRes.data?.[0] || null;
    const history = (historyRes?.data || []).map((e: any) => ({
        status: e.old_status || 'created',
        new_status: e.new_status,
        change_notes: e.change_notes || null,
        created_at: e.created_at
    }));

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

    // Items derived from bike_snapshot (single object or array)
    const snapshot = safeJsonParse(orderData.bike_snapshot) || null;
    const items = snapshot ? (Array.isArray(snapshot) ? snapshot : [snapshot]) : [];

    const customerRaw = Array.isArray(orderData.customers) ? orderData.customers[0] : orderData.customers;
    const customer = mergeCustomerWithSnapshot(customerRaw, snapshot);
    let managerName = Array.isArray(orderData.users) ? orderData.users[0]?.name : orderData.users?.name;
    if (!managerName && orderData.assigned_manager) {
        const { data: managerRow } = await supabase
            .from('users')
            .select('name')
            .eq('id', orderData.assigned_manager)
            .limit(1)
            .maybeSingle();
        managerName = managerRow?.name || null;
    }

    return {
        order: {
            order_id: orderData.id,
            order_number: orderData.order_code,
            status: orderData.status,
            total_amount: orderData.final_price_eur,
            total_amount_rub: orderData.total_price_rub,
            booking_amount: orderData.booking_amount_eur,
            commission: orderData.commission_eur,
            bike_name: orderData.bike_name,
            bike_snapshot: orderData.bike_snapshot,
            manager_notes: orderData.manager_notes,
            initial_quality: orderData.initial_quality,
            final_quality: orderData.final_quality,
            is_refundable: orderData.is_refundable,
            assigned_manager: orderData.assigned_manager,
            assigned_manager_name: managerName || null,
            created_at: orderData.created_at,
            customer: customer || null
        },
        history,
        finances: finances,
        logistics: logistics,
        tasks: tasks,
        negotiations: negotiations,
        inspection: inspection,
        live_feed: generateLiveFeed(tasks, negotiations),
        items
    };
}

// Track by Token
router.get('/orders/track/:token', async (req, res) => {
    try {
        const { token } = req.params;
        if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

        const result = await fetchOrderDetails(token, supabase, 'token');
        if (!result) return res.status(404).json({ error: 'Order not found or token invalid' });

        res.json(result);
    } catch (error: any) {
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
            const botToken = process.env.BOT_TOKEN || process.env.MANAGER_BOT_TOKEN || '';
            const axios = require('axios');
            if (!botToken) {
                console.warn('⚠️ BOT_TOKEN missing. Skipping Telegram notification.');
                return res.status(200).json({ success: true, task, warning: 'BOT_TOKEN missing' });
            }

            // Find Manager TG ID
            let managerTgId = null;
            if (order.assigned_manager) {
                // Try to find in users
                const { data: user } = await supabase.from('users').select('telegram_id').eq('username', order.assigned_manager).single();
                if (user) managerTgId = user.telegram_id;
            }

            // Fallback to Admin/Group if no manager or manager has no TG
            const targetChatId = managerTgId || process.env.ADMIN_CHAT_ID;
            if (!targetChatId) {
                console.warn('⚠️ ADMIN_CHAT_ID missing. Skipping Telegram notification.');
                return;
            }

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
        const method = normalizeLocalDeliveryMethod(req.body?.method);
        if (!method) return res.status(400).json({ error: 'Method required' });

        const shippingRates: any = {
            Cargo: 170,
            CargoProtected: 170,
            EMS: 220,
            Premium: 650
        };
        const newShippingCost = Number(shippingRates[method] ?? 170);

        let orderCodeForNotify = orderId;
        let newTotalEur = 0;
        let newTotalRub = 0;

        if (supabase) {
            const { data: order, error: orderError } = await supabase.from('orders')
                .select('id, order_code, final_price_eur, bike_snapshot')
                .or(`order_code.eq.${orderId},id.eq.${orderId}`)
                .limit(1)
                .maybeSingle();
            if (orderError) throw orderError;
            if (!order) return res.status(404).json({ error: 'Order not found' });

            orderCodeForNotify = order.order_code || orderId;
            const snapshot = safeJsonParse(order.bike_snapshot) || {};
            const bookingMeta = snapshot.booking_meta || {};
            const currentFinancials = snapshot.financials || bookingMeta.financials || {};

            const bikePriceEur = Number(currentFinancials.bike_price_eur || snapshot.price || snapshot.listing_price_eur || 0)
                || (Number(order.final_price_eur || 0) * 0.85);
            const rate = Number(currentFinancials.exchange_rate || snapshot.exchange_rate || 105) || 105;

            let mAgent = 0;
            if (bikePriceEur < 1500) mAgent = 250;
            else if (bikePriceEur < 3500) mAgent = 400;
            else if (bikePriceEur < 6000) mAgent = 600;
            else mAgent = bikePriceEur * 0.10;

            const fTransfer = (bikePriceEur + newShippingCost) * 0.07;
            const fWarehouse = 80;
            const fService = Math.max(0, mAgent - fWarehouse);
            newTotalEur = Number((bikePriceEur + newShippingCost + fTransfer + fWarehouse + fService).toFixed(2));
            newTotalRub = Math.ceil(newTotalEur * rate);

            const nextFinancials = {
                ...currentFinancials,
                bike_price_eur: bikePriceEur,
                shipping_cost_eur: newShippingCost,
                payment_commission_eur: Number(fTransfer.toFixed(2)),
                warehouse_fee_eur: fWarehouse,
                service_fee_eur: Number(fService.toFixed(2)),
                margin_total_eur: Number((fWarehouse + fService).toFixed(2)),
                exchange_rate: rate,
                final_price_eur: newTotalEur,
                total_price_rub: newTotalRub,
                shipping_method: method
            };

            const bookingForm = bookingMeta.booking_form || {};
            const nextSnapshot = {
                ...snapshot,
                delivery_method: method,
                financials: nextFinancials,
                booking_meta: {
                    ...bookingMeta,
                    financials: nextFinancials,
                    booking_form: {
                        ...bookingForm,
                        delivery_option: method
                    }
                }
            };

            const { error } = await supabase.from('orders')
                .update({
                    delivery_method: method,
                    shipping_cost_eur: newShippingCost,
                    payment_commission_eur: Number(fTransfer.toFixed(2)),
                    final_price_eur: newTotalEur,
                    total_price_rub: newTotalRub,
                    bike_snapshot: nextSnapshot
                })
                .eq('id', order.id);
            if (error) throw error;
        } else {
            const rows = await localDb.query(
                'SELECT id, order_code, final_price_eur, bike_snapshot FROM orders WHERE id = ? OR order_code = ? LIMIT 1',
                [orderId, orderId]
            );
            const order = rows?.[0] || null;
            if (!order) return res.status(404).json({ error: 'Order not found' });

            orderCodeForNotify = order.order_code || orderId;
            const snapshot = safeJsonParse(order.bike_snapshot) || {};
            const bookingMeta = snapshot.booking_meta || {};
            const currentFinancials = snapshot.financials || bookingMeta.financials || {};
            const bikePriceEur = Number(currentFinancials.bike_price_eur || snapshot.price || snapshot.listing_price_eur || 0)
                || (Number(order.final_price_eur || 0) * 0.85);
            const rate = Number(currentFinancials.exchange_rate || snapshot.exchange_rate || 105) || 105;

            let mAgent = 0;
            if (bikePriceEur < 1500) mAgent = 250;
            else if (bikePriceEur < 3500) mAgent = 400;
            else if (bikePriceEur < 6000) mAgent = 600;
            else mAgent = bikePriceEur * 0.10;

            const fTransfer = (bikePriceEur + newShippingCost) * 0.07;
            const fWarehouse = 80;
            const fService = Math.max(0, mAgent - fWarehouse);
            newTotalEur = Number((bikePriceEur + newShippingCost + fTransfer + fWarehouse + fService).toFixed(2));
            newTotalRub = Math.ceil(newTotalEur * rate);

            const nextFinancials = {
                ...currentFinancials,
                bike_price_eur: bikePriceEur,
                shipping_cost_eur: newShippingCost,
                payment_commission_eur: Number(fTransfer.toFixed(2)),
                warehouse_fee_eur: fWarehouse,
                service_fee_eur: Number(fService.toFixed(2)),
                margin_total_eur: Number((fWarehouse + fService).toFixed(2)),
                exchange_rate: rate,
                final_price_eur: newTotalEur,
                total_price_rub: newTotalRub,
                shipping_method: method
            };

            const bookingForm = bookingMeta.booking_form || {};
            const nextSnapshot = {
                ...snapshot,
                delivery_method: method,
                financials: nextFinancials,
                booking_meta: {
                    ...bookingMeta,
                    financials: nextFinancials,
                    booking_form: {
                        ...bookingForm,
                        delivery_option: method
                    }
                }
            };

            await localDb.query(
                'UPDATE orders SET final_price_eur = ?, bike_snapshot = ? WHERE id = ?',
                [newTotalEur, JSON.stringify(nextSnapshot), order.id]
            );
        }

        try {
            const botToken = process.env.BOT_TOKEN || process.env.MANAGER_BOT_TOKEN || '';
            const axios = require('axios');
            const targetChatId = process.env.ADMIN_CHAT_ID || '';
            if (!botToken || !targetChatId) {
                console.warn('BOT_TOKEN / ADMIN_CHAT_ID missing. Skipping Telegram notification.');
                return res.json({ success: true, method, newTotalEur, newTotalRub });
            }

            const msg = [
                '<b>????? ????????</b>',
                `?????: <b>${orderCodeForNotify}</b>`,
                `????? ?????: <b>${method}</b>`,
                `????? ????: <b>${newTotalEur.toFixed(0)}?</b> (${newTotalRub.toLocaleString('ru-RU')}?)`
            ].join('\n');

            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: targetChatId,
                text: msg,
                parse_mode: 'HTML'
            });
        } catch (e) {
            console.error('Notify Error:', e);
        }

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
