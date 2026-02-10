const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const imageKitService = require('../src/services/ImageKitService');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';
const DRY_RUN = String(process.env.DRY_RUN || 'true') !== 'false';
const MAX_ORDERS = Math.max(1, Number(process.env.MAX_ORDERS || 500));
const MAX_IMAGES_PER_ORDER = Math.max(1, Number(process.env.MAX_IMAGES_PER_ORDER || 2));
const DOWNLOAD_TIMEOUT_MS = Math.max(3000, Number(process.env.DOWNLOAD_TIMEOUT_MS || 10000));
const DOWNLOAD_MAX_BYTES = Math.max(512 * 1024, Number(process.env.DOWNLOAD_MAX_BYTES || 8 * 1024 * 1024));
const REPORT_SAMPLE_LIMIT = Math.max(1, Number(process.env.REPORT_SAMPLE_LIMIT || 100));

function parseSnapshot(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw !== 'string') return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function asStringArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value
            .filter((v) => typeof v === 'string')
            .map((v) => v.trim())
            .filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
}

function safeSlug(input) {
    return String(input || 'order').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

function isImageKitUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    try {
        const host = new URL(rawUrl).hostname.toLowerCase();
        return host === 'ik.imagekit.io' || host.endsWith('.imagekit.io');
    } catch {
        return false;
    }
}

function isSafeExternalImageUrl(rawUrl) {
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

function extractImageUrls(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return [];
    const all = [];
    const push = (value) => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(push);
            return;
        }
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!trimmed) return;
        all.push(trimmed);
    };

    push(snapshot.main_photo_url);
    push(snapshot.main_image);
    push(snapshot.image_url);
    push(snapshot.image);
    push(snapshot.photos);
    push(snapshot.images);
    push(snapshot.gallery);
    push(snapshot.image_urls);

    return Array.from(new Set(all)).filter((url) => isSafeExternalImageUrl(url));
}

async function downloadImage(url) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: DOWNLOAD_TIMEOUT_MS,
        maxContentLength: DOWNLOAD_MAX_BYTES,
        maxBodyLength: DOWNLOAD_MAX_BYTES,
        headers: {
            'User-Agent': 'EUBikeLegacyBackfill/1.0',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        },
        validateStatus: (statusCode) => statusCode >= 200 && statusCode < 400
    });

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
        throw new Error('not-an-image');
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

function buildDurableSnapshot(order, snapshot, cachedImages) {
    const normalizedCached = Array.from(new Set(asStringArray(cachedImages))).slice(0, MAX_IMAGES_PER_ORDER);
    return {
        ...snapshot,
        bike_id: snapshot?.bike_id || (order?.bike_id != null ? String(order.bike_id) : null),
        bike_url: snapshot?.bike_url || order?.bike_url || null,
        external_bike_ref: snapshot?.external_bike_ref || snapshot?.listing_id || snapshot?.bike_url || order?.bike_url || null,
        cached_images: normalizedCached
    };
}

