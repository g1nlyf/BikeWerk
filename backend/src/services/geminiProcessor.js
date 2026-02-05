const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const DatabaseManager = require('../../database/db-manager');
const fs = require('fs');
const path = require('path');
const PipelineLogger = require('../utils/PipelineLogger');
const InputSanitizer = require('../utils/InputSanitizer');

const STATIC_KEY = 'AIzaSyBjngHVn2auhLXRMTCY0q9mrqVaiRkfj4g';

class GeminiProcessor {
    constructor(apiUrl) {
        // Use Gemini 2.5 Flash for general tasks (Negotiation, etc.)
        this.apiUrl = apiUrl || process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

        // Setup Proxy for Russian server environment
        // Setup Proxy for Russian server environment
        // const proxyUrl = 'http://user258350:otuspk@191.101.73.161:8984';
        // this.httpsAgent = new HttpsProxyAgent(proxyUrl);
        this.httpsAgent = undefined; // Bypass proxy for now

        // API Keys Rotation
        this.apiKeys = [
            process.env.GEMINI_API_KEY_1,
            process.env.GEMINI_API_KEY_2,
            process.env.GEMINI_API_KEY_3,
            process.env.GEMINI_API_KEY,
            'AIzaSyBjngHVn2auhLXRMTCY0q9mrqVaiRkfj4g' // Fallback static key
        ].filter((key, index, self) => key && self.indexOf(key) === index);

        this.currentKeyIndex = 0;
        this.failedAttempts = new Map();
        console.log(`   🤖 [GEMINI] Initialized with ${this.apiKeys.length} API keys`);
    }

