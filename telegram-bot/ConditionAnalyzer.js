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
                score: 60,
                grade: 'B',
                penalty: 0.2,
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
        
        Assign a score (0-100) and grade (A+/A/B/C).
        
        Grading Scale (Strict):
        A+ (95-100): "Like New". Practically no wear, no visible damage, fully serviced.
        A (80-94): "Ready to Ride". No major defects, only minor cosmetic wear, no urgent investments.
        B (41-79): "Used but Functional". Rideable, but has visible wear and likely needs service/consumables soon.
        C (0-40): "Project / Heavy Wear". Significant defects or risks, requires repairs/investments.

        IMPORTANT: 
        1. If you don't see specific parts (e.g. rear shock on a road bike), DO NOT HALLUCINATE them. 
        2. Reply in RUSSIAN language for the "reason" field.
        3. If year/model is unknown, do not guess.
        4. Be objective: do not inflate scores for average bikes and do not underrate clean bikes.
        5. If evidence is weak or photos are low quality, lower confidence and keep score conservative.

        Return JSON ONLY:
        {
            "score": number (0-100),
            "grade": "A+" | "A" | "B" | "C",
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
                try {
                    const part = await this._loadImagePart(imgPath);
                    if (part) parts.push(part);
                } catch (e) {
                    console.warn(`ConditionAnalyzer: Failed to read image ${imgPath}: ${e.message}`);
                }
            }

            if (parts.length === 1) { // Only text
                 return { score: 60, grade: 'B', penalty: 0.2, reason: 'Image read failed', flags: [] };
            }

            const jsonStr = await this.gemini.callGeminiMultimodal(parts);
            const result = JSON.parse(this._cleanJson(jsonStr));
            
            // Post-processing safety
            if (!result.score && result.score !== 0) result.score = 60;
            result.score = this._normalizeScore(result.score);
            if (!result.grade && result.overall_grade) result.grade = result.overall_grade; // Map new field
            if (!result.grade) result.grade = this._deriveGrade(result.score);
            if (typeof result.penalty !== 'number') result.penalty = result.estimated_penalty || this._derivePenalty(result.score);
            result.penalty = this._normalizePenalty(result.penalty, result.score);
            
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
                score: 60,
                grade: 'B',
                penalty: 0.2,
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

    async _loadImagePart(imgPath) {
        if (!imgPath) return null;

        // Remote image (Buycycle/Klein URLs)
        if (/^https?:\/\//i.test(imgPath)) {
            const response = await fetch(imgPath, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (ConditionAnalyzer)'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${imgPath}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            const mimeType =
                this._normalizeMime(response.headers.get('content-type')) ||
                this._mimeFromPath(imgPath);

            if (!this._isSupportedVisionMime(mimeType)) {
                return null;
            }

            return {
                inlineData: {
                    mimeType,
                    data: base64
                }
            };
        }

        // URL from local public storage (e.g. /images/...)
        let localPath = imgPath;
        if (imgPath.startsWith('/')) {
            const normalized = imgPath.replace(/^\//, '');
            const candidates = [
                path.resolve(process.cwd(), normalized),
                path.resolve(process.cwd(), 'backend', 'public', normalized),
                path.resolve(__dirname, '..', 'backend', 'public', normalized),
                path.resolve(__dirname, '..', 'public', normalized)
            ];
            localPath = candidates.find((candidate) => fs.existsSync(candidate)) || imgPath;
        }

        const buffer = fs.readFileSync(localPath);
        const base64 = buffer.toString('base64');
        const mimeType = this._mimeFromPath(localPath);

        if (!this._isSupportedVisionMime(mimeType)) {
            return null;
        }

        return {
            inlineData: {
                mimeType,
                data: base64
            }
        };
    }

    _normalizeMime(contentType) {
        if (!contentType) return null;
        return String(contentType).split(';')[0].trim().toLowerCase() || null;
    }

    _mimeFromPath(rawPath) {
        const cleanPath = String(rawPath).split('?')[0];
        const ext = path.extname(cleanPath).toLowerCase().replace('.', '');
        switch (ext) {
            case 'jpg':
            case 'jpeg':
                return 'image/jpeg';
            case 'png':
                return 'image/png';
            case 'webp':
                return 'image/webp';
            case 'gif':
                return 'image/gif';
            case 'bmp':
                return 'image/bmp';
            case 'svg':
            case 'svg+xml':
                return 'image/svg+xml';
            default:
                return 'image/jpeg';
        }
    }

    _isSupportedVisionMime(mimeType) {
        return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(String(mimeType || '').toLowerCase());
    }

    _normalizeScore(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 60;
        const scaled = numeric <= 10 ? numeric * 10 : numeric;
        return Math.max(0, Math.min(100, Math.round(scaled)));
    }

    _deriveGrade(score) {
        if (score >= 95) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 41) return 'B';
        return 'C';
    }

    _derivePenalty(score) {
        if (score >= 95) return 0.02;
        if (score >= 80) return 0.08;
        if (score >= 60) return 0.15;
        if (score >= 41) return 0.25;
        return 0.4;
    }

    _normalizePenalty(value, score) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return this._derivePenalty(score);
        return Math.max(0, Math.min(0.9, Math.round(numeric * 100) / 100));
    }
}

module.exports = ConditionAnalyzer;
