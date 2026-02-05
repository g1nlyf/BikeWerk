// @ts-ignore
import { geminiClient } from './autocat-klein/dist/autocat-klein/src/lib/geminiClient.js';
import { OptimizedLLMResult, BikeData } from './types/parser.ts';
// @ts-ignore
import { optimizeHtml } from './html-optimizer.ts';

/**
 * Main function to analyze Kleinanzeigen listing with Gemini 2.0 Flash
 * Optimized for speed (Fast Pass) + Reliability (Playwright Fallback)
 */
export async function analyzeWithLLM(
  rawHtml: string, 
  url: string, 
  screenshotBase64?: string
): Promise<OptimizedLLMResult> {
  
  // 1. Optimization Phase (HTML Minification)
  const { html: optimizedHtml, size: htmlSize } = await optimizeHtml(rawHtml);
  console.log(`[analyzeWithLLM] HTML optimized: ${rawHtml.length} -> ${htmlSize} chars`);

  const screenshotPart = screenshotBase64 
    ? {
        inline_data: {
          mime_type: "image/jpeg",
          data: screenshotBase64
        }
      }
    : null;

  const systemPrompt = `
TASK: Analyze Kleinanzeigen bike listing.
MODE: Fast Pass + Playwright Fallback Decision.
OUTPUT: Strict JSON only. No markdown, no explanations.

CONTEXT:
You are an expert parser. You receive minimized HTML (and optional screenshot).
Your goal is to extract structured data AND decide if a heavy browser check (Playwright) is needed.

STRICT OUTPUT JSON SCHEMA:
{
  "stage1": {
    "data": {
       "originalUrl": "${url}",
       "brand": "string|null",
       "model": "string|null",
       "price": number|null,
       "oldPrice": number|null,
       "isNegotiable": boolean,
       "deliveryOption": "available"|"not_available"|null,
       "description": "string|null",
       "frameSize": "string|null",
       "year": number|null,
       "category": "string|null",
       "discipline": "MTB Enduro"|"MTB DH"|"MTB XC"|"MTB Trail"|"Gravel"|"Road"|"E-Bike MTB"|"MTB General"|null,
       "location": "string|null",
       "sellerName": "string|null",
       "sellerMemberSince": "string|null",
       "sellerBadges": ["string"],
       "sellerType": "string|null",
       "sourceAdId": "string|null",
       "wheelDiameter": "string|null",
       "isBike": boolean,
       "initial_quality_class": "A"|"B"|"C"|null,
       "processedByGemini": true,
       "processingDate": "ISO String",
       "processedMode": "${screenshotBase64 ? 'multimodal' : 'html_only'}",
       "isActive": boolean|null
    },
    "confidence": { "field_name": 0.0-1.0 },
    "uncertain_fields": ["field_name"],
    "needs_playwright": boolean,
    "reasons": ["string"]
  },
  "stage2": {
    // Fill ONLY if needs_playwright = true
    "playwright_plan": {
      "steps": [
        { "action": "string", "selector": "string", "description": "string", "timeout": 30000 }
      ],
      "fallbackStrategies": ["string"],
      "expectedArtifacts": ["string"]
    },
    "critical_fields": ["string"],
    "why_needed": "string"
  },
  "metadata": {
    "url": "${url}",
    "html_size": ${htmlSize},
    "timestamp": "ISO String"
  }
}

LOGIC FOR "needs_playwright": true
You MUST set needs_playwright = true if ANY of the following critical fields are NULL or missing:
1. Brand
2. Model
3. Price
4. isNegotiable (must be explicitly true/false)
5. SellerName
6. SellerBadges (if visible but failed to parse)
7. SellerMemberSince
8. WheelDiameter (if applicable to bike type)

ALSO set true if:
- Content seems to be hidden behind JS/Shadow DOM (empty containers).
- Anti-bot protection detected ("Just a moment", "Access Denied").
- Seller info is hidden behind a popup/click.

EXTRACTION RULES:
- Price: Extract integer. "1.760 €" -> 1760.
- Old Price: Look for struck-through price next to current price (e.g. "1.790 €" crossed out). Extract as integer.
- isNegotiable: Look for "VB" or "Verhandlungsbasis". If NOT present, set to false (do NOT return null).
- Wheel Diameter: LOOK CAREFULLY at Title and Description. Trigger numbers: "29", "27.5", "26", "Mullet". 
  - "29" usually means 29 inch wheels.
  - "Mullet" means mixed wheels (29 front / 27.5 rear).
  - "27.5" or "650b" means 27.5 inch.
- Seller Badges: Look for specific German UI badges like "TOP Zufriedenheit", "Freundlich", "Zuverlässig". Extract them as an array of strings.
- Location: Extract Zip Code + City (e.g. "99438 Bad Berka").
- Discipline: Infer from Brand + Model. Example: "Kona Process X" -> "MTB Enduro", "Trek Fuel EX" -> "MTB Trail".
- Frame Size: Look for "Größe L", "54cm", "RH 54", "19.5''".
- ID: Extract strictly from URL if possible.
- Quality Class (initial_quality_class):
  - "A": New, Like New, Demo bike, very low mileage (<500km), perfect condition.
  - "B": Good condition, normal signs of use, well maintained, fully functional.
  - "C": Heavy signs of use, needs service, defects described, for parts, or very old.

--- HTML START ---
${optimizedHtml}
--- HTML END ---
`;

  const parts: any[] = [{ text: systemPrompt }];
  if (screenshotPart) {
    parts.push(screenshotPart);
  }

  // Use robust client directly
  try {
    // Pass content array directly to our new client which now supports it
    const responseText = await geminiClient.generateContent({ contents: [{ parts }] });
    
    return parseOptimizedResponse(responseText, url, htmlSize);
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return a valid error structure
    return {
        stage1: {
            data: createEmptyBikeData(url, !!screenshotBase64),
            confidence: {},
            uncertain_fields: ["all"],
            needs_playwright: true,
            reasons: [`API Error: ${error instanceof Error ? error.message : String(error)}`]
        },
        metadata: {
            url,
            html_size: htmlSize,
            timestamp: new Date().toISOString()
        }
    };
  }
}

