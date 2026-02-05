const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { HttpsProxyAgent } = require('https-proxy-agent');

const DEFAULT_PROXY_URL = '';

class ImageHandler {
    constructor(imageDir = '../backend/public/images/bikes') {
        // Use __dirname for stability
        this.imageDir = path.resolve(__dirname, imageDir);
        this.maxImages = Number(process.env.IMAGE_MAX_COUNT || 0);
        this.maxFileSize = Number(process.env.IMAGE_MAX_FILE_SIZE || 20 * 1024 * 1024);
        this.allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        this.disableResize = String(process.env.IMAGE_DISABLE_RESIZE ?? 'true').toLowerCase() === 'true';
        this.disableConvert = String(process.env.IMAGE_DISABLE_CONVERT ?? 'true').toLowerCase() === 'true';
        this.outputFormat = (process.env.IMAGE_OUTPUT_FORMAT || 'webp').toLowerCase();
        this.quality = Number(process.env.IMAGE_QUALITY || 85);
        this.maxWidth = Number(process.env.IMAGE_MAX_WIDTH || 800);
        this.maxHeight = Number(process.env.IMAGE_MAX_HEIGHT || 600);

        this.proxyUrl =
            process.env.EUBIKE_PROXY_URL ||
            process.env.HUNTER_PROXY_URL ||
            process.env.HTTPS_PROXY ||
            process.env.HTTP_PROXY ||
            process.env.PROXY_URL ||
            DEFAULT_PROXY_URL;
        this.proxyAgent = this.proxyUrl ? new HttpsProxyAgent(this.proxyUrl) : undefined;
    }

    async downloadAndProcessImages(imageUrls, bikeId) {
        console.log(`🖼️ Начинаю загрузку ${imageUrls.length} изображений для велосипеда ID: ${bikeId}`);
        
        try {
            // Создаем директорию если её нет
            await this.ensureDirectoryExists();
            
            const processedImages = [];
            const limitedUrls = (this.maxImages && this.maxImages > 0) ? imageUrls.slice(0, this.maxImages) : imageUrls;
            
            for (let i = 0; i < limitedUrls.length; i++) {
                try {
                    const imageUrl = limitedUrls[i];
                    console.log(`📥 Загружаю изображение ${i + 1}/${limitedUrls.length}: ${imageUrl}`);
                    
                    const processedImage = await this.downloadAndProcessSingleImage(imageUrl, bikeId, i);
                    if (processedImage) {
                        processedImages.push(processedImage);
                    }
                    
                } catch (error) {
                    console.error(`❌ Ошибка обработки изображения ${i + 1}:`, error.message);
                    continue; // Продолжаем с следующим изображением
                }
            }
            
            console.log(`✅ Успешно обработано ${processedImages.length} изображений`);
            return processedImages;
            
        } catch (error) {
            console.error('❌ Ошибка при обработке изображений:', error.message);
            return [];
        }
    }

    async downloadAndProcessSingleImage(imageUrl, bikeId, index) {
        try {
            // Загружаем изображение
            const result = await this.downloadImage(imageUrl);
            const imageBuffer = result && result.buffer ? result.buffer : result; // совместимость
            const contentType = result && result.contentType ? result.contentType : null;
            
            if (!imageBuffer) {
                throw new Error('Не удалось загрузить изображение');
            }
            
            // Проверяем размер файла
            if (imageBuffer.length > this.maxFileSize) {
                console.warn(`⚠️ Изображение слишком большое (${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB), пропускаю`);
                return null;
            }
            
            // Обрабатываем изображение
            const processedBuffer = await this.processImage(imageBuffer);
            
            // Создаем папку для велосипеда по ID
            const bikeDir = path.join(this.imageDir, `id${bikeId}`);
            await fs.mkdir(bikeDir, { recursive: true });
            
            // Определяем расширение итогового файла
            let originalExt = 'jpg';
            if (contentType && contentType.startsWith('image/')) {
                originalExt = contentType.split('/')[1].toLowerCase();
                if (originalExt === 'jpeg') originalExt = 'jpg';
            } else {
                const cleanUrl = imageUrl.split('?')[0];
                const urlExt = path.extname(cleanUrl).replace('.', '').toLowerCase();
                if (['jpg', 'jpeg', 'png', 'webp'].includes(urlExt)) {
                    originalExt = urlExt === 'jpeg' ? 'jpg' : urlExt;
                }
            }

            const finalExt = this.disableConvert ? originalExt : this.outputFormat;
            const filename = `${index}.${finalExt}`;
            const filepath = path.join(bikeDir, filename);
            
            await fs.writeFile(filepath, processedBuffer);
            
            // Возвращаем веб-URL для использования в фронтенде
            const relativePath = `/images/bikes/id${bikeId}/${filename}`;
            
            console.log(`✅ Изображение сохранено: id${bikeId}/${filename}`);
            return relativePath;
            
        } catch (error) {
            console.error(`❌ Ошибка обработки изображения:`, error.message);
            return null;
        }
    }

