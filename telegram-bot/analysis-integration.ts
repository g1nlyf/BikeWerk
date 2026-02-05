import { analyzeCondition, AssessmentResult } from './condition-analyzer';
import { BikeData } from './types/parser';

// ... existing code ...

// Inside handleKleinanzeigenLink or similar function, AFTER bike is saved/updated in bikes table
// We need to perform the analysis and save it to the new table

export async function performAndSaveConditionAnalysis(
    bikeId: number, 
    bikeData: BikeData, 
    imageUrls: string[], 
    db: any, // BikesDatabase instance
    geminiClient: any
) {
    try {
        console.log(`🧠 Запуск анализа состояния для велосипеда #${bikeId}...`);
        
        // 1. Perform Analysis
        const result: AssessmentResult = await analyzeCondition(bikeData, imageUrls, geminiClient);
        
        console.log(`📊 Результат анализа: Класс ${result.condition_class} (${result.condition_confidence.toUpperCase()})`);
        
        // 2. Save to bike_condition_assessments
        await db.runQuery(`
            INSERT INTO bike_condition_assessments (
                bike_id, 
                assessment_stage, 
                condition_class, 
                condition_confidence, 
                condition_rationale, 
                condition_checklist, 
                data_source_summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            bikeId,
            'listing', // Stage
            result.condition_class,
            result.condition_confidence,
            result.condition_rationale,
            JSON.stringify(result.condition_checklist),
            JSON.stringify(result.data_source_summary)
        ]);
        
        // 3. Update main bikes table with latest status (optional, for quick access)
        // We keep the "latest" status in bikes table for easy filtering, but history in assessments
        await db.runQuery(`
            UPDATE bikes SET 
                condition_class = ?,
                condition_confidence = ?,
                condition_rationale = ?,
                condition_checklist = ?
            WHERE id = ?
        `, [
            result.condition_class,
            result.condition_confidence,
            result.condition_rationale,
            JSON.stringify(result.condition_checklist),
            bikeId
        ]);

        return result;

    } catch (error) {
        console.error(`❌ Ошибка анализа состояния для #${bikeId}:`, error);
        return null;
    }
}
