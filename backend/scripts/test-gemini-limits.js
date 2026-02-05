
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPaths = [
    path.resolve(__dirname, '../../telegram-bot/.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env')
];

let loaded = false;
for (const p of envPaths) {
    const result = dotenv.config({ path: p });
    if (!result.error) {
        console.log(`✅ Loaded env from: ${p}`);
        loaded = true;
        // Don't break, maybe we need to merge multiple? 
        // Usually first win or last win depending on implementation, but dotenv doesn't override by default.
        // Let's just break if we found one with keys.
        if (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY) break;
    }
}

if (!loaded) console.warn('⚠️ No .env file loaded successfully.');


// --- Mocking KeyState interface in JS ---
/**
 * @typedef {Object} KeyState
 * @property {string} key
 * @property {string} label
 * @property {number} minuteCalls
 * @property {number} minuteTokens
 * @property {number} dayCalls
 * @property {number} minuteStart
 * @property {string} dayStart
 * @property {number} lastUsedTime
 * @property {number} failedAttempts
 * @property {number} projectId
 */

class GeminiClient {
    constructor() {
        this.timeout = Number(process.env.GEMINI_TIMEOUT_MS || 60000);
        this.cooldownMs = 1000;
        this._lastCallAt = 0;
        this.lastUsedProjectIndex = 0;
        this.rpmLimit = 10;
        this.tpmLimit = 1000000;
        this.rpdLimit = 1400;
        this.keyStates = [];
        
        this.MODELS = [
            'gemini-2.5-flash'
        ];

        this.init();
    }

    init() {
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

    _parseEnvKeys() {
        const pool = process.env.GEMINI_API_KEYS || process.env.GEMINI_KEYS || process.env.GEMINI_API_KEY || '';
        return pool.split(/[,;|\s]+/).filter(Boolean);
    }

    _markKeyMinuteExhausted(keyState) {
        keyState.failedAttempts++;
        keyState.minuteCalls = this.rpmLimit;
        keyState.minuteTokens = this.tpmLimit;
        keyState.lastUsedTime = Date.now();
    }

    _markKeyPermanentlyExhausted(keyState) {
        keyState.failedAttempts++;
        keyState.dayCalls = this.rpdLimit;
        keyState.lastUsedTime = Date.now();
    }

    async generateContent(prompt) {
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
                
                let keyState;
                try {
                    keyState = await this._acquireKey(estTokens, remainingMs);
                } catch (e) {
                    // Re-throw acquire errors (like timeout)
                    throw e;
                }
                
                const apiKey = keyState.key;
                const keyLabel = keyState.label;
                
                console.log(`   🚀 [Attempt ${attempt}/${maxAttempts}] Using Key ${keyLabel} for ${model}...`);

                const fullUrl = `${modelBaseUrl}?key=${apiKey}`;
                await this._ensureCooldown();

                try {
                    const response = await axios.post(fullUrl, requestBody, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: this.timeout,
                        validateStatus: (status) => status < 500
                    });

                    if (response.status === 200) {
                        return this.extractText(response.data);
                    }

                    if (response.status === 429) {
                        const errMsg = response.data?.error?.message || '';
                        console.warn(`   ⚠️ 429 Too Many Requests on Key ${keyLabel}. ${errMsg ? `(${errMsg})` : ''}`);
                        this._markKeyMinuteExhausted(keyState);
                        continue; 
                    }

                    const errMsg = response.data?.error?.message || '';
                    console.warn(`   ⚠️ Unexpected status ${response.status} on Key ${keyLabel}. ${errMsg ? `(${errMsg})` : ''}`);
                    if (response.status === 401 || response.status === 403) {
                        this._markKeyPermanentlyExhausted(keyState);
                    } else if (response.status >= 400) {
                        this._markKeyMinuteExhausted(keyState);
                    }
                
                } catch (e) {
                    if (e.response && e.response.status === 429) {
                        console.warn(`   ⚠️ 429 Quota Exceeded on Key ${keyLabel}.`);
                        this._markKeyMinuteExhausted(keyState);
                        continue; 
                    }
                    console.warn(`   ⚠️ Network/Axios error: ${e.message}`);
                }
            }
        }

        throw new Error('All models failed to generate content.');
    }

    extractText(data) {
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const textPart = parts.find((p) => typeof p.text === 'string');
        if (textPart && textPart.text) return textPart.text;
        
        const joined = parts.map((p) => p?.text || '').filter(Boolean).join('\n');
        if (joined) return joined;
        
        return '{}';
    }

    _estimateTokensFromText(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }

    async _acquireKey(estimatedTokens, maxWaitMs = 60000) {
        if (this.keyStates.length === 0) {
            throw new Error('GEMINI_API_KEYS / GEMINI_API_KEY is not configured');
        }
        
        // Group keys by project
        const projects = new Map();
        for (const k of this.keyStates) {
            if (!projects.has(k.projectId)) projects.set(k.projectId, []);
            projects.get(k.projectId).push(k);
        }
        const projectIds = Array.from(projects.keys()).sort((a, b) => a - b);

        while (true) {
            this._updateAllWindows();

            let foundKey = null;

            for (let i = 0; i < projectIds.length; i++) {
                const pIdx = (this.lastUsedProjectIndex + 1 + i) % projectIds.length;
                const pid = projectIds[pIdx];
                const projectKeys = projects.get(pid) || [];

                const validKeys = projectKeys.filter(k => 
                    k.minuteCalls < this.rpmLimit && 
                    (k.minuteTokens + estimatedTokens) < this.tpmLimit &&
                    k.dayCalls < this.rpdLimit
                );

                if (validKeys.length > 0) {
                    validKeys.sort((a, b) => a.lastUsedTime - b.lastUsedTime);
                    foundKey = validKeys[0];
                    this.lastUsedProjectIndex = pIdx;
                    break;
                }
            }

            if (foundKey) {
                foundKey.minuteCalls++;
                foundKey.minuteTokens += estimatedTokens;
                foundKey.dayCalls++;
                foundKey.lastUsedTime = Date.now();
                
                // console.log(`[GEMINI_ROUTER] Project ${foundKey.projectId} | Key ${foundKey.label} | Status: Active`);
                return foundKey;
            }

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
        }
    }

    _updateAllWindows() {
        const now = Date.now();
        const dayStr = new Date().toDateString();

        for (const k of this.keyStates) {
            if (dayStr !== k.dayStart) {
                k.dayStart = dayStr;
                k.dayCalls = 0;
            }
            if (now - k.minuteStart >= 60000) {
                k.minuteStart = now;
                k.minuteCalls = 0;
                k.minuteTokens = 0;
            }
        }
    }

    async _ensureCooldown() {
        const now = Date.now();
        const dt = now - this._lastCallAt;
        if (dt < this.cooldownMs) {
            await this._wait(this.cooldownMs - dt);
        }
        this._lastCallAt = Date.now();
    }

    _wait(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
}