async function main() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error('SUPABASE_URL/SUPABASE key is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_code, bike_id, bike_url, bike_snapshot, created_at')
        .order('created_at', { ascending: false })
        .limit(MAX_ORDERS);

    if (error) throw error;

    const report = {
        generated_at: new Date().toISOString(),
        dry_run: DRY_RUN,
        imagekit_enabled: Boolean(imageKitService && imageKitService.enabled),
        scanned_orders: 0,
        orders_without_snapshot: 0,
        orders_missing_cached_images: 0,
        orders_with_existing_cached_images: 0,
        orders_with_source_images: 0,
        uploaded_images: 0,
        planned_uploads: 0,
        updated_orders: 0,
        planned_updates: 0,
        skipped_orders: 0,
        sample: [],
        failures: []
    };

    for (const order of orders || []) {
        report.scanned_orders += 1;

        const snapshot = parseSnapshot(order.bike_snapshot);
        if (!snapshot || typeof snapshot !== 'object') {
            report.orders_without_snapshot += 1;
            report.skipped_orders += 1;
            continue;
        }

        const existingCached = Array.from(new Set(asStringArray(snapshot.cached_images)));
        if (existingCached.length) {
            report.orders_with_existing_cached_images += 1;
        } else {
            report.orders_missing_cached_images += 1;
        }

        const sourceUrls = extractImageUrls(snapshot).slice(0, MAX_IMAGES_PER_ORDER);
        if (!sourceUrls.length) {
            report.skipped_orders += 1;
            continue;
        }
        report.orders_with_source_images += 1;

        const nextCached = [...existingCached];
        let fileIndex = 0;
        const orderLabel = safeSlug(order.order_code || order.id);

        for (const sourceUrl of sourceUrls) {
            if (nextCached.length >= MAX_IMAGES_PER_ORDER) break;
            if (nextCached.includes(sourceUrl)) continue;

            if (isImageKitUrl(sourceUrl)) {
                nextCached.push(sourceUrl);
                continue;
            }

            if (DRY_RUN) {
                fileIndex += 1;
                report.planned_uploads += 1;
                nextCached.push(`dry-run://orders/${orderLabel}/img-${fileIndex}.jpg`);
                continue;
            }

            try {
                const { buffer, extension } = await downloadImage(sourceUrl);
                fileIndex += 1;
                const uploaded = await imageKitService.uploadImage(
                    buffer,
                    `img-${fileIndex}.${extension}`,
                    `/orders/${orderLabel}`
                );
                if (uploaded?.url) {
                    nextCached.push(uploaded.url);
                    report.uploaded_images += 1;
                }
            } catch (uploadError) {
                report.failures.push({
                    order_id: order.id,
                    order_code: order.order_code,
                    source_url: sourceUrl,
                    stage: 'upload',
                    error: String(uploadError.message || uploadError)
                });
            }
        }

        const durableSnapshot = buildDurableSnapshot(order, snapshot, nextCached);
        const snapshotChanged = JSON.stringify(durableSnapshot) !== JSON.stringify(snapshot);

        if (snapshotChanged && DRY_RUN) {
            report.planned_updates += 1;
            if (report.sample.length < REPORT_SAMPLE_LIMIT) {
                report.sample.push({
                    order_id: order.id,
                    order_code: order.order_code,
                    existing_cached_images: existingCached,
                    next_cached_images: durableSnapshot.cached_images,
                    external_bike_ref: durableSnapshot.external_bike_ref
                });
            }
            continue;
        }

        if (!snapshotChanged) {
            report.skipped_orders += 1;
            continue;
        }

        const { error: updateError } = await supabase
            .from('orders')
            .update({ bike_snapshot: durableSnapshot })
            .eq('id', order.id);

        if (updateError) {
            report.failures.push({
                order_id: order.id,
                order_code: order.order_code,
                stage: 'update',
                error: String(updateError.message || updateError)
            });
            continue;
        }

        report.updated_orders += 1;
        if (report.sample.length < REPORT_SAMPLE_LIMIT) {
            report.sample.push({
                order_id: order.id,
                order_code: order.order_code,
                existing_cached_images: existingCached,
                next_cached_images: durableSnapshot.cached_images,
                external_bike_ref: durableSnapshot.external_bike_ref
            });
        }
    }

    const outputDir = path.resolve(__dirname, '../test-outputs');
    await fs.promises.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'backfill-cached-images-report.json');
    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`[backfill_cached_images] report=${outputPath}`);
    console.log(`[backfill_cached_images] dry_run=${report.dry_run} scanned=${report.scanned_orders} planned_updates=${report.planned_updates} updated=${report.updated_orders} uploaded=${report.uploaded_images}`);
}

main().catch((error) => {
    console.error('[backfill_cached_images] Failed:', error.message);
    process.exit(1);
});