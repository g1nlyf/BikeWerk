const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

const bikeId = process.argv[2] || 75; // Default to 75

console.log(`\n🔍 AUDIT REPORT: Scoring Logic for Bike ID ${bikeId}`);
console.log('='.repeat(60));

const bike = db.prepare('SELECT * FROM bikes WHERE id = ?').get(bikeId);

if (!bike) {
    console.error('❌ Bike not found');
    process.exit(1);
}

console.log(`1️⃣  DB COLUMNS (Frontend uses these directly or via mapping):`);
console.log(`   - condition_grade (Class):   ${bike.condition_grade || 'NULL'} (Expected: A/B/C)`);
console.log(`   - condition_score (0-100):   ${bike.condition_score || 'NULL'}`);
console.log(`   - technical_score (Legacy):  ${bike.technical_score || 'NULL'}`);
console.log(`   - condition_reason (Text):   "${bike.condition_reason || 'NULL'}"`);
console.log(`   - unified_data (JSON):       ${bike.unified_data ? 'Present' : 'NULL'}`);

let unified = {};
try {
    unified = JSON.parse(bike.unified_data || '{}');
} catch (e) {}

console.log(`\n2️⃣  UNIFIED DATA (Source of Truth from AI):`);
console.log(`   - condition.grade:  ${unified.condition?.grade}`);
console.log(`   - condition.score:  ${unified.condition?.score}`);
console.log(`   - condition.reason: "${unified.condition?.reason}"`);

console.log(`\n3️⃣  SCORING LOGIC EXPLAINED:`);
console.log(`   1. AI (Gemini) analyzes photos + text.`);
console.log(`   2. Generates 'score' (0-100) and 'grade' (A/B/C).`);
console.log(`      - A: 90-100 (Like New)`);
console.log(`      - B: 70-89 (Good, minor wear)`);
console.log(`      - C: 0-69 (Average/Needs work)`);
console.log(`   3. Generates 'reason' (2-3 sentences in Russian).`);
console.log(`   4. Backend saves this to DB columns 'condition_grade', 'condition_score', 'condition_reason'.`);
console.log(`   5. Frontend (ProductDetailPage.tsx) reads these columns.`);
console.log(`      - Displays Circular Indicator (Grade + Score/100).`);
console.log(`      - Displays Text Verdict ("reason").`);

console.log(`\n4️⃣  FRONTEND MAPPING (How it looks to user):`);
const grade = bike.condition_grade || 'B';
const score = bike.condition_score || (grade === 'A' ? 95 : 75);
const reason = bike.condition_reason || "AI Verdict pending...";

console.log(`   [UI] Circle Letter: ${grade}`);
console.log(`   [UI] Score:         ${score}/100`);
console.log(`   [UI] Verdict:       "${reason}"`);

console.log('='.repeat(60));