// --- Test Logic ---
const geminiClient = new GeminiClient();

async function testLimits() {
    console.log('🚀 Starting Gemini Limit Test (Standalone JS)...');
    console.log(`🔑 Available Keys: ${geminiClient.keyStates.length}`);
    
    // Check if timeout is set
    const timeout = process.env.GEMINI_CLIENT_TOTAL_TIMEOUT_MS;
    console.log(`ℹ️ GEMINI_CLIENT_TOTAL_TIMEOUT_MS: ${timeout || 'NOT SET (Default 8000)'}`);

    const requestCount = 5; // Start with small count to test connection
    const promises = [];
    const results = { success: 0, failed: 0, errors: [] };

    console.log(`⚡ Sending ${requestCount} sequential requests...`);

    for (let i = 0; i < requestCount; i++) {
        try {
            console.log(`   Req ${i+1}...`);
            const res = await geminiClient.generateContent(`Just say "Hello ${i+1}" in json`);
            console.log(`   ✅ Req ${i+1} Success.`);
            results.success++;
        } catch (e) {
            console.error(`   ❌ Req ${i+1} Failed: ${e.message}`);
            results.failed++;
            results.errors.push(e.message);
        }
        // Small delay
        await new Promise(r => setTimeout(r, 200)); 
    }

    console.log('\n📊 Test Results:');
    console.log(`   Success: ${results.success}`);
    console.log(`   Failed:  ${results.failed}`);
    
    if (results.failed > 0) {
        console.log('\n🔍 Error Analysis:');
        const uniqueErrors = [...new Set(results.errors)];
        uniqueErrors.forEach(err => console.log(`   - ${err}`));
    }
}

testLimits().catch(console.error);
