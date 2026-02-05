import axios, { AxiosInstance } from 'axios';
import { CONFIG } from '../config';
import { FetchResult } from '../types';

const getRandomUA = (): string => {
    return CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class Fetcher {
    private client: AxiosInstance;
    private lastRequestTime: Record<string, number> = {};
    private minDelay = 1500;

    constructor() {
        this.client = axios.create({
            timeout: CONFIG.DEFAULT_TIMEOUT,
            validateStatus: (status) => status < 500
        });
    }

    private async respectRateLimit(domain: string) {
        const now = Date.now();
        const last = this.lastRequestTime[domain] || 0;
        const elapsed = now - last;
        
        if (elapsed < this.minDelay) {
            await delay(this.minDelay - elapsed + Math.random() * 1000);
        }
        this.lastRequestTime[domain] = Date.now();
    }

    async fetchPage(url: string): Promise<FetchResult> {
        const domain = new URL(url).hostname;
        await this.respectRateLimit(domain);

        const start = Date.now();
        try {
            const response = await this.client.get(url, {
                headers: {
                    'User-Agent': getRandomUA(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'de,en-US;q=0.7,en;q=0.3'
                }
            });

            return {
                url,
                html: response.data,
                status: response.status,
                fetchTimeMs: Date.now() - start
            };
        } catch (error: any) {
            console.error(`Failed to fetch ${url}:`, error.message);
            throw error;
        }
    }
}

export const fetcher = new Fetcher();
