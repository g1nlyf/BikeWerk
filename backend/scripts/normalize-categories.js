/**
 * normalize-categories.js
 * 
 * Migration script to normalize category and sub_category values in bikes table.
 * 
 * Category Normalization:
 *   Mountain, Горный, Горные велосипеды, Mountain Bike, Mountainbikes → mtb
 *   Шоссейный, Road → road
 *   Гравийный, Gravel → gravel
 *   Электро, E-Mountainbike, ebike, Электровелосипеды, Электро-горный велосипед → emtb
 *   Детский, Kids → kids
 * 
 * Sub-category Fallback from discipline:
 *   discipline="trail" or "trail_riding" → sub_category="trail"
 *   discipline="enduro" or "all_mountain" → sub_category="enduro"
 *   discipline="cross_country" → sub_category="xc"
 *   discipline="downhill" → sub_category="dh"
 *   discipline="emtb_trail" → sub_category="trail"
 *   discipline="emtb_enduro" → sub_category="enduro"
 * 
 * Usage: node backend/scripts/normalize-categories.js [--dry-run]
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../database/eubike.db');
const isDryRun = process.argv.includes('--dry-run');

console.log(`\n🔄 Category Normalization Script`);
console.log(`   Database: ${dbPath}`);
console.log(`   Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

// Category mapping (case-insensitive)
const CATEGORY_MAP = {
  // MTB variants
  'mountain': 'mtb',
  'горный': 'mtb',
  'горные велосипеды': 'mtb',
  'mountain bike': 'mtb',
  'mountainbike': 'mtb',
  'mountainbikes': 'mtb',
  'mtb': 'mtb',
  
  // Road variants
  'шоссейный': 'road',
  'road': 'road',
  'шоссе': 'road',
  
  // Gravel variants
  'гравийный': 'gravel',
  'gravel': 'gravel',
  'гревел': 'gravel',
  
  // eMTB variants
  'электро': 'emtb',
  'e-mountainbike': 'emtb',
  'ebike': 'emtb',
  'emtb': 'emtb',
  'электровелосипеды': 'emtb',
  'электро-горный велосипед': 'emtb',
  
  // Kids variants
  'детский': 'kids',
  'kids': 'kids',
  'детские': 'kids',
  
  // Other
  'other': 'other',
  'unknown': 'other'
};

// Discipline → sub_category mapping
const DISCIPLINE_TO_SUB = {
  'trail': 'trail',
  'trail_riding': 'trail',
  'enduro': 'enduro',
  'all_mountain': 'enduro',
  'cross_country': 'xc',
  'xc': 'xc',
  'downhill': 'dh',
  'dh': 'dh',
  'dirt_jump': 'dirt_jump',
  
  // Road disciplines
  'racing': 'race',
  'aero': 'aero',
  'endurance': 'endurance',
  'triathlon': 'tt_triathlon',
  
  // Gravel disciplines
  'gravel_racing': 'race',
  'gravel_adventure': 'adventure',
  'bikepacking': 'bikepacking',
  
  // eMTB disciplines
  'emtb_trail': 'trail',
  'emtb_enduro': 'enduro',
  'emtb_xc': 'xc'
};

function normalizeCategory(category) {
  if (!category) return null;
  const key = category.toLowerCase().trim();
  return CATEGORY_MAP[key] || null;
}

function discipleToSubCategory(discipline) {
  if (!discipline) return null;
  const key = discipline.toLowerCase().trim();
  return DISCIPLINE_TO_SUB[key] || null;
}

function run() {
  const db = new Database(dbPath);
  
  try {
    // Get current state
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as has_category,
        COUNT(CASE WHEN sub_category IS NOT NULL THEN 1 END) as has_sub_category,
        COUNT(CASE WHEN discipline IS NOT NULL THEN 1 END) as has_discipline
      FROM bikes
    `).get();
    
    console.log(`📊 Current state:`);
    console.log(`   Total bikes: ${stats.total}`);
    console.log(`   With category: ${stats.has_category}`);
    console.log(`   With sub_category: ${stats.has_sub_category}`);
    console.log(`   With discipline: ${stats.has_discipline}\n`);
    
    // Get distinct categories before normalization
    const categories = db.prepare(`
      SELECT category, COUNT(*) as cnt 
      FROM bikes 
      WHERE category IS NOT NULL 
      GROUP BY category 
      ORDER BY cnt DESC
    `).all();
    
    console.log(`📋 Categories before normalization:`);
    categories.forEach(c => console.log(`   "${c.category}": ${c.cnt}`));
    console.log('');
    
    // Start normalization
    let categoryUpdates = 0;
    let subCategoryUpdates = 0;
    
    if (!isDryRun) {
      db.exec('BEGIN TRANSACTION');
    }
    
    // 1. Normalize categories
    console.log(`🔧 Step 1: Normalizing categories...`);
    
    for (const [oldValue, newValue] of Object.entries(CATEGORY_MAP)) {
      // SQLite LIKE is case-insensitive by default for ASCII
      const updateSql = `
        UPDATE bikes 
        SET category = ? 
        WHERE LOWER(category) = ?
      `;
      
      if (!isDryRun) {
        const result = db.prepare(updateSql).run(newValue, oldValue);
        if (result.changes > 0) {
          console.log(`   "${oldValue}" → "${newValue}": ${result.changes} rows`);
          categoryUpdates += result.changes;
        }
      } else {
        const count = db.prepare(`
          SELECT COUNT(*) as cnt FROM bikes WHERE LOWER(category) = ?
        `).get(oldValue)?.cnt || 0;
        if (count > 0) {
          console.log(`   [DRY] "${oldValue}" → "${newValue}": ${count} rows`);
          categoryUpdates += count;
        }
      }
    }
    
    console.log(`   Total category updates: ${categoryUpdates}\n`);
    
    // 2. Fill sub_category from discipline where sub_category is NULL
    console.log(`🔧 Step 2: Filling sub_category from discipline...`);
    
    const bikesWithDiscipline = db.prepare(`
      SELECT id, discipline, sub_category 
      FROM bikes 
      WHERE discipline IS NOT NULL AND (sub_category IS NULL OR sub_category = '')
    `).all();
    
    for (const bike of bikesWithDiscipline) {
      const newSub = discipleToSubCategory(bike.discipline);
      if (newSub) {
        if (!isDryRun) {
          db.prepare(`UPDATE bikes SET sub_category = ? WHERE id = ?`).run(newSub, bike.id);
        }
        console.log(`   ID ${bike.id}: discipline="${bike.discipline}" → sub_category="${newSub}"`);
        subCategoryUpdates++;
      }
    }
    
    console.log(`   Total sub_category updates: ${subCategoryUpdates}\n`);
    
    // 3. Normalize existing sub_category values
    console.log(`🔧 Step 3: Normalizing existing sub_category values...`);
    
    const SUB_CATEGORY_NORMALIZE = {
      'downhill': 'dh',
      'cross_country': 'xc',
      'unknown': null
    };
    
    for (const [oldValue, newValue] of Object.entries(SUB_CATEGORY_NORMALIZE)) {
      if (!isDryRun) {
        const result = db.prepare(`
          UPDATE bikes SET sub_category = ? WHERE LOWER(sub_category) = ?
        `).run(newValue, oldValue);
        if (result.changes > 0) {
          console.log(`   sub_category "${oldValue}" → "${newValue}": ${result.changes} rows`);
        }
      }
    }
    
    // Commit or rollback
    if (!isDryRun) {
      db.exec('COMMIT');
      console.log(`\n✅ Migration complete!`);
    } else {
      console.log(`\n✅ Dry run complete. No changes made.`);
      console.log(`   Run without --dry-run to apply changes.`);
    }
    
    // Show final state
    const finalStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN sub_category IS NOT NULL AND sub_category != '' THEN 1 END) as has_sub_category
      FROM bikes
    `).get();
    
    const finalCategories = db.prepare(`
      SELECT category, COUNT(*) as cnt 
      FROM bikes 
      WHERE category IS NOT NULL 
      GROUP BY category 
      ORDER BY cnt DESC
    `).all();
    
    const finalSubCategories = db.prepare(`
      SELECT sub_category, COUNT(*) as cnt 
      FROM bikes 
      WHERE sub_category IS NOT NULL AND sub_category != ''
      GROUP BY sub_category 
      ORDER BY cnt DESC
    `).all();
    
    console.log(`\n📊 Final state:`);
    console.log(`   Bikes with sub_category: ${finalStats.has_sub_category}/${finalStats.total}`);
    
    console.log(`\n   Categories:`);
    finalCategories.forEach(c => console.log(`      "${c.category}": ${c.cnt}`));
    
    console.log(`\n   Sub-categories:`);
    finalSubCategories.forEach(s => console.log(`      "${s.sub_category}": ${s.cnt}`));
    
  } catch (error) {
    if (!isDryRun) {
      db.exec('ROLLBACK');
    }
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    db.close();
  }
}

run();
