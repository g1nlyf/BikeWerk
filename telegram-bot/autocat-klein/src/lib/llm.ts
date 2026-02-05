import { geminiClient } from './geminiClient';
import { LLMFastPassResult, ParsedCandidates, PlaywrightPlan, FinalJson } from '../types';

export class LLMService {
    
    async fastPass(
        htmlSnippet: string, 
        url: string, 
        candidates: ParsedCandidates
    ): Promise<LLMFastPassResult> {
        const systemPrompt = `
        You are a specialized data extraction engine for bicycle classifieds (Kleinanzeigen). 
        Your goal is to extract structured JSON data matching the FinalJson interface.
        
        Rules:
        1. Output ONLY valid JSON. No markdown, no text explanations outside JSON.
        2. Use "Europe/Berlin" timezone for dates.
        3. If a field is missing/unknown, set it to null.
        4. "brand" must be normalized (e.g., "Specialized" not "Specialized Bikes").
        5. "price" should be a number (EUR).
        6. "processedMode" is "html-only".
        7. "processedByGemini" is true.
        8. "processingDate" is current ISO time.

        REQUIRED OUTPUT STRUCTURE:
        {
          "data": {
             "originalUrl": "...",
             "brand": "...",
             "model": "...",
             "price": 1234,
             "description": "...",
             "frameSize": "...",
             "year": 2020,
             "category": "...",
             "location": "...",
             "processedByGemini": true,
             "processedMode": "html-only",
             "isActive": true,
             ... other fields
          },
          "confidence": { "brand": 0.9, "price": 1.0 },
          "uncertain_fields": [],
          "needs_playwright": false,
          "reasons": []
        }
        `;

        const userPrompt = `
        Analyze this listing:
        URL: ${url}
        
        Pre-extracted candidates (hints):
        ${JSON.stringify(candidates, null, 2)}

        HTML Snippet (Partial):
        ${htmlSnippet}

        Instructions:
        - Extract specific bike details (frame size, wheel diameter, model year).
        - Determine if delivery is available.
        - Assess confidence (0-1) for each major field (price, brand, model).
        - If critical info is missing or ambiguous (like hidden price or unclear model), set "needs_playwright": true.
        - ENSURE "data" property exists in the root of JSON.
        `;

        try {
            const text = await geminiClient.generateContent(systemPrompt + "\n" + userPrompt);
            const cleanJson = this.cleanJson(text);
            let result: any;
            try {
                result = JSON.parse(cleanJson);
            } catch (e) {
                throw new Error('Failed to parse JSON from LLM response');
            }

            // Normalize structure if model forgot "data" wrapper
            if (!result.data && (result.brand || result.model || result.price || result.llmFastPassResult)) {
                if (result.llmFastPassResult) {
                     // Sometimes it wraps in llmFastPassResult
                     result = result.llmFastPassResult;
                }
                
                if (!result.data) {
                    // It returned data directly
                    result = {
                        data: result,
                        confidence: {},
                        uncertain_fields: [],
                        needs_playwright: false,
                        reasons: ["Structure normalized by client"]
                    };
                }
            }

            return result as LLMFastPassResult;

        } catch (error) {
            // console.error("LLM FastPass failed:", error);
            return {
                data: {},
                confidence: {},
                uncertain_fields: ["all"],
                needs_playwright: true,
                reasons: ["LLM execution error"]
            };
        }
    }

    async generatePlaywrightPlan(url: string, issueDescription: string): Promise<PlaywrightPlan> {
        const prompt = `
        I need a Playwright automation plan to scrape a Kleinanzeigen ad that failed simple parsing.
        URL: ${url}
        Issue: ${issueDescription}

        Return a JSON object with "steps" (array of actions) and "fallbackStrategies".
        Actions: click, waitForSelector, screenshot, extract.
        Selectors should be robust.
        
        Example structure:
        {
          "steps": [
            {"action":"click", "selector":"#gdpr-banner-accept", "notes":"accept cookies"},
            {"action":"waitForSelector", "selector":".ad-price"}
          ],
          "fallbackStrategies": ["reload"]
        }
        `;

        try {
            const text = await geminiClient.generateContent(prompt);
            return JSON.parse(this.cleanJson(text));
        } catch (e) {
            return {
                steps: [
                    { action: "waitForSelector", selector: "body", timeout: 5000 },
                    { action: "screenshot", name: "fallback_capture" },
                    { action: "extract", selectors: ["body"] }
                ],
                fallbackStrategies: []
            };
        }
    }

    private cleanJson(text: string): string {
        // Remove markdown code blocks if present
        return text.replace(/```json/g, '').replace(/```/g, '').trim();
    }
}

export const llmService = new LLMService();
