/**
 * GeminiToDatabaseMapper.js
 * Maps Gemini Unified JSON to EUBike Database Schema (SQLite/MySQL)
 */

class GeminiToDatabaseMapper {
    /**
     * Map Gemini JSON to Database Columns
     * @param {Object} geminiJson - The unified JSON from Gemini
     * @returns {Object} Database record object
     */
    mapToDatabase(geminiJson) {
        if (!geminiJson) return {};

        const basic = geminiJson.basic_info || {};
        const meta = geminiJson.meta || {};
        const pricing = geminiJson.pricing || {};
        const specs = geminiJson.specs || {};
        const condition = geminiJson.condition || {};
        const seller = geminiJson.seller || {};
        const logistics = geminiJson.logistics || {};
        const ranking = geminiJson.ranking || {};
        const media = geminiJson.media || {};

        return {
            // --- IDENTITY ---
            name: basic.name || `${basic.brand} ${basic.model} ${basic.year || ''}`.trim(),
            brand: basic.brand,
            model: basic.model,
            year: basic.year || null,
            category: basic.category || 'Other',
            sub_category: basic.sub_category || null,
            discipline: basic.discipline || basic.sub_category || null,
            
            // --- PRICING ---
            price: pricing.price || 0,
            original_price: pricing.original_price || null,
            discount: pricing.discount || 0,
            currency: pricing.currency || 'EUR',
            is_negotiable: pricing.is_negotiable ? 1 : 0,
            fmv: pricing.fmv || null,
            fmv_confidence: pricing.fmv_confidence || null,
            market_comparison: pricing.market_comparison || null,
            optimal_price: pricing.optimal_price || null,
            days_on_market: pricing.days_on_market || 0,

            // --- SPECS ---
            frame_size: specs.frame_size || null,
            frame_material: specs.frame_material || null,
            color: specs.color || null,
            weight: specs.weight || null,
            wheel_size: specs.wheel_size || null,
            suspension_type: specs.suspension_type || null,
            travel_front: specs.travel_front || null,
            travel_rear: specs.travel_rear || null,
            groupset: specs.groupset || null,
            groupset_speeds: specs.groupset_speeds || null,
            brakes: specs.brakes || null,
            brakes_type: specs.brakes_type || null,
            fork: specs.fork || null,
            shock: specs.shock || null,
            
            // --- CONDITION ---
            is_new: condition.status === 'new' ? 1 : 0,
            condition_status: condition.status || 'used',
            condition_score: condition.score || null,
            condition_grade: condition.grade || null,
            condition_class: condition.class || null,
            condition_rationale: condition.rationale || null,
            condition_confidence: condition.confidence || null,
            technical_score: condition.technical_score || (condition.functional_rating ? condition.functional_rating * 20 : null),
            visual_rating: condition.visual_rating || null,
            functional_rating: condition.functional_rating || null,
            crash_history: condition.crash_history ? 1 : 0,
            frame_damage: condition.frame_damage ? 1 : 0,

            // --- SELLER & LOGISTICS ---
            seller_name: seller.name || null,
            seller_type: seller.type || 'unknown',
            seller_rating: seller.rating || null,
            seller_verified: seller.verified ? 1 : 0,
            seller_professional: seller.professional ? 1 : 0,
            seller_last_active: seller.last_active || null,
            
            location: logistics.location || seller.location || null,
            country: logistics.country || null,
            shipping_option: logistics.shipping_option || 'unknown',
            shipping_cost: logistics.shipping_cost || null,
            is_pickup_available: logistics.pickup_available ? 1 : 0,
            guaranteed_pickup: logistics.guaranteed_pickup ? 1 : 0,
            ready_to_ship: logistics.ready_to_ship ? 1 : 0,
            international: logistics.international ? 1 : 0,

            // --- MEDIA & CONTENT ---
            main_image: media.main_image || null,
            gallery: JSON.stringify(media.gallery || []),
            // Store arrays as JSON strings if needed, or rely on separate tables/logic
            // Here we map to columns that expect text/json
            description: basic.description || null,
            description_ru: basic.description || null, // Assuming description is RU translated as per prompt
            language: basic.language || 'en',
            
            // --- RANKING & ANALYTICS ---
            quality_score: geminiJson.quality_score || 50,
            completeness: geminiJson.completeness || 0,
            hotness_score: ranking.score ? (ranking.score * 100) : 0,
            is_hot: ranking.is_hot_offer ? 1 : 0,
            is_high_demand: ranking.demand_score > 70 ? 1 : 0, // Heuristic
            
            // --- SYSTEM ---
            source: meta.source_platform || 'manual',
            source_url: meta.source_url || null,
            source_ad_id: meta.source_ad_id || null,
            external_id: meta.source_ad_id || null, // Map ad_id to external_id
            parser_version: meta.parser_version || '2.0.0',
            last_checked_at: meta.last_checked_at || new Date().toISOString(),
            is_active: meta.is_active !== false ? 1 : 0,
            
            // --- JSON BLOBS (For full fidelity) ---
            specs_json: JSON.stringify(specs),
            seller_json: JSON.stringify(seller),
            logistics_json: JSON.stringify(logistics),
            condition_json: JSON.stringify(condition), // Map to condition_report or similar if needed
            ai_analysis_json: JSON.stringify(geminiJson.ai_analysis || {}),
            market_data_json: JSON.stringify(geminiJson.market_data || {})
        };
    }
}

module.exports = GeminiToDatabaseMapper;
