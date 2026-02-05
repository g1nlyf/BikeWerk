const fs = require('fs');
const path = require('path');

class ConditionAnalyzer {
    constructor(geminiProcessor, techDecoder) {
        this.gemini = geminiProcessor;
        this.decoder = techDecoder;
    }

    async analyzeBikeCondition(imagePaths, description, techSpecs) {
        if (!imagePaths || imagePaths.length === 0) {
            return {
                score: 7, // Default safe score
                grade: 'B',
                penalty: 0.1,
                reason: 'No images for analysis',
                flags: []
            };
        }

        const prompt = `
        You are a professional bicycle mechanic and appraiser.
        Analyze these images of a used bicycle.
        
        Tech Specs from Text:
        - Model: ${techSpecs.model || 'Unknown'}
        - Year: ${techSpecs.year || 'Unknown'}
        - Material: ${techSpecs.material || 'Unknown'}
        - Wheel Size: ${techSpecs.wheelSize || 'Unknown'}

        Task 1: Condition Grading (Visual Inspection)
        Look for:
        - Frame damage (cracks, deep scratches, dents).
        - Drivetrain wear (rusty chain, shark-tooth cassette, grime).
        - Suspension status (stanchion scratches, oil leaks).
        - Cockpit/Controls wear.
        
        Assign a score (1-10) and grade (A/B/C).
        
        Grading Scale (Strict):
        A (7.0 - 10.0): "Technically Perfect". Service new, top condition, barely used, or just very well maintained.
        B (4.0 - 6.9): "Working Horse". Good used condition, minor cosmetic signs, normal wear. Needs basic service.
        C (0.0 - 3.9): "Project / Heavy Wear". Needs major repairs, parts replacement, or is damaged.

        IMPORTANT: 
        1. If you don't see specific parts (e.g. rear shock on a road bike), DO NOT HALLUCINATE them. 
        2. Reply in RUSSIAN language for the "reason" field.
        3. If year/model is unknown, do not guess.

        Return JSON ONLY:
        {
            "score": number (1.0-10.0, use float for precision, e.g. 7.5),
            "grade": "A" | "B" | "C",
            "penalty": number (0.0 to 0.9, suggested price reduction based on condition),
            "reason": "Short explanation of the grade in RUSSIAN language",
            "visual_flaws": ["scratch on top tube", "rusty chain", etc],
            "consistency_flags": ["suspected alloy frame but text says carbon", etc] (empty if OK)
        }
        `;

        try {
            // Use up to 3 images for analysis
            const imagesToAnalyze = imagePaths.slice(0, 3);
            
            // We need to use Gemini Vision. 
            // geminiProcessor has callGeminiMultimodal which expects parts.
            // We need to construct parts.
            const parts = [{ text: prompt }];
            
            for (const imgPath of imagesToAnalyze) {
                // Determine if it's a local file or URL
                // In UnifiedHunter, we might have local paths after download, 
                // OR we might have screenshot paths.
                // Assuming local paths for now.
                
                try {
                    const buffer = fs.readFileSync(imgPath);
                    const base64 = buffer.toString('base64');
                    // Detect mime type simple way
                    const ext = path.extname(imgPath).toLowerCase().replace('.', '');
                    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
                    
                    parts.push({
                        inlineData: {
                            mimeType: mime,
                            data: base64
                        }
                    });
                } catch (e) {
                    console.warn(`ConditionAnalyzer: Failed to read image ${imgPath}: ${e.message}`);
                }
            }

            if (parts.length === 1) { // Only text
                 return { score: 7, grade: 'B', penalty: 0.1, reason: 'Image read failed', flags: [] };
            }

            const jsonStr = await this.gemini.callGeminiMultimodal(parts);
            const result = JSON.parse(this._cleanJson(jsonStr));
            
            // Post-processing safety
            if (!result.score) result.score = 7;
            if (!result.grade && result.overall_grade) result.grade = result.overall_grade; // Map new field
            if (!result.grade) result.grade = 'B';
            if (typeof result.penalty !== 'number') result.penalty = result.estimated_penalty || 0.1;
            
            // Map old fields for compatibility
            if (!result.visual_flaws && result.defects) {
                result.visual_flaws = result.defects.map(d => `${d.severity} ${d.type} on ${d.location}: ${d.description}`);
            }
            if (!result.reason && result.reasoning) result.reason = result.reasoning;

            // Flags logic
            if (result.consistency_flags && result.consistency_flags.length > 0) {
                result.needs_review = true;
            }

            return result;

        } catch (error) {
            console.error('ConditionAnalyzer Error:', error);
            return {
                score: 7,
                grade: 'B',
                penalty: 0.1,
                reason: 'AI Analysis Failed',
                flags: []
            };
        }
    }

    _cleanJson(str) {
        if (!str) return '{}';
        // Remove markdown code blocks if present
        let cleaned = str.replace(/```json/g, '').replace(/```/g, '').trim();
        return cleaned;
    }
}

module.exports = ConditionAnalyzer;
