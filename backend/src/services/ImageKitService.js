const ImageKit = require('imagekit');
const fs = require('fs');
const path = require('path');

class ImageKitService {
    constructor() {
        const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || 'public_fQW/Es2t9AhCsTu9SEdbyfJZJV0=';
        const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || 'private_2lwjc219f22aIbNYf3pNUQBH9vo=';
        const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/bikewerk';
        this.enabled = Boolean(publicKey && privateKey && urlEndpoint);
        this.fallbackRoot = path.resolve(__dirname, '../../public/images');

        if (this.enabled) {
            this.imagekit = new ImageKit({
                publicKey,
                privateKey,
                urlEndpoint
            });
            console.log('🤖 [ImageKit] Service initialized');
            this.validateKeys();
        } else {
            this.imagekit = null;
            console.warn('⚠️ [ImageKit] Ключи не найдены, используется локальный фоллбек');
        }
    }

    async validateKeys() {
        if (!this.enabled) return;
        try {
            // Simple check by listing files (limit 1)
            await this.imagekit.listFiles({ limit: 1 });
            console.log('✅ [ImageKit] Connection verified');
        } catch (error) {
            console.error('❌ [ImageKit] Connection failed:', error.message);
        }
    }

    /**
     * Upload an image to ImageKit
     * @param {Buffer} buffer - Image data
     * @param {string} fileName - Target file name
     * @param {string} folder - Target folder (e.g. "/bikes/id75")
     * @returns {Promise<{url: string, fileId: string, name: string, size: number}>}
     */
    async uploadImage(buffer, fileName, folder = '/') {
        if (!buffer) throw new Error('Buffer is required');
        if (!this.enabled) {
            const normalizedFolder = String(folder || '/').replace(/^\//, '');
            const targetDir = path.join(this.fallbackRoot, normalizedFolder);
            await fs.promises.mkdir(targetDir, { recursive: true });
            const targetPath = path.join(targetDir, fileName);
            await fs.promises.writeFile(targetPath, buffer);
            const url = `/${normalizedFolder}/${fileName}`;
            return {
                url,
                fileId: null,
                name: fileName,
                size: buffer.length
            };
        }
        
        const uploadWithRetry = async (attempt = 1) => {
            try {
                const result = await this.imagekit.upload({
                    file: buffer,
                    fileName: fileName,
                    folder: folder,
                    useUniqueFileName: false, // Keep our naming convention
                    tags: ['eubike']
                });

                console.log(`✅ [ImageKit] Uploaded: ${folder}/${fileName} -> ${result.url}`);
                
                return {
                    url: result.url,
                    fileId: result.fileId,
                    name: result.name,
                    size: result.size
                };
            } catch (error) {
                if (attempt < 3) {
                    console.warn(`⚠️ [ImageKit] Upload failed (attempt ${attempt}): ${error.message}. Retrying...`);
                    await new Promise(r => setTimeout(r, 3000));
                    return uploadWithRetry(attempt + 1);
                }
                throw error;
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
        else transforms.push({ format: 'auto' }); // Default to auto format (WebP/AVIF)

        // If baseUrl is already from ImageKit, we can use the SDK or manual string manipulation
        // But SDK url() method is safer
        
        // Extract path from URL if possible, or just append query params if simpler
        // The SDK's url() method requires 'path' or 'src'.
        
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
            console.log(`🗑️ [ImageKit] Deleted file: ${fileId}`);
            return true;
        } catch (error) {
            console.error(`❌ [ImageKit] Delete failed: ${error.message}`);
            return false;
        }
    }
}

// Singleton instance
module.exports = new ImageKitService();
