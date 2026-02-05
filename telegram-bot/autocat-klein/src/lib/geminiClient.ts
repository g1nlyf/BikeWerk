import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Load env vars safely
try {
    const envPath = path.resolve(process.cwd(), '.env');
    dotenv.config({ path: envPath });
} catch (e) {
    console.warn('Failed to load .env in GeminiClient:', e);
}

// Proxy Configuration (optional)
const PROXY_URL = process.env.GEMINI_PROXY_URL || process.env.PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

interface KeyState {
    key: string;
    label: string;
    minuteCalls: number;
    minuteTokens: number;
    dayCalls: number;
    minuteStart: number;
    dayStart: string;
    lastUsedTime: number;
    failedAttempts: number;
    projectId: number;
}

export class GeminiClient {
    private timeout = Number(process.env.GEMINI_TIMEOUT_MS || 60000);
    private cooldownMs = 1000;
    private _lastCallAt = 0;
    private lastUsedProjectIndex = 0;

    // Rate limiting per key
    // Gemini 2.0 Flash Free Tier is approx 15 RPM. We'll be conservative.
    private rpmLimit = 10;
    private tpmLimit = 1000000;
    private rpdLimit = 1400;

    private keyStates: KeyState[] = [];

    private _parseEnvKeys(): string[] {
        const keys: string[] = [];
        const addKey = (key?: string) => {
            const trimmed = (key || '').trim();
            if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
        };

        const pool = process.env.GEMINI_API_KEYS || process.env.GEMINI_KEYS;
        if (pool) {
            pool.split(/[,;|\s]+/).forEach((k) => addKey(k));
        }
        for (let i = 1; i <= 10; i++) {
            addKey(process.env[`GEMINI_API_KEY_${i}`]);
        }
        addKey(process.env.GEMINI_API_KEY);
        return keys;
    }

    private _markKeyMinuteExhausted(keyState: KeyState) {
        keyState.failedAttempts++;
        keyState.minuteCalls = this.rpmLimit;
        keyState.minuteTokens = this.tpmLimit;
        keyState.lastUsedTime = Date.now();
    }

    private _markKeyPermanentlyExhausted(keyState: KeyState) {
        keyState.failedAttempts++;
        keyState.dayCalls = this.rpdLimit;
        keyState.lastUsedTime = Date.now();
    }

    constructor() {
        const initialKeys = this._parseEnvKeys();
        if (initialKeys.length === 0) {
            console.warn('⚠️ GEMINI_API_KEYS / GEMINI_API_KEY is not set. GeminiClient has 0 keys.');
        }

        this.keyStates = initialKeys.map((key, idx) => ({
            key,
            label: `#${idx + 1}`,
            minuteCalls: 0,
            minuteTokens: 0,
            dayCalls: 0,
            minuteStart: Date.now(),
            dayStart: new Date().toDateString(),
            lastUsedTime: 0,
            failedAttempts: 0,
            projectId: 0 // Default single project
        }));

        console.log(`🤖 GeminiClient initialized with ${this.keyStates.length} keys.`);
    }

    private readonly MODELS = [
        'gemini-2.5-flash',
        'gemini-2.0-flash-exp',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
    ];