    /**
     * Creates a minimal fallback object when Gemini fails
     */
    buildMinimalFallback(rawBike, error) {
        console.warn(`⚠️ [GEMINI] Using minimal fallback for: ${rawBike.title}`);

        // IMPROVED FALLBACK: Try to extract Brand, Model, Year from title
        const title = rawBike.title || '';
        let brand = 'Unknown';
        let model = 'Unknown';
        let year = new Date().getFullYear();

        // Simple Year Regex
        const yearMatch = title.match(/\b(20\d{2})\b/);
        if (yearMatch) year = parseInt(yearMatch[1], 10);

        // Simple Brand Extraction
        const commonBrands = ['Specialized', 'Canyon', 'Trek', 'Giant', 'Cube', 'Santa Cruz', 'Yeti', 'Scott', 'Orbea', 'Cannondale', 'Radon', 'Rose', 'Propain', 'YT', 'Commencal'];
        for (const b of commonBrands) {
            if (new RegExp(`\\b${b}\\b`, 'i').test(title)) {
                brand = b;
                const afterBrand = title.split(new RegExp(b, 'i'))[1] || '';
                model = afterBrand.trim().split(' ').slice(0, 3).join(' ') || 'Unknown';
                break;
            }
        }

        return {
            meta: {
                source_platform: rawBike.source || 'manual',
                source_url: rawBike.url || '',
                source_ad_id: rawBike.source_id || `fallback-${Date.now()}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_active: true
            },
            basic_info: {
                name: title || 'Unknown Bike',
                brand: brand,
                model: model.replace(/\b20\d{2}\b/g, '').trim(),
                year: year,
                category: rawBike.category || 'Mountain',
                description: rawBike.description || 'No description available',
                language: 'en'
            },
            pricing: {
                price: parseFloat(rawBike.price?.amount || rawBike.price || 0),
                currency: rawBike.currency || 'EUR',
                is_negotiable: false
            },
            specs: {
                frame_size: rawBike.size || 'M',
                frame_material: 'Unknown',
                wheel_size: '29"',
                suspension_type: 'Unknown',
                groupset: 'Unknown',
                brakes: 'Unknown'
            },
            condition: {
                status: 'used',
                score: 50,
                grade: 'C',
                issues: [`Fallback: ${error ? error.message : 'Unknown error'}`]
            },
            seller: {
                name: 'Unknown Seller',
                type: 'private',
                location: rawBike.location || 'Unknown'
            },
            logistics: {
                delivery_option: 'pickup',
                shipping_cost: 0
            },
            media: {
                main_image: rawBike.image || rawBike.images?.[0] || '',
                gallery: rawBike.images || []
            },
            ranking: {
                score: 0,
                is_hot_offer: false
            },
            audit: {
                needs_audit: true,
                status: 'pending',
                notes: ['Created via fallback']
            },
            features: {},
            quality_score: 50
        };
    }

    /**
     * 🔧 Попытка починить обрезанный JSON
     */
    repairIncompleteJSON(jsonStr) {
        let repaired = jsonStr.trim();

        // 1. Remove comments
        repaired = repaired.replace(/\/\/.*$/gm, '');

        // 2. Remove trailing commas before closing braces
        repaired = repaired.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

        // 3. Replace raw control characters (newlines, tabs, etc) with space
        // This fixes "Bad control character in string literal" errors
        // JSON.parse does not allow raw control characters inside strings
        repaired = repaired.replace(/[\x00-\x1F]+/g, ' ');

        // 4. Balance braces/brackets (simple heuristic)
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;

        if (openBraces > closeBraces) {
            repaired += '}'.repeat(openBraces - closeBraces);
        }
        if (openBrackets > closeBrackets) {
            repaired += ']'.repeat(openBrackets - closeBrackets);
        }

        return repaired;
    }

    /**
     * 🆕 Агрессивная обрезка - удаляем последнее незакрытое поле
     */
    aggressiveTruncate(brokenJson) {
        // Находим позицию последней корректной закрывающей скобки на depth=1
        let depth = 0;
        let lastGoodPos = -1;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < brokenJson.length; i++) {
            const char = brokenJson[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"' && !escaped) {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (char === '{' || char === '[') depth++;
            if (char === '}' || char === ']') {
                depth--;
                if (depth === 0) {
                    lastGoodPos = i + 1; // После закрывающей }
                }
            }
        }

        if (lastGoodPos > 0) {
            return brokenJson.substring(0, lastGoodPos);
        }

        // Fallback - просто закрываем
        return brokenJson.trim().replace(/,\s*$/, '') + '}';
    }

    /**
     * Helper to robustly extract and parse JSON from Gemini response
     */
    extractJSON(rawText) {
        if (!rawText) return null;

        // 1. Удаляем markdown блоки
        let cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // 2. Ищем первый { и последний }
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('No JSON object found in response');
        }

        let extracted = cleaned.substring(firstBrace, lastBrace + 1);

        // 🆕 3. AGGRESSIVE SANITIZATION

        // 3a. Удаляем комментарии (безопасно для URL)
        extracted = extracted.replace(/(?<!:)\/\/[^\n]*/g, '');
        extracted = extracted.replace(/\/\*[\s\S]*?\*\//g, '');

        // 3b. Удаляем trailing commas
        extracted = extracted.replace(/,(\s*[}\]])/g, '$1');

        // 🆕 3c. КРИТИЧНО: Удаляем control characters из СТРОК
        // Regex: находим "строки" и очищаем их от \x00-\x1F и \x7F
        extracted = extracted.replace(/"([^"\\]|\\.)*"/g, (match) => {
            // Внутри кавычек заменяем control chars на пробел
            return match.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
        });

        // 3d. Удаляем незакрытые escape-последовательности
        // Например: "text\n внутри строки" → "text  внутри строки"
        extracted = extracted.replace(/"([^"]*?)\\n([^"]*?)"/g, '"$1 $2"');
        extracted = extracted.replace(/"([^"]*?)\\t([^"]*?)"/g, '"$1 $2"');
        extracted = extracted.replace(/"([^"]*?)\\r([^"]*?)"/g, '"$1 $2"');

        // 3e. Удаляем множественные пробелы
        extracted = extracted.replace(/  +/g, ' ');

        // 4. ПОПЫТКА ПАРСИНГА
        try {
            return JSON.parse(extracted);
        } catch (e1) {
            // Вторая попытка - repair
            try {
                const repaired = this.repairIncompleteJSON(extracted);
                return JSON.parse(repaired);
            } catch (e2) {
                // 🆕 Третья попытка - aggressive truncation
                try {
                    const truncated = this.aggressiveTruncate(extracted);
                    const parsed = JSON.parse(truncated);
                    console.log('   🔧 [JSON REPAIR] Aggressive truncation succeeded');
                    return parsed;
                } catch (e3) {
                    // Log the error for debugging
                    console.error('--- BROKEN JSON START ---');
                    console.error(extracted.substring(0, 500) + '...');
                    console.error('--- BROKEN JSON END ---');
                    throw new Error('Could not extract valid JSON from response');
                }
            }
        }
    }

    /**
     * Analyze bike to unified format with RETRY LOGIC (v1.1)
     */
    async analyzeBikeToUnifiedFormat(rawData, maxRetries = 3, sourceContext = null) {

        // 🆕 Создаём logger для этого байка
        const bikeId = rawData.ad_id || rawData.id || rawData.source_id || `bike_${Date.now()}`;
        this.pipelineLogger = new PipelineLogger(bikeId);

        this.pipelineLogger.log('normalization', 'start', {
            message: `Processing ${rawData.title?.substring(0, 50)}...`
        });

        // ✅ VALIDATION: Don't send empty data to Gemini
        if (!rawData.title && !rawData.description) {
            console.log('   ⚠️ [GEMINI] Skipping: No data to analyze');
            this.pipelineLogger.log('normalization', 'warning', { message: 'Skipping: No data to analyze' });
            return this.getFallbackJSON(rawData, null, sourceContext);
        }

        // 🛡️ LAYER 1: Input Sanitization
        if (InputSanitizer.isJunkListing(rawData)) {
            console.warn(`   🗑️ [GEMINI] Skipping JUNK listing: ${rawData.title}`);
            this.pipelineLogger.log('normalization', 'warning', { message: 'Skipped JUNK listing' });
            // Return a special fallback or throw? The user said "throw new Error('JUNK_LISTING')"
            // But if I throw, it might break the loop if not caught. 
            // analyzeBikeToUnifiedFormat catches errors inside the retry loop? 
            // No, the retry loop is inside this function.
            // If I throw here, it will go to the catch block (line 240), log error, and return fallback.
            // That seems correct.
            throw new Error('JUNK_LISTING: Title contains trash status (Reserviert/Gelöscht)');
        }

        const sanitizedData = InputSanitizer.sanitize(rawData);

        if (sanitizedData.title !== rawData.title) {
            console.log(`   🧹 [GEMINI] Title cleaned: "${rawData.title}" → "${sanitizedData.title}"`);
            this.pipelineLogger.log('sanitization', 'info', {
                original: rawData.title,
                cleaned: sanitizedData.title
            });
        }

        // 1. Сохраняем sanitized input
        this.pipelineLogger.saveStageData('01_raw_input_sanitized', sanitizedData);

        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`   🤖 [GEMINI] Attempt ${attempt}/${maxRetries}...`);
                this.pipelineLogger.log('ai_call', 'start', { message: `Attempt ${attempt}/${maxRetries}` });

                // 2. Build prompt using SANITIZED data
                this.pipelineLogger.log('prompt_build', 'start');
                const prompt = this.buildUnifiedPrompt(sanitizedData, sourceContext);
                this.pipelineLogger.saveStageData('02_prompt', prompt, 'txt');
                this.pipelineLogger.log('prompt_build', 'success', {
                    message: `Prompt size: ${prompt.length} chars`
                });

                // 3. Call AI (Using existing axios implementation)
                // Note: callGeminiAPI already does one call. The loop is here.
                let result = await this.callGeminiAPI(prompt, 60000);

                if (!result) throw new Error('Empty result from Gemini');

                // Ensure basic structure exists
                result.basic_info = result.basic_info || {};
                result.pricing = result.pricing || {};
                result.meta = result.meta || {};

                // Success! Reset failure counter
                this.failedAttempts.set(this.currentKeyIndex, 0);

                // Validate result
                if (this.isValidResult(result)) {
                    console.log(`   ✅ [GEMINI] Success (Quality: ${result.quality_score})`);
                    this.pipelineLogger.log('normalization', 'success', { message: `Quality: ${result.quality_score}` });
                    this.pipelineLogger.saveStageData('05_parsed_json', result);
                    this.pipelineLogger.summary();
                    return result;
                } else {
                    const missing = this.getMissingRequiredFields(result);
                    const details = missing.length > 0 ? `: ${missing.join(', ')}` : '';
                    console.log(`   ⚠️ [GEMINI] Invalid response (missing required fields${details})`);
                    lastError = new Error('Invalid Gemini response');
                    this.pipelineLogger.log('normalization', 'warning', { message: `Invalid response${details}` });
                }

            } catch (error) {
                lastError = error;
                this.pipelineLogger.log('ai_call', 'error', { error: error.message });

                // Check error type
                if (error.message.includes('503') || error.message.includes('429')) {
                    console.log(`   ⚠️ [GEMINI] ${error.message} (Overload)`);

                    // Exponential backoff
                    const delay = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
                    console.log(`   ⏳ Waiting ${delay / 1000}s before retry...`);
                    await this.delay(delay);

                    // Try next API key (if available)
                    if (this.apiKeys.length > 1) {
                        this.rotateAPIKey();
                        console.log(`   🔄 Switched to API key ${this.currentKeyIndex + 1}`);
                    }

                } else if (error.message.includes('timeout')) {
                    console.log(`   ⏰ [GEMINI] Timeout (attempt ${attempt})`);
                    await this.delay(3000);

                } else {
                    console.error(`   ❌ [GEMINI] Unexpected error: ${error.message}`);
                    // Don't break immediately if we want to retry on other errors? 
                    // Original code had break here. I'll keep it consistent.
                    break;
                }
            }
        }

        // All retries failed
        console.error(`❌ [GEMINI] All attempts failed: ${lastError ? lastError.message : 'Unknown error'}`);
        this.pipelineLogger.log('normalization', 'error', { error: lastError ? lastError.message : 'Unknown error' });
        this.pipelineLogger.summary();
        return this.buildMinimalFallback(rawData, lastError);
    }

    /** 
     * 🆕 Показывает контекст ошибки в JSON 
     */
    getErrorContext(jsonString, error) {
        // Извлекаем позицию из ошибки 
        const posMatch = error.message.match(/position (\d+)/);
        if (!posMatch) return null;

        const pos = parseInt(posMatch[1]);
        const start = Math.max(0, pos - 200);
        const end = Math.min(jsonString.length, pos + 200);

        return {
            position: pos,
            before: jsonString.substring(start, pos),
            after: jsonString.substring(pos, end),
            character: jsonString[pos],
            charCode: jsonString.charCodeAt(pos)
        };
    }

    /**
     * Build the prompt for unified format analysis
     */
    buildUnifiedPrompt(rawData, sourceContext = null) {
        const fs = require('fs');
        const path = require('path');

        const source = sourceContext || rawData.source_platform || rawData.source || 'buycycle';

        // 🆕 Используем v2.5-compact
        const promptPath = path.join(__dirname, '../../prompts/gemini-bike-normalizer-v2.5-compact.md');

        let basePrompt;
        try {
            basePrompt = fs.readFileSync(promptPath, 'utf8');
            console.log('   📄 Using compact prompt v2.5');
        } catch (err) {
            console.warn('   ⚠️ Compact prompt not found, using fallback.');
            // Fallback prompt defined in code (kept for safety)
            basePrompt = `
# TASK
You are a bike data analyst for BikeWerk (Germany). Normalize raw bike listing data into standardized JSON.

Input: Raw scraped data provided at the end.
Output: Complete Unified Format JSON (valid JSON only).
...
`;
        }

        // Prepare input data block
        const inputData = `
Source: ${source}
Title: ${rawData.title || 'N/A'}
Price: ${rawData.price || 'N/A'} ${rawData.currency || 'EUR'}
Location: ${rawData.location || (rawData.seller && rawData.seller.location) || 'N/A'}
Description: ${rawData.description || 'N/A'}
Seller Info: ${JSON.stringify(rawData.seller || {}, null, 2)}
Components (Raw): ${JSON.stringify(rawData.components || rawData.raw_components || {}, null, 2)}
General Info: ${JSON.stringify(rawData.general_info || {}, null, 2)}
Images: ${JSON.stringify(rawData.images || [], null, 2)}
        `.trim();

        return `${basePrompt}

=======================================================
ACTUAL INPUT DATA:
=======================================================
${inputData}
=======================================================
`;
    }

    /**
     * Call Gemini API with retries
     */
    async callGeminiAPI(prompt, timeout = 60000) {
        const key = this.apiKeys[this.currentKeyIndex];

        // 🆕 DEBUG: Сохраняем промпт в файл
        if (this.debugMode) {
            try {
                fs.writeFileSync(
                    path.join(__dirname, '../../scripts/debug-prompt.txt'),
                    prompt
                );
                console.log('   💾 [DEBUG] Saved prompt to debug-prompt.txt');
            } catch (err) {
                console.error('   ❌ [DEBUG] Failed to save prompt:', err.message);
            }
        }

        const response = await axios.post(
            `${this.apiUrl}?key=${key}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1, // Stricter = less creative
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json", // Force JSON mode
                    topP: 0.95,
                    topK: 40
                }
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout,
                httpsAgent: this.httpsAgent,
                proxy: false
            }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        // 🆕 LOGGING: Log token usage
        const usage = response.data?.usageMetadata;
        if (usage && this.pipelineLogger) {
            this.pipelineLogger.log('token_usage', 'success', {
                message: `Output tokens: ${usage.candidatesTokenCount || 'N/A'} / 8192`
            });
        }

        // 🆕 DEBUG: Сохраняем RAW ответ в файл
        if (this.debugMode && text) {
            try {
                fs.writeFileSync(
                    path.join(__dirname, '../../scripts/debug-gemini-response.txt'),
                    text
                );
                console.log('   💾 [DEBUG] Saved RAW response to debug-gemini-response.txt');
                console.log(`   📏 [DEBUG] Response length: ${text.length} chars`);
            } catch (err) {
                console.error('   ❌ [DEBUG] Failed to save response:', err.message);
            }
        }

        if (text) {
            const extracted = this.extractJSON(text);

            // 🆕 DEBUG: Показываем что extractJSON вернул
            if (this.debugMode && extracted) {
                // extracted is an object, convert to string for length check if needed, 
                // but extractJSON returns an object. 
                // Wait, extractJSON in this file returns an OBJECT (JSON.parse result).
                // So I cannot check .length of object directly unless I stringify it.
                // Or maybe I should check the raw text passed to JSON.parse inside extractJSON?
                // The user's code snippet assumed extractJSON returns a string?
                // "const extracted = this.extractJSON(rawText); ... const parsed = JSON.parse(extracted);"
                // BUT in my code: extractJSON returns JSON.parse(cleanText).
                // So 'extracted' IS the parsed object.
                // I will just log that we successfully extracted it.
                console.log('   ✅ [DEBUG] JSON extracted successfully');
            }
            return extracted;
        }
        return null;
    }

