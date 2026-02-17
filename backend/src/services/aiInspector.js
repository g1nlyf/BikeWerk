const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = process.env.GEMINI_API_URL || '';
const GEMINI_MODEL = process.env.GEMINI_INSPECTOR_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';
const GEMINI_REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS || 45000);
const GEMINI_FALLBACK_MODELS = String(
    process.env.GEMINI_FALLBACK_MODELS || 'gemini-2.5-pro,gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-pro,gemini-1.5-flash'
)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

const SYSTEM_PROMPT = `
Системный промпт: «AI Senior Bike Inspector»
Твоя роль: Ты — независимый эксперт по оценке подержанных велосипедов премиального сегмента. Твоя задача — сравнить первичные данные объявления с новыми фактами, полученными от продавца.

Вводные данные:

Original listing: Фото и текст, на основе которых был присвоен initial_quality_class.

Inspection data: Новые фотографии (узлы, царапины, серийный номер) и ответы продавца (пробег, дата последнего ТО, наличие трещин).

Твои приоритеты:

Честность важнее продажи. Если ты видишь риск (например, подозрение на трещину в карбоне или износ трансмиссии > 80%), ты обязан снизить класс.

Объективность. Царапины на лаке — это Класс B. Трещина в раме — это Класс C. Идеальное состояние — это Класс A.

Алгоритм решения:

Проанализируй новые фото на предмет скрытых дефектов, которые не были видны в объявлении.

Сравни выявленное состояние с initial_quality_class.

Если состояние хуже — присвой новый final_quality_class.

Сформируй Вердикт для клиента (2-3 предложения).

Требования к стилю вердикта:

Никакой воды. Только факты.

Стиль: Профессиональный, спокойный, помогающий.

Пример вердикта (Класс сохранен): «Мы получили дополнительные фото узлов. Трансмиссия в отличном состоянии, следов падений не обнаружено. Подтверждаем Класс А.»

Пример вердикта (Класс снижен): «При детальном осмотре выявлены глубокие царапины на пере рамы и износ цепи выше среднего. Это соответствует Классу B. У вас активировано право на возврат задатка.»

Выходной формат (JSON): { "final_class": "A|B|C", "confidence_score": 0-100, "expert_comment": "текст вердикта", "degradation_detected": true/false }
`;

function buildGeminiEndpointCandidates() {
    const endpoints = [];
    if (GEMINI_API_URL && typeof GEMINI_API_URL === 'string') {
        endpoints.push(GEMINI_API_URL.trim());
    }

    const models = Array.from(new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]));
    const versions = Array.from(new Set([GEMINI_API_VERSION, 'v1beta', 'v1']));

    for (const version of versions) {
        for (const model of models) {
            endpoints.push(`https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`);
        }
    }

    return Array.from(new Set(endpoints.filter(Boolean)));
}

async function callGeminiWithFallback(payload) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is missing');
    }

    const endpoints = buildGeminiEndpointCandidates();
    let lastError = null;

    for (const endpoint of endpoints) {
        try {
            const response = await axios.post(`${endpoint}?key=${GEMINI_API_KEY}`, payload, {
                timeout: GEMINI_REQUEST_TIMEOUT_MS
            });
            return response;
        } catch (error) {
            const msg = error?.response?.data?.error?.message || error?.message || 'Unknown Gemini error';
            lastError = new Error(`[${endpoint}] ${msg}`);

            const status = Number(error?.response?.status || 0);
            const retryable = status === 404 || status === 429 || status >= 500;
            if (!retryable) break;
        }
    }

    throw lastError || new Error('Gemini request failed');
}

class AIInspectorService {
    async inspectBike(data) {
        console.log('AI Inspector processing data...');
        
        // Prepare parts for Gemini
        const parts = [
            { text: SYSTEM_PROMPT },
            { text: `Original Listing Data: ${JSON.stringify(data.originalListing, null, 2)}` },
            { text: `Seller Answers: ${JSON.stringify(data.newInspection.sellerAnswers, null, 2)}` }
        ];

        // Process new inspection images (handle base64)
        if (data.newInspection.images && Array.isArray(data.newInspection.images)) {
            for (const img of data.newInspection.images) {
                if (typeof img === 'string' && img.startsWith('data:image/')) {
                    const matches = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        parts.push({
                            inline_data: {
                                mime_type: matches[1],
                                data: matches[2]
                            }
                        });
                    }
                } else {
                    // Assuming URL, just pass as text for now
                    parts.push({ text: `Inspection Image URL: ${img}` });
                }
            }
        }

        try {
            const response = await callGeminiWithFallback({
                contents: [{ parts }],
                generationConfig: {
                    response_mime_type: "application/json"
                }
            });

            const candidates = response.data?.candidates;
            if (!candidates || !candidates.length) {
                throw new Error('No candidates returned from Gemini');
            }

            const textResponse = candidates[0].content.parts[0].text;
            console.log('Gemini Response:', textResponse);

            // Parse JSON
            let result;
            try {
                result = JSON.parse(textResponse);
            } catch (e) {
                // Fallback for markdown json
                const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                result = JSON.parse(cleanJson);
            }

            return result;

        } catch (error) {
            const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
            console.error('AI Inspector Error:', errorMessage);
            // Fallback mock response in case of error
            return {
                final_class: data.originalListing.initial_quality_class || 'B',
                confidence_score: 0,
                expert_comment: `Ошибка AI анализа: ${errorMessage}. Требуется ручная проверка экспертом.`,
                degradation_detected: false
            };
        }
    }
}

const aiInspector = new AIInspectorService();
module.exports = { AIInspectorService, aiInspector };