    async downloadImage(url) {
        try {
            const candidates = (function buildCandidates(orig) {
                const out = new Set();
                out.add(orig);
                try {
                    const u = new URL(orig);
                    const rule = u.searchParams.get('rule');
                    if (rule) {
                        const hi = ['$_59.ZOOM', '$_59.FHD', '$_59.L', '$_59.ORIGINAL'];
                        for (const r of hi) { const nu = new URL(u); nu.searchParams.set('rule', r); out.add(nu.toString()); }
                        const nu2 = new URL(u); nu2.searchParams.delete('rule'); out.add(nu2.toString());
                    }
                } catch (_) {}
                return Array.from(out.values());
            })(url);
            let lastErr = null;
            let idx = 0;
            for (const candidate of candidates) {
                try {
                    idx++;
                    console.log(`🧷 [IMG][TRY ${idx}/${candidates.length}] ${candidate}`);
                    const response = await fetch(candidate, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Referer': 'https://www.kleinanzeigen.de/'
                        },
                        agent: this.proxyAgent,
                        timeout: 15000
                    });
                    console.log(`📥 [IMG][HTTP] ${response.status} ${response.statusText}`);
                    if (!response.ok) { lastErr = new Error(`HTTP ${response.status}: ${response.statusText}`); continue; }
                    const contentType = response.headers.get('content-type');
                    console.log(`🧾 [IMG][CONTENT-TYPE] ${contentType || 'unknown'}`);
                    if (!contentType || !contentType.startsWith('image/')) { lastErr = new Error(`Неверный тип контента: ${contentType}`); continue; }
                    const buffer = await response.buffer();
                    console.log(`📦 [IMG][BYTES] ${buffer.length}`);
                    return { buffer, contentType };
                } catch (e) {
                    lastErr = e;
                    continue;
                }
            }
            throw lastErr || new Error('Не удалось загрузить изображение');
        } catch (error) {
            console.error(`❌ Ошибка загрузки изображения с ${url}:`, error.message);
            return null;
        }
    }

    async processImage(imageBuffer) {
        try {
            // Если полностью отключено — вернуть оригинал
            if (this.disableResize && this.disableConvert) {
                return imageBuffer;
            }
            // Используем Sharp для обработки изображения
            let image = sharp(imageBuffer);
            
            // Получаем метаданные изображения
            const metadata = await image.metadata();
            console.log(`📊 Исходное изображение: ${metadata.width}x${metadata.height}, формат: ${metadata.format}`);
            
            // Изменяем размер если необходимо и не отключено
            if (!this.disableResize && (metadata.width > this.maxWidth || metadata.height > this.maxHeight)) {
                image = image.resize(this.maxWidth, this.maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            // Конвертация формата (если включена)
            let processedBuffer;
            if (!this.disableConvert) {
                if (this.outputFormat === 'webp') {
                    processedBuffer = await image.webp({ quality: this.quality, effort: 6 }).toBuffer();
                } else if (this.outputFormat === 'jpg' || this.outputFormat === 'jpeg') {
                    processedBuffer = await image.jpeg({ quality: this.quality }).toBuffer();
                } else if (this.outputFormat === 'png') {
                    processedBuffer = await image.png({ compressionLevel: 9 }).toBuffer();
                } else {
                    processedBuffer = await image.toBuffer();
                }
            } else {
                processedBuffer = await image.toBuffer();
            }

            if (!this.disableConvert) {
                const compressionRatio = ((imageBuffer.length - processedBuffer.length) / imageBuffer.length * 100).toFixed(1);
                console.log(`🗜️ Сжатие: ${compressionRatio}% (${(imageBuffer.length / 1024).toFixed(1)}KB → ${(processedBuffer.length / 1024).toFixed(1)}KB)`);
            } else {
                console.log(`ℹ️ Сжатие отключено. Размер: ${(processedBuffer.length / 1024).toFixed(1)}KB`);
            }

            return processedBuffer;
            
        } catch (error) {
            console.error('❌ Ошибка обработки изображения:', error.message);
            throw error;
        }
    }

    async ensureDirectoryExists() {
        try {
            await fs.access(this.imageDir);
        } catch (error) {
            console.log(`📁 Создаю директорию: ${this.imageDir}`);
            await fs.mkdir(this.imageDir, { recursive: true });
        }
    }

    async deleteImagesForBike(bikeId) {
        try {
            const bikeDir = path.join(this.imageDir, `id${bikeId}`);
            await fs.rm(bikeDir, { recursive: true, force: true });
        } catch (_) {}
    }

    async cleanupOldImages(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 дней по умолчанию
        try {
            const entries = await fs.readdir(this.imageDir, { withFileTypes: true });
            const now = Date.now();
            let deletedCount = 0;
            
            for (const entry of entries) {
                const entryPath = path.join(this.imageDir, entry.name);
                if (entry.isDirectory()) {
                    const subFiles = await fs.readdir(entryPath);
                    for (const sub of subFiles) {
                        const filePath = path.join(entryPath, sub);
                        const stats = await fs.stat(filePath);
                        if (now - stats.mtime.getTime() > maxAge) {
                            await fs.unlink(filePath);
                            deletedCount++;
                            console.log(`🗑️ Удален старый файл: ${path.join(entry.name, sub)}`);
                        }
                    }
                } else {
                    const stats = await fs.stat(entryPath);
                    if (now - stats.mtime.getTime() > maxAge) {
                        await fs.unlink(entryPath);
                        deletedCount++;
                        console.log(`🗑️ Удален старый файл: ${entry.name}`);
                    }
                }
            }
            
            if (deletedCount > 0) {
                console.log(`✅ Очистка завершена: удалено ${deletedCount} файлов`);
            }
            
        } catch (error) {
            console.error('❌ Ошибка очистки старых изображений:', error.message);
        }
    }

    generatePlaceholderImage(bikeData) {
        // Возвращаем placeholder изображение в зависимости от категории
        const placeholders = {
            'Горный': 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400',
            'Шоссейный': 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400',
            'Городской': 'https://images.unsplash.com/photo-1544191696-15693072b5a7?w=400',
            'Электро': 'https://images.unsplash.com/photo-1502744688674-c619d1586c9e?w=400',
            'BMX': 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400',
            'Детский': 'https://images.unsplash.com/photo-1544191696-15693072b5a7?w=400'
        };
        
        return placeholders[bikeData.category] || placeholders['Городской'];
    }

    async getImageStats() {
        try {
            const entries = await fs.readdir(this.imageDir, { withFileTypes: true });
            let totalSize = 0;
            let count = 0;

            for (const entry of entries) {
                const entryPath = path.join(this.imageDir, entry.name);
                if (entry.isDirectory()) {
                    const subFiles = await fs.readdir(entryPath);
                    for (const sub of subFiles) {
                        const isImage = this.allowedFormats.some(format => sub.toLowerCase().endsWith(`.${format}`));
                        if (isImage) {
                            count++;
                            const stats = await fs.stat(path.join(entryPath, sub));
                            totalSize += stats.size;
                        }
                    }
                } else {
                    const isImage = this.allowedFormats.some(format => entry.name.toLowerCase().endsWith(`.${format}`));
                    if (isImage) {
                        count++;
                        const stats = await fs.stat(entryPath);
                        totalSize += stats.size;
                    }
                }
            }

            return {
                count,
                totalSize,
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                directory: this.imageDir
            };
            
        } catch (error) {
            console.error('❌ Ошибка получения статистики изображений:', error.message);
            return null;
        }
    }
}

module.exports = ImageHandler;
