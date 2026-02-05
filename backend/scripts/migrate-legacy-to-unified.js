const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(DB_PATH);

console.log('🔧 MIGRATING LEGACY DATA TO UNIFIED FORMAT...');

try {
    // 1. Find legacy records
    const legacyBikes = db.prepare(`
        SELECT * FROM bikes 
        WHERE unified_data IS NULL OR unified_data = ''
    `).all();

    console.log(`   🔍 Found ${legacyBikes.length} legacy records`);

    if (legacyBikes.length === 0) {
        console.log('   ✅ No migration needed');
        db.close();
        process.exit(0);
    }

    const updateStmt = db.prepare(`
        UPDATE bikes 
        SET unified_data = ?, 
            quality_score = ?, 
            source_platform = ?
        WHERE id = ?
    `);

    let migratedCount = 0;

    for (const bike of legacyBikes) {
        // Construct Unified Format
        const unified = {
            meta: {
                source_platform: 'manual',
                created_at: bike.created_at || new Date().toISOString(),
                is_active: true,
                migration_note: 'Migrated from legacy flat data'
            },
            basic_info: {
                name: bike.title || bike.name || `${bike.brand} ${bike.model}`,
                brand: bike.brand || 'Unknown',
                model: bike.model || 'Unknown',
                year: bike.year || null,
                category: bike.category || 'mtb',
                description: bike.description || null
            },
            pricing: {
                price: bike.price || 0,
                original_price: bike.original_price || null,
                currency: bike.currency || 'EUR',
                discount: 0,
                is_negotiable: false
            },
            specs: {
                frame_size: bike.frame_size || null,
                wheel_size: bike.wheel_size || null,
                frame_material: bike.frame_material || null,
                groupset: null, // Legacy didn't store this consistently in flat columns usually
                brakes: null,
                fork: null,
                shock: null
            },
            condition: {
                score: 50, // Default for legacy
                status: 'used',
                grade: 'C',
                reason: 'Legacy data migration'
            },
            media: {
                main_image: bike.main_image || null,
                gallery: [] // Legacy flat data might not have gallery easily accessible
            },
            ranking: {
                rank: 0.5,
                ranking_score: 0.5,
                hotness_score: 0
            },
            audit: {
                needs_audit: true,
                audit_status: 'migrated_legacy',
                audit_notes: 'Auto-migrated from legacy data'
            },
            features: {
                raw_specs: {},
                badges: [],
                upgrades: []
            },
            quality_score: 50
        };

        // Update DB
        updateStmt.run(
            JSON.stringify(unified),
            50, // quality_score
            'manual', // source_platform
            bike.id
        );
        migratedCount++;
    }

    console.log(`   ✅ Migrated ${migratedCount} records successfully`);

} catch (e) {
    console.error('   ❌ Error during migration:', e.message);
    process.exit(1);
}

db.close();
console.log('✨ Done');
