const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const axios = require('axios');
const sharp = require('sharp');
const { HttpsProxyAgent } = require('https-proxy-agent');
const imageKitService = require('./ImageKitService');

const DEFAULT_PROXY_URL = 'http://user258350:otuspk@191.101.73.161:8984';

class PhotoManager {
    constructor(options = {}) {
        this.baseDir = options.baseDir || path.resolve(__dirname, '../../public/images/bikes');
        this.tmpDir = options.tmpDir || path.join(os.tmpdir(), 'eubike-images');
        this.timeoutMs = options.timeoutMs || 30000;
        this.retryCount = options.retryCount ?? 2;
        this.minBytes = options.minBytes || 10 * 1024;
        this.maxWidth = options.maxWidth || 1200;
        this.quality = options.quality || 70;
        this.allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
        this.proxyUrl =
            process.env.EUBIKE_PROXY_URL ||
            process.env.HTTPS_PROXY ||
            process.env.HTTP_PROXY ||
            process.env.PROXY_URL ||
            DEFAULT_PROXY_URL;
        this.proxyAgent = this.proxyUrl ? new HttpsProxyAgent(this.proxyUrl) : undefined;
        this.imagekitService = imageKitService;
    }

    static _filterValidUrls(urls) {
        return urls.filter(url => {
            const lower = String(url).toLowerCase();
            if (!lower) return false;
            if (!lower.startsWith('http')) return false;
            if (lower.includes('.svg')) return false;
            if (lower.includes('/icons/')) return false;
            if (lower.includes('/icon/')) return false;
            if (lower.includes('placeholder')) return false;
            if (lower.includes('buycyclebwhite')) return false;
            if (lower.includes('logo')) return false;
            return true;
        });
    }

    async downloadAndSave(bikeId, imageUrls) {
        const urls = Array.from(new Set((imageUrls || []).map((u) => String(u || '').trim()).filter(Boolean)));
        if (urls.length === 0) return [];

        const results = [];
        for (let index = 0; index < urls.length; index++) {
            const url = urls[index];
            const result = await this.downloadSingle(url, bikeId, index);
            results.push({ ...result, position: index });
        }
        return results;
    }

    async downloadSingle(url, bikeId, index) {
        let attempts = 0;
        let lastError = null;
        const totalAttempts = (this.retryCount ?? 0) + 1;
        while (attempts < totalAttempts) {
            attempts += 1;
            try {
                const downloadStarted = Date.now();
                const downloaded = await this.fetchToTemp(url);
                const downloadTimeMs = Date.now() - downloadStarted;
                if (!downloaded || !downloaded.buffer) {
                    throw new Error('download_empty');
                }

                const originalSizeBytes = downloaded.buffer.length;
                const validation = this.validateImage(downloaded.buffer, downloaded.contentType);
                if (!validation.ok) {
                    throw new Error(validation.reason || 'invalid_image');
                }

                const optimizeStarted = Date.now();
                const optimized = await this.optimizeImage(downloaded.buffer);
                const optimizeTimeMs = Date.now() - optimizeStarted;
                const optimizedSizeBytes = optimized?.buffer?.length ?? null;
                const ext = (optimized.format || validation.format || this.inferExt(url, downloaded.contentType) || 'jpg').replace('jpeg', 'jpg');
                const fileName = `photo_${index + 1}.${ext}`;
                const folder = `/bikes/id${bikeId}`;
                
                const uploadStarted = Date.now();
                const uploaded = await this.imagekitService.uploadImage(
                    optimized.buffer,
                    fileName,
                    folder
                );
                const uploadTimeMs = Date.now() - uploadStarted;
                
                await this.safeRemove(downloaded.tempPath);

                const optimizationRatio = originalSizeBytes && optimizedSizeBytes
                    ? Math.max(0, Math.round((1 - optimizedSizeBytes / originalSizeBytes) * 1000) / 10)
                    : null;

                return {
                    image_url: url,
                    local_path: uploaded.url, // ImageKit URL
                    is_downloaded: 1,
                    download_attempts: attempts,
                    download_failed: 0,
                    width: optimized.width ?? null,
                    height: optimized.height ?? null,
                    file_id: uploaded.fileId,
                    download_time_ms: downloadTimeMs,
                    upload_time_ms: uploadTimeMs,
                    optimize_time_ms: optimizeTimeMs,
                    original_size_bytes: originalSizeBytes,
                    optimized_size_bytes: optimizedSizeBytes,
                    optimization_ratio: optimizationRatio,
                    format: ext
                };
            } catch (e) {
                lastError = e;
                const is404 = String(e.message || '').includes('404');
                // If 404, no need to retry
                if (is404) {
                    console.log(`   ❌ Photo permanently unavailable (404): ${url}`);
                    break;
                }
                console.error(`   ⚠️ Download/Upload failed (attempt ${attempts}): ${e.message}`);
                continue;
            }
        }

        // Fallback logic
        return {
            image_url: url,
            local_path: url, // Fallback to original URL
            is_downloaded: 0,
            download_attempts: attempts,
            download_failed: 1,
            width: null,
            height: null,
            error: String(lastError?.message || lastError || 'download_failed'),
            download_time_ms: null,
            upload_time_ms: null,
            optimize_time_ms: null,
            original_size_bytes: null,
            optimized_size_bytes: null,
            optimization_ratio: null,
            format: null
        };
    }

    async fetchToTemp(url) {
        // We no longer need temp file on disk for processing, but keeping buffer logic
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: this.timeoutMs,
            httpsAgent: this.proxyAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });
        const buffer = Buffer.from(response.data);
        return { tempPath: null, buffer, contentType: response.headers['content-type'] };
    }

    validateImage(buffer, contentType) {
        if (!buffer || buffer.length < this.minBytes) {
            return { ok: false, reason: 'too_small' };
        }
        // Normalize content-type (remove params like charset)
        const ct = String(contentType || '').toLowerCase().split(';')[0].trim();
        
        if (ct.includes('image/svg') || this.bufferLooksLikeSvg(buffer)) {
            return { ok: false, reason: 'svg_blocked' };
        }
        if (ct && !this.allowedTypes.has(ct)) {
            return { ok: false, reason: `unsupported_type (${ct})` };
        }
        const format = ct.startsWith('image/') ? ct.split('/')[1] : null;
        return { ok: true, format };
    }

    bufferLooksLikeSvg(buffer) {
        try {
            const head = buffer.slice(0, 512).toString('utf8').toLowerCase();
            return head.includes('<svg');
        } catch {
            return false;
        }
    }

    async optimizeImage(buffer) {
        try {
            const image = sharp(buffer, { failOnError: false });
            const metadata = await image.metadata();
            const resized = image.resize({ width: this.maxWidth, withoutEnlargement: true });
            const out = await resized.webp({ quality: this.quality }).toBuffer();
            return { buffer: out, format: 'webp', width: metadata.width, height: metadata.height };
        } catch {
            return { buffer, format: null, width: null, height: null };
        }
    }

    inferExt(url, contentType) {
        const ct = String(contentType || '').toLowerCase();
        if (ct.startsWith('image/')) return ct.split('/')[1];
        try {
            const clean = String(url || '').split('?')[0];
            const ext = path.extname(clean).replace('.', '').toLowerCase();
            return ext || null;
        } catch {
            return null;
        }
    }

    async safeRemove(filePath) {
        if (!filePath) return;
        try {
            await fsp.rm(filePath, { force: true });
        } catch {}
    }
}

module.exports = PhotoManager;
