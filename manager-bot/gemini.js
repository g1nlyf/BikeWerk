const { GoogleGenerativeAI } = require('@google/generative-ai');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Proxy Configuration (optional)
const PROXY_URL =
    process.env.EUBIKE_PROXY_URL ||
    process.env.MANAGER_BOT_PROXY_URL ||
    process.env.HUNTER_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.PROXY_URL ||
    '';
const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

// Gemini Configuration
const MODEL_NAME = 'gemini-3.0-pro-preview';

class GeminiVision {
    constructor(apiKey) {
        if (!apiKey) throw new Error('GEMINI_API_KEY is required');
        
        this.genAI = new GoogleGenerativeAI(apiKey, {
            fetch: (url, options) => {
                const opts = agent ? { ...options, agent } : options;
                return fetch(url, opts);
            }
        });
        this.model = this.genAI.getGenerativeModel({ model: MODEL_NAME });
    }

    async analyzeInspection(photosBuffers) {
        try {
            const prompt = `
            You are a Professional Bike Inspector.
            Analyze these photos of a bicycle. 
            1. Identify every visible defect (scratches, dents, rust, wear).
            2. Determine the groupset and its condition.
            3. Assign a Quality Grade:
               - A: Like New / Excellent (Minimale Gebrauchsspuren)
               - B: Good / Used (Normale Gebrauchsspuren)
               - C: Heavy Use / Restoration project
            
            Return JSON ONLY:
            {
                "defects": [{"part": "frame", "issue": "scratch", "severity": "minor"}],
                "groupset": "Shimano Ultegra...",
                "grade": "A" | "B" | "C",
                "summary_ru": "Short summary in Russian for the client"
            }
            `;

            const images = photosBuffers.map(buffer => ({
                inlineData: {
                    data: buffer.toString('base64'),
                    mimeType: 'image/jpeg'
                }
            }));

            const result = await this.model.generateContent([prompt, ...images]);
            const response = result.response;
            const text = response.text();
            
            // Clean markdown if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (e) {
            console.error('Gemini Inspection Error:', e);
            return null;
        }
    }

    async analyzeChat(screenshotBuffer) {
        try {
            const prompt = `
            You are a Negotiation Assistant.
            Read this chat screenshot between a buyer (us) and a seller.
            Extract:
            1. The Final Agreed Price (if any).
            2. The Seller's Name/Platform.
            3. The current sentiment (positive/negative/neutral).
            
            Return JSON ONLY:
            {
                "final_price": number | null,
                "currency": "EUR",
                "seller_name": "string",
                "success": boolean,
                "summary_ru": "Short summary of the deal status"
            }
            `;

            const image = {
                inlineData: {
                    data: screenshotBuffer.toString('base64'),
                    mimeType: 'image/jpeg'
                }
            };

            const result = await this.model.generateContent([prompt, image]);
            const response = result.response;
            const text = response.text();
            
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (e) {
            console.error('Gemini Chat Analysis Error:', e);
            return null;
        }
    }
}

module.exports = GeminiVision;
