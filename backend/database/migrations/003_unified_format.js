const { db } = require('../../src/js/mysql-config');

async function migrate() {
    console.log('🔄 Starting migration: 003_unified_format...');

    try {
        // 1. Add missing columns
        const columnsToAdd = [
            { name: 'currency', type: "TEXT DEFAULT 'EUR'" },
            { name: 'frame_material', type: "TEXT" },
            { name: 'color', type: "TEXT" },
            { name: 'weight', type: "REAL" },
            { name: 'suspension_type', type: "TEXT" },
            { name: 'groupset', type: "TEXT" },
            { name: 'brakes', type: "TEXT" },
            { name: 'fork', type: "TEXT" },
            { name: 'shock', type: "TEXT" },
            { name: 'visual_rating', type: "INTEGER" },
            { name: 'issues', type: "TEXT" }, // JSON array
            { name: 'mechanic_notes', type: "TEXT" },
            { name: 'seller_rating', type: "REAL" },
            { name: 'delivery_option', type: "TEXT DEFAULT 'unknown'" },
            { name: 'shipping_cost', type: "REAL" },
            { name: 'is_pickup_available', type: "BOOLEAN DEFAULT 1" },
            { name: 'gallery', type: "TEXT" }, // JSON array
            { name: 'audit_notes', type: "TEXT" },
            { name: 'features_raw', type: "TEXT" }, // JSON object
            { name: 'badges', type: "TEXT" }, // JSON array
            { name: 'upgrades', type: "TEXT" }, // JSON array
            { name: 'inspection_data', type: "TEXT" }, // Full JSON from "inspection" block
            { name: 'wheel_size', type: "TEXT" } // Rename target
        ];

        for (const col of columnsToAdd) {
            try {
                await db.query(`ALTER TABLE bikes ADD COLUMN ${col.name} ${col.type}`);
                console.log(`✅ Added column: ${col.name}`);
            } catch (e) {
                if (e.message.includes('duplicate column name')) {
                    console.log(`ℹ️ Column ${col.name} already exists.`);
                } else {
                    console.error(`❌ Failed to add column ${col.name}:`, e.message);
                }
            }
        }

        // 2. Data Migration & Normalization
        console.log('🔄 Migrating legacy data...');

        // wheel_diameter -> wheel_size
        await db.query(`UPDATE bikes SET wheel_size = wheel_diameter WHERE wheel_size IS NULL AND wheel_diameter IS NOT NULL`);
        console.log('✅ Migrated wheel_diameter -> wheel_size');

        // original_url -> source_url
        await db.query(`UPDATE bikes SET source_url = original_url WHERE (source_url IS NULL OR source_url = '') AND original_url IS NOT NULL`);
        console.log('✅ Migrated original_url -> source_url');
        
        // Ensure currency is EUR if null
        await db.query(`UPDATE bikes SET currency = 'EUR' WHERE currency IS NULL`);

        // 3. Drop/Rename logic (SQLite limitation: usually ignored or requires table rebuild)
        // We will leave legacy columns (wheel_diameter, original_url) for safety but stop using them.

        console.log('✅ Migration 003_unified_format completed successfully.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