function parseOptimizedResponse(text: string, url: string, htmlSize: number): OptimizedLLMResult {
  const clean = (t: string) => t.replace(/```json/gi, '').replace(/```/g, '').trim();
  const extractFirstJsonObject = (t: string) => {
    const s = t.indexOf('{');
    if (s === -1) throw new Error('No JSON object found');
    let depth = 0;
    let inStr = false;
    let prev = '';
    for (let i = s; i < t.length; i++) {
      const ch = t[i];
      if (ch === '"' && prev !== '\\') inStr = !inStr;
      if (!inStr) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            return t.slice(s, i + 1);
          }
        }
      }
      prev = ch;
    }
    throw new Error('Unbalanced JSON braces');
  };
  try {
    const cleaned = clean(String(text || ''));
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const candidate = extractFirstJsonObject(cleaned);
      parsed = JSON.parse(candidate);
    }

    if (!parsed.stage1 || !parsed.stage1.data) {
      throw new Error('Invalid JSON structure: missing stage1.data');
    }

    parsed.metadata = {
      url,
      html_size: htmlSize,
      timestamp: new Date().toISOString(),
      ...parsed.metadata
    };
    return parsed as OptimizedLLMResult;
  } catch (e) {
    console.error('Failed to parse Gemini JSON:', e);
    console.error('Raw Text:', String(text || '').substring(0, 500) + '...');
    return {
      stage1: {
        data: createEmptyBikeData(url, false),
        confidence: {},
        uncertain_fields: ['parsing_error'],
        needs_playwright: true,
        reasons: ['JSON Parsing Failed']
      },
      metadata: {
        url,
        html_size: htmlSize,
        timestamp: new Date().toISOString()
      }
    };
  }
}

function createEmptyBikeData(url: string, hasScreenshot: boolean): BikeData {
    return {
        originalUrl: url,
        brand: null,
        model: null,
        price: null,
        isNegotiable: null,
        deliveryOption: null,
        description: null,
        frameSize: null,
        year: null,
        category: null,
        discipline: null,
        location: null,
        sellerName: null,
        sellerMemberSince: null,
        sellerBadges: [],
        sellerType: null,
        sourceAdId: null,
        wheelDiameter: null,
        isBike: true,
        initial_quality_class: null,
        processedByGemini: true,
        processingDate: new Date().toISOString(),
        processedMode: hasScreenshot ? "multimodal" : "html_only",
        isActive: null
    };
}
