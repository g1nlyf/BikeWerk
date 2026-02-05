import { Pool } from 'pg';
import { FinalJson } from '../types';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { promisify } from 'util';
import * as stream from 'stream';

const pipeline = promisify(stream.pipeline);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

export class StorageService {
    private imageDir: string;
    private isOffline = false;

    constructor() {
        this.imageDir = path.resolve(__dirname, '../../../../images');
        if (!fs.existsSync(this.imageDir)) {
            fs.mkdirSync(this.imageDir, { recursive: true });
        }
    }

    async init() {
        // Ensure table exists (idempotent)
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS detected_listings (
                    id SERIAL PRIMARY KEY,
                    source_id TEXT UNIQUE,
                    content_hash TEXT,
                    title TEXT,
                    price NUMERIC,
                    brand TEXT,
                    url TEXT,
                    raw_data JSONB,
                    score NUMERIC,
                    status TEXT DEFAULT 'pending', -- pending, draft, published, rejected
                    local_images TEXT[],
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            
        } catch (e: any) {
            
            this.isOffline = true;
        }
    }

    async saveListing(data: FinalJson, score: number, status: 'draft' | 'published'): Promise<void> {
        // 1. Download Images
        const localImages = await this.downloadImages(data.images, data.sourceAdId || 'unknown');
        
        // Update data with local paths
        data.localImages = localImages;

        if (this.isOffline) {
            
            return;
        }

        const query = `
            INSERT INTO detected_listings 
            (source_id, title, price, brand, url, raw_data, score, status, local_images, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (source_id) 
            DO UPDATE SET 
                price = EXCLUDED.price,
                raw_data = EXCLUDED.raw_data,
                score = EXCLUDED.score,
                status = CASE 
                    WHEN detected_listings.status = 'published' THEN 'published' -- Don't unpublish
                    ELSE EXCLUDED.status 
                END,
                local_images = EXCLUDED.local_images,
                updated_at = NOW();
        `;

        const values = [
            data.sourceAdId || data.originalUrl, // Fallback ID
            data.model || "Unknown Bike",
            data.price,
            data.brand,
            data.originalUrl,
            JSON.stringify(data),
            score,
            status,
            localImages
        ];

        try {
            await pool.query(query, values);
            console.log(`Saved listing ${data.sourceAdId} as ${status} with ${localImages.length} images`);
        } catch (err) {
            console.error("DB Save Error:", err);
            throw err;
        }
    }

    private async downloadImages(urls: string[] | undefined, adId: string): Promise<string[]> {
        if (!urls || urls.length === 0) return [];

        const localPaths: string[] = [];
        // Limit to 5 images
        const toDownload = urls.slice(0, 5);

        for (let i = 0; i < toDownload.length; i++) {
            const url = toDownload[i];
            const ext = path.extname(url).split('?')[0] || '.jpg';
            const filename = `${adId}_${i}${ext}`;
            const filepath = path.join(this.imageDir, filename);

            try {
                // Check if exists
                if (fs.existsSync(filepath)) {
                    localPaths.push(filepath);
                    continue;
                }

                const response = await axios.get(url, { responseType: 'stream' });
                await pipeline(response.data, fs.createWriteStream(filepath));
                localPaths.push(filepath);
                // Be nice
                await new Promise(r => setTimeout(r, 200));
            } catch (e: any) {
                console.warn(`Failed to download image ${url}: ${e.message}`);
            }
        }

        return localPaths;
    }

    async close() {
        if (!this.isOffline) {
            await pool.end();
        }
    }

    get offline(): boolean {
        return this.isOffline;
    }
}

export const storage = new StorageService();
