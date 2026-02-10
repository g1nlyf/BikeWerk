const ImageKit = require('imagekit');
const fs = require('fs');
const path = require('path');

class ImageKitService {
    constructor() {
        // SECURITY: never ship fallback keys in repo; require env configuration.
        const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || '';
        const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || '';
        const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || '';
        this.enabled = Boolean(publicKey && privateKey && urlEndpoint);
        this.fallbackRoot = path.resolve(__dirname, '../../public/images');

        if (this.enabled) {
            this.imagekit = new ImageKit({
                publicKey,
                privateKey,
                urlEndpoint
            });
            console.log('[ImageKit] Service initialized');
            this.validateKeys();
        } else {
            this.imagekit = null;
            console.warn('[ImageKit] Keys are missing, using local fallback storage');
        }
    }

    async validateKeys() {
        if (!this.enabled) return;
        try {
            await this.imagekit.listFiles({ limit: 1 });
            console.log('[ImageKit] Connection verified');
        } catch (error) {
            console.error('[ImageKit] Connection failed:', error.message);
        }
    }

    async writeLocalFallback(buffer, fileName, folder = '/') {
        const normalizedFolder = String(folder || '/').replace(/^\//, '');
        const targetDir = path.join(this.fallbackRoot, normalizedFolder);
        await fs.promises.mkdir(targetDir, { recursive: true });
        const targetPath = path.join(targetDir, fileName);
        await fs.promises.writeFile(targetPath, buffer);
        return {
            url: `/images/${normalizedFolder}/${fileName}`,
            fileId: null,
            name: fileName,
            size: buffer.length,
            storage: 'local'
        };
    }

    /**
     * Upload an image to ImageKit
     * @param {Buffer} buffer - Image data
     * @param {string} fileName - Target file name
     * @param {string} folder - Target folder (e.g. "/bikes/id75")
     * @returns {Promise<{url: string, fileId: string|null, name: string, size: number, storage?: string}>}
     */
    async uploadImage(buffer, fileName, folder = '/') {
        if (!buffer) throw new Error('Buffer is required');

        if (!this.enabled) {
            return this.writeLocalFallback(buffer, fileName, folder);
        }

        const uploadWithRetry = async (attempt = 1) => {
            try {
                const result = await this.imagekit.upload({
                    file: buffer,
                    fileName,
                    folder,
                    useUniqueFileName: false,
                    tags: ['eubike']
                });

                return {
                    url: result.url,
                    fileId: result.fileId,
                    name: result.name,
                    size: result.size,
                    storage: 'imagekit'
                };
            } catch (error) {
                if (attempt < 3) {
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    return uploadWithRetry(attempt + 1);
                }
                console.warn(`[ImageKit] Upload failed after retries, falling back to local: ${error.message}`);
                return this.writeLocalFallback(buffer, fileName, folder);
            }
        };

        return uploadWithRetry();
    }

    /**
     * Generate a transformed URL
     * @param {string} baseUrl - Original URL
     * @param {Object} options - Transformation options
     * @returns {string}
     */
    generateTransformedUrl(baseUrl, options = {}) {
        if (!this.enabled || !this.imagekit) return baseUrl;
        const transforms = [];

        if (options.width) transforms.push({ width: options.width });
        if (options.height) transforms.push({ height: options.height });
        if (options.quality) transforms.push({ quality: options.quality });
        if (options.format) transforms.push({ format: options.format });
        else transforms.push({ format: 'auto' });

        return this.imagekit.url({
            src: baseUrl,
            transformation: transforms
        });
    }

    /**
     * Delete an image
     * @param {string} fileId
     */
    async deleteImage(fileId) {
        if (!this.enabled || !this.imagekit) return false;
        try {
            await this.imagekit.deleteFile(fileId);
            console.log(`[ImageKit] Deleted file: ${fileId}`);
            return true;
        } catch (error) {
            console.error(`[ImageKit] Delete failed: ${error.message}`);
            return false;
        }
    }
}

module.exports = new ImageKitService();
