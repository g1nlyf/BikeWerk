
import { BikeData } from './types/parser';

export interface AssessmentResult {
  condition_class: 'A' | 'B' | 'C';
  condition_confidence: 'high' | 'medium' | 'low';
  condition_rationale: string;
  condition_checklist: string[]; // List of specific checks needed
  data_source_summary: DataSourceSummary;
}

export interface DataSourceSummary {
  photo_count: number;
  has_transmission_photo: boolean;
  has_fork_stanchions_photo: boolean;
  has_frame_closeups: boolean;
  description_length: number;
  has_service_history: boolean;
  is_negotiable: boolean;
  detected_defects_keywords: string[];
}

/**
 * Analyzes bike condition based on listing data (Logic-First approach).
 * 1. Calculates Data Sufficiency (Code)
 * 2. Assesses Risk (LLM)
 * 3. Synthesizes Result
 */
export async function analyzeCondition(
  bikeData: BikeData,
  imageUrls: string[],
  geminiClient: any
): Promise<AssessmentResult> {
  
  // 1. Data Source Analysis (Hard Logic)
  const sourceSummary = analyzeDataSource(bikeData, imageUrls);
  
  // 2. Base Confidence Calculation
  const baseConfidence = calculateBaseConfidence(sourceSummary);

  // 3. LLM Risk Assessment
  const llmResult = await assessRiskWithLLM(bikeData, imageUrls, sourceSummary, baseConfidence, geminiClient);

  // 4. Synthesis
  // Confidence cannot be higher than baseConfidence (Code constraint)
  const finalConfidence = getMinConfidence(baseConfidence, llmResult.confidence);

  return {
    condition_class: llmResult.class,
    condition_confidence: finalConfidence,
    condition_rationale: llmResult.rationale,
    condition_checklist: llmResult.checklist,
    data_source_summary: sourceSummary
  };
}

function analyzeDataSource(bike: BikeData, images: string[]): DataSourceSummary {
  const text = (bike.description || '').toLowerCase();
  
  return {
    photo_count: images.length,
    // Heuristic: transmission usually on right side, often images 2-5
    // Real detection needs vision model, here we use conservative assumption for 'listing' stage:
    // We assume NO specific detail photos unless proven by vision (which we simulate via LLM later or placeholder)
    // For now, we rely on photo count as proxy, but in future this should be Vision API result.
    // Let's rely on LLM to confirm these boolean flags in step 2 if we passed images.
    // For "Hard Logic" now, we set them to false to force LLM to verify.
    has_transmission_photo: false, 
    has_fork_stanchions_photo: false,
    has_frame_closeups: false,
    
    description_length: text.length,
    has_service_history: /service|inspektion|wartung|überholt|neu gemacht|kette neu|bremsen neu/i.test(text),
    is_negotiable: bike.isNegotiable || false,
    detected_defects_keywords: extractDefectKeywords(text)
  };
}

function extractDefectKeywords(text: string): string[] {
  const defects = [];
  const keywords = ['kratzer', 'delle', 'riss', 'beschädigt', 'defekt', 'rost', 'spiel', 'geräusche', 'unfall'];
  for (const k of keywords) {
    if (text.includes(k)) defects.push(k);
  }
  return defects;
}

function calculateBaseConfidence(summary: DataSourceSummary): 'high' | 'medium' | 'low' {
  if (summary.photo_count < 3) return 'low';
  if (summary.photo_count < 8) return 'medium';
  // Even with many photos, if description is empty, confidence drops
  if (summary.description_length < 50) return 'medium';
  
  return 'high';
}

async function assessRiskWithLLM(
  bike: BikeData,
  images: string[],
  summary: DataSourceSummary,
  baseConfidence: string,
  geminiClient: any
): Promise<{ class: 'A'|'B'|'C', confidence: 'high'|'medium'|'low', rationale: string, checklist: string[] }> {
  
  const systemPrompt = `
ROLE: Risk Manager for Used Bikes.
TASK: Assess risk level and validate data sufficiency.
CONTEXT:
- Brand/Model: ${bike.brand} ${bike.model}
- Price: ${bike.price} EUR
- Photo Count: ${summary.photo_count}
- Description Length: ${summary.description_length} chars
- Service History Mentioned: ${summary.has_service_history}
- Detected Defect Keywords: ${summary.detected_defects_keywords.join(', ') || 'None'}
- Base Confidence (Code-calculated): ${baseConfidence.toUpperCase()}

DESCRIPTION:
"${bike.description}"

INSTRUCTIONS:
1. **Analyze Text**: Look for hidden signals (e.g., "bastler" -> Class C, "sturzfrei" -> Class A potential).
2. **Determine Class (Risk Level)**:
   - **A**: Minimal risk. Cosmetic signs of use only. No dents/cracks. Service history present or bike looks fresh.
   - **B**: Moderate risk. Worn consumables (chain, tires), minor scratches, or unknown service history but bike looks solid.
   - **C**: High risk. Dents, cracks, rust, major scratches, or "defekt" mentioned.
3. **Rationale**: 2-3 sentences. STRICTLY FACTS.
   - Good: "Description mentions 'new chain' but photo count (2) is too low to verify. No mention of fork service."
   - Bad: "Bike looks great."
4. **Checklist**: List 3-5 specific checks based on MISSING data or VISIBLE risks.
   - If transmission photo missing -> "Check chain wear and cassette condition."

OUTPUT JSON:
{
  "class": "A" | "B" | "C",
  "confidence": "high" | "medium" | "low",
  "rationale": "string",
  "checklist": ["string"]
}
`;

  try {
    // For Listing Stage, we primarily use Text + Metadata Analysis
    // as passing 10+ image URLs to LLM might be slow/expensive or unsupported without downloading.
    // We rely on "Base Confidence" to penalize lack of visual verification.
    
    // Call Gemini with text prompt
    const responseText = await geminiClient.generateContent(systemPrompt);
    
    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    // Try to find JSON object if there is extra text
    const jsonStart = cleanJson.indexOf('{');
    const jsonEnd = cleanJson.lastIndexOf('}');
    const jsonStr = (jsonStart !== -1 && jsonEnd !== -1) ? cleanJson.substring(jsonStart, jsonEnd + 1) : cleanJson;

    const result = JSON.parse(jsonStr);
    
    return {
        class: result.class || 'B', 
        confidence: (result.confidence || 'low').toLowerCase(),
        rationale: result.rationale || 'Analysis provided no rationale.',
        checklist: result.checklist || ['Perform full inspection']
    };

  } catch (e) {
    console.error('LLM Assessment failed:', e);
    return {
        class: 'B',
        confidence: 'low',
        rationale: 'Automated analysis failed. Manual inspection required.',
        checklist: ['Verify all systems', 'Check for structural damage']
    };
  }
}

function getMinConfidence(c1: string, c2: string): 'high' | 'medium' | 'low' {
  const scores: Record<string, number> = { 'low': 0, 'medium': 1, 'high': 2 };
  const s1 = scores[c1] ?? 0;
  const s2 = scores[c2] ?? 0;
  return (s1 < s2 ? c1 : c2) as 'high' | 'medium' | 'low';
}