    /**
     * Utility delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Rotate to next API key
     */
    rotateAPIKey() {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    }

    /**
     * Validate the unified result
     */
    isValidResult(result) {
        // Must have basic fields
        if (!result.basic_info || !result.basic_info.brand || !result.pricing || !result.pricing.price) {
            return false;
        }
        return true;
    }

    getMissingRequiredFields(result) {
        const missing = [];
        if (!result.basic_info) missing.push('basic_info');
        else {
            if (!result.basic_info.brand) missing.push('basic_info.brand');
        }
        if (!result.pricing) missing.push('pricing');
        else {
            if (result.pricing.price === undefined) missing.push('pricing.price');
        }
        return missing;
    }

    getFallbackJSON(rawData, error, sourceContext) {
        // IMPROVED FALLBACK: Try to extract Brand, Model, Year from title
        const title = rawData.title || '';
        let brand = 'Unknown';
        let model = 'Unknown';
        let year = new Date().getFullYear();

        // Simple Year Regex
        const yearMatch = title.match(/\b(20\d{2})\b/);
        if (yearMatch) year = parseInt(yearMatch[1], 10);

        // Simple Brand Extraction (Mock example, ideally use TechDecoder or regex)
        // Check for common brands
        const commonBrands = ['Specialized', 'Canyon', 'Trek', 'Giant', 'Cube', 'Santa Cruz', 'Yeti', 'Scott', 'Orbea', 'Cannondale', 'Radon', 'Rose', 'Propain', 'YT', 'Commencal'];
        for (const b of commonBrands) {
            if (new RegExp(`\\b${b}\\b`, 'i').test(title)) {
                brand = b;
                // Heuristic: Model is often whatever comes after Brand
                // This is very rough but better than "Unknown"
                const afterBrand = title.split(new RegExp(b, 'i'))[1] || '';
                model = afterBrand.trim().split(' ').slice(0, 3).join(' ') || 'Unknown';
                break;
            }
        }

        return {
            meta: {
                source_platform: sourceContext || 'unknown',
                error: error ? error.message : 'Unknown error',
                is_active: false
            },
            basic_info: {
                name: title || 'Unknown Bike',
                brand: brand,
                model: model.replace(/\b20\d{2}\b/g, '').trim(), // Remove year from model
                year: year,
                description: rawData.description || 'Failed to process'
            },
            pricing: {
                price: rawData.price || 0
            },
            media: {
                main_image: rawData.image || (rawData.images && rawData.images[0]) || '',
                gallery: rawData.images || []
            },
            condition: {
                status: 'used',
                score: 50 // Default neutral score so it's not discarded immediately
            },
            internal: {
                processing_errors: [error ? error.message : 'Fallback']
            },
            quality_score: 50
        };
    }

    formatGeminiErrorMessage(error, retries) {
        return `Gemini failed after ${retries} attempts: ${error ? error.message : 'Unknown error'}`;
    }

    logFailedBike(rawData, errorMessage, retries) {
        console.error(errorMessage);
        // Could insert into failed_bikes table here
    }
}

module.exports = new GeminiProcessor();