    async generateContent(prompt: string | any): Promise<string> {
        const startTime = Date.now();
        const totalTimeoutMs = Number(process.env.GEMINI_CLIENT_TOTAL_TIMEOUT_MS || process.env.GEMINI_TIMEOUT_MS || 60000);
        let contents = [];
        let customConfig = {};

        if (typeof prompt === 'string') {
            contents = [{ parts: [{ text: prompt }] }];
        } else if (Array.isArray(prompt)) {
            contents = prompt;
        } else if (prompt.contents) {
            contents = prompt.contents;
            if (prompt.generationConfig) customConfig = prompt.generationConfig;
        } else {
            // Fallback
            contents = [{ parts: [{ text: JSON.stringify(prompt) }] }];
        }

        const requestBody = {
            contents,
            generationConfig: {
                temperature: 0.1,
                topK: 1,
                topP: 1,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                ...customConfig
            }
        };

        const estTokens = this._estimateTokensFromText(JSON.stringify(contents));

        // Try models in order
        for (const model of this.MODELS) {
            const modelBaseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

            console.log(`🤖 Trying model: ${model}...`);

            const maxAttempts = Math.max(2, Math.min(this.keyStates.length, 10));
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const remainingMs = Math.max(0, totalTimeoutMs - (Date.now() - startTime));
                if (remainingMs <= 0) {
                    throw new Error('GeminiClient timeout (total budget exceeded)');
                }
                // Acquire Key
                const keyState = await this._acquireKey(estTokens, remainingMs);
                const apiKey = keyState.key;
                const keyLabel = keyState.label;

                console.log(`   🚀 [Attempt ${attempt}/${maxAttempts}] Using Key ${keyLabel} for ${model}...`);

                const fullUrl = `${modelBaseUrl}?key=${apiKey}`;
                await this._ensureCooldown();

                try {
                    const response = await axios.post(fullUrl, requestBody, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: this.timeout,
                        validateStatus: () => true,
                        httpsAgent: agent,
                        proxy: false
                    });

                    if (response.status === 200) {
                        return this.extractText(response.data);
                    }

                    if (response.status === 404) {
                        continue;
                    }
                    if (response.status === 429) {
                        const errMsg = response.data?.error?.message || '';
                        console.warn(`   ⚠️ 429 Too Many Requests on Key ${keyLabel}. ${errMsg ? `(${errMsg})` : ''}`);
                        this._markKeyMinuteExhausted(keyState);
                        continue; // Try next attempt (which will pick a new key)
                    }

                    const errMsg = response.data?.error?.message || '';
                    console.warn(`   ⚠️ Unexpected status ${response.status} on Key ${keyLabel}. ${errMsg ? `(${errMsg})` : ''}`);
                    if (response.status >= 500) {
                        await this._wait(Math.min(2000 * attempt, 8000));
                        continue;
                    }
                    if (response.status === 401 || response.status === 403) {
                        this._markKeyPermanentlyExhausted(keyState);
                    } else if (response.status >= 400) {
                        this._markKeyMinuteExhausted(keyState);
                    }

                } catch (e: any) {
                    // Axios throws for 500+ or timeout
                    if (e.response && e.response.status === 429) {
                        console.warn(`   ⚠️ 429 Quota Exceeded on Key ${keyLabel}.`);
                        this._markKeyMinuteExhausted(keyState);
                        continue; // Retry with new key
                    }
                    console.warn(`   ⚠️ Network/Axios error: ${e.message}`);
                    await this._wait(Math.min(2000 * attempt, 8000));
                }
            }
        }

        throw new Error('All models failed to generate content.');
    }

    private extractText(data: any): string {
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const textPart = parts.find((p: any) => typeof p.text === 'string');
        if (textPart && textPart.text) return textPart.text;

        const joined = parts.map((p: any) => p?.text || '').filter(Boolean).join('\n');
        if (joined) return joined;

        return '{}';
    }

    private _estimateTokensFromText(text: string): number {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }

    private async _acquireKey(estimatedTokens: number, maxWaitMs = 60000): Promise<KeyState> {
        if (this.keyStates.length === 0) {
            throw new Error('GEMINI_API_KEYS / GEMINI_API_KEY is not configured');
        }

        // Group keys by project
        const projects = new Map<number, KeyState[]>();
        for (const k of this.keyStates) {
            if (!projects.has(k.projectId)) projects.set(k.projectId, []);
            projects.get(k.projectId)?.push(k);
        }
        const projectIds = Array.from(projects.keys()).sort((a, b) => a - b);

        // Try to find a key that is ready NOW
        while (true) {
            this._updateAllWindows();

            // Project-First Round-Robin Strategy
            // We iterate through projects starting from the one AFTER the last used one
            let foundKey: KeyState | null = null;

            for (let i = 0; i < projectIds.length; i++) {
                const pIdx = (this.lastUsedProjectIndex + 1 + i) % projectIds.length;
                const pid = projectIds[pIdx];
                const projectKeys = projects.get(pid) || [];

                // Find valid keys in this project
                const validKeys = projectKeys.filter((k: KeyState) =>
                    k.minuteCalls < this.rpmLimit &&
                    (k.minuteTokens + estimatedTokens) < this.tpmLimit &&
                    k.dayCalls < this.rpdLimit
                );

                if (validKeys.length > 0) {
                    // Pick the best key in this project (LRU)
                    validKeys.sort((a: KeyState, b: KeyState) => a.lastUsedTime - b.lastUsedTime);
                    foundKey = validKeys[0];

                    // Update rotation index
                    this.lastUsedProjectIndex = pIdx;
                    break;
                }
            }

            if (foundKey) {
                foundKey.minuteCalls++;
                foundKey.minuteTokens += estimatedTokens;
                foundKey.dayCalls++;
                foundKey.lastUsedTime = Date.now();

                console.log(`[GEMINI_ROUTER] Project ${foundKey.projectId} | Key ${foundKey.label} | Status: Active`);
                return foundKey;
            }

            // 2. If no keys available, we must wait
            // Find the key that resets soonest (minute window)
            console.warn("⏳ All API keys exhausted. Waiting for quota...");
            const now = Date.now();
            let minWait = 60000;

            for (const k of this.keyStates) {
                const timeSinceStart = now - k.minuteStart;
                const wait = Math.max(1000, 60000 - timeSinceStart);
                if (wait < minWait) minWait = wait;
            }

            const waitMs = minWait + 100;
            if (maxWaitMs <= 0) {
                throw new Error('All API keys exhausted (no wait budget)');
            }
            if (waitMs > maxWaitMs) {
                await this._wait(maxWaitMs);
                throw new Error('All API keys exhausted (wait budget exceeded)');
            }
            await this._wait(waitMs);
            // Loop continues and checks again
        }
    }

    private _updateAllWindows() {
        const now = Date.now();
        const dayStr = new Date().toDateString();

        for (const k of this.keyStates) {
            // Day reset
            if (dayStr !== k.dayStart) {
                k.dayStart = dayStr;
                k.dayCalls = 0;
            }
            // Minute reset
            if (now - k.minuteStart >= 60000) {
                k.minuteStart = now;
                k.minuteCalls = 0;
                k.minuteTokens = 0;
            }
        }
    }

    private async _ensureCooldown() {
        const now = Date.now();
        const dt = now - this._lastCallAt;
        if (dt < this.cooldownMs) {
            await this._wait(this.cooldownMs - dt);
        }
        this._lastCallAt = Date.now();
    }

    private _wait(ms: number) {
        return new Promise((r) => setTimeout(r, ms));
    }
}

export const geminiClient = new GeminiClient();
