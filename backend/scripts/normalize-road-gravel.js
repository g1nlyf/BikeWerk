/**
 * normalize-road-gravel.js
 * 
 * Sets sub_category for Road and Gravel bikes based on model names and brand patterns.
 * 
 * Road sub_categories:
 *   - race: Tarmac, Emonda, Ultimate, TCR, SuperSix, Madone (non-aero versions), etc.
 *   - aero: Venge, Aeroad, Madone, SystemSix, Propel, etc.
 *   - endurance: Roubaix, Endurace, Domane, Synapse, Defy, etc.
 *   - tt_triathlon: Shiv, Speedmax, P-Series, etc.
 * 
 * Gravel sub_categories:
 *   - race: Crux, Grail (carbon), CruX, Aspero, etc.
 *   - adventure: Diverge, Grizl, Checkpoint, Topstone, etc.
 *   - bikepacking: Heavy duty, racks, bags mentioned
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('\n🔄 Normalizing Road & Gravel sub-categories...\n');

// Road bike model patterns
const ROAD_PATTERNS = {
  // Aero bikes
  aero: [
    /venge/i, /aeroad/i, /madone/i, /systemsix/i, /propel/i, /reacto/i,
    /aero/i, /s-works.*tarmac.*sl7/i, /cervelo.*s/i, /noah/i, /oltre/i
  ],
  // Race bikes
  race: [
    /tarmac/i, /emonda/i, /ultimate/i, /tcr/i, /supersix/i, /caad/i,
    /allez/i, /dogma/i, /prince/i, /izalco/i, /helium/i, /addict/i,
    /teammachine/i, /oltre.*xr/i, /785.*huez/i, /scultura/i
  ],
  // Endurance bikes
  endurance: [
    /roubaix/i, /endurace/i, /domane/i, /synapse/i, /defy/i, /fenix/i,
    /endurance/i, /granfondo/i, /infinito/i, /intenso/i
  ],
  // TT/Triathlon
  tt_triathlon: [
    /shiv/i, /speedmax/i, /p-series/i, /p5/i, /p3/i, /triathlon/i, 
    /tt\b/i, /time.*trial/i, /ia/i, /speedconcept/i
  ]
};

// Gravel bike model patterns
const GRAVEL_PATTERNS = {
  // Race gravel
  race: [
    /crux/i, /grail.*cf/i, /aspero/i, /warbird/i, /stigmata/i,
    /exploro.*race/i, /silex.*cf/i
  ],
  // Adventure / All-road
  adventure: [
    /diverge/i, /grizl/i, /checkpoint/i, /topstone/i, /revolt/i,
    /nuroad/i, /silex/i, /jari/i, /inflite/i, /grail.*al/i,
    /all.*road/i, /allroad/i, /adventure/i
  ],
  // Bikepacking
  bikepacking: [
    /bikepacking/i, /touring/i, /cutthroat/i, /fargo/i, /sequoia/i
  ]
};

// eMTB sub_category from model patterns
const EMTB_PATTERNS = {
  trail: [
    /levo/i, /trance/i, /neuron.*on/i, /rise/i, /e-one.*fifty/i,
    /jam/i, /stereo.*hybrid/i, /sight.*vlt/i, /trail/i
  ],
  enduro: [
    /kenevo/i, /capra.*e/i, /strive.*e/i, /slash.*e/i, /enduro.*e/i
  ],
  xc: [
    /lauf/i, /epic.*e/i, /scalpel.*e/i, /reaction.*hybrid/i
  ]
};

function classifyRoad(name, description) {
  const text = `${name || ''} ${description || ''}`.toLowerCase();
  
  for (const [subCat, patterns] of Object.entries(ROAD_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return { sub_category: subCat, discipline: subCat === 'race' ? 'racing' : subCat };
      }
    }
  }
  // Default to race for unmatched road bikes
  return { sub_category: 'race', discipline: 'racing' };
}

function classifyGravel(name, description) {
  const text = `${name || ''} ${description || ''}`.toLowerCase();
  
  for (const [subCat, patterns] of Object.entries(GRAVEL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        const disc = subCat === 'race' ? 'gravel_racing' : 
                     subCat === 'adventure' ? 'gravel_adventure' : 'bikepacking';
        return { sub_category: subCat, discipline: disc };
      }
    }
  }
  // Default to adventure for unmatched gravel bikes
  return { sub_category: 'adventure', discipline: 'gravel_adventure' };
}

function classifyEmtb(name, description) {
  const text = `${name || ''} ${description || ''}`.toLowerCase();
  
  for (const [subCat, patterns] of Object.entries(EMTB_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return { sub_category: subCat, discipline: `emtb_${subCat}` };
      }
    }
  }
  // Default to trail for unmatched eMTB
  return { sub_category: 'trail', discipline: 'emtb_trail' };
}

// Process Road bikes
console.log('📋 Processing Road bikes...');
const roadBikes = db.prepare(`
  SELECT id, name, description 
  FROM bikes 
  WHERE category = 'road' AND (sub_category IS NULL OR sub_category = '' OR sub_category = 'null')
`).all();

for (const bike of roadBikes) {
  const { sub_category, discipline } = classifyRoad(bike.name, bike.description);
  db.prepare(`UPDATE bikes SET sub_category = ?, discipline = ? WHERE id = ?`)
    .run(sub_category, discipline, bike.id);
  console.log(`  ID ${bike.id}: "${bike.name?.substring(0,40)}" → sub_category='${sub_category}'`);
}
console.log(`  Updated ${roadBikes.length} road bikes\n`);

// Process Gravel bikes
console.log('📋 Processing Gravel bikes...');
const gravelBikes = db.prepare(`
  SELECT id, name, description 
  FROM bikes 
  WHERE category = 'gravel' AND (sub_category IS NULL OR sub_category = '' OR sub_category = 'null')
`).all();

for (const bike of gravelBikes) {
  const { sub_category, discipline } = classifyGravel(bike.name, bike.description);
  db.prepare(`UPDATE bikes SET sub_category = ?, discipline = ? WHERE id = ?`)
    .run(sub_category, discipline, bike.id);
  console.log(`  ID ${bike.id}: "${bike.name?.substring(0,40)}" → sub_category='${sub_category}'`);
}
console.log(`  Updated ${gravelBikes.length} gravel bikes\n`);

// Process eMTB bikes without sub_category
console.log('📋 Processing eMTB bikes...');
const emtbBikes = db.prepare(`
  SELECT id, name, description 
  FROM bikes 
  WHERE category = 'emtb' AND (sub_category IS NULL OR sub_category = '' OR sub_category = 'null')
`).all();

for (const bike of emtbBikes) {
  const { sub_category, discipline } = classifyEmtb(bike.name, bike.description);
  db.prepare(`UPDATE bikes SET sub_category = ?, discipline = ? WHERE id = ?`)
    .run(sub_category, discipline, bike.id);
  console.log(`  ID ${bike.id}: "${bike.name?.substring(0,40)}" → sub_category='${sub_category}'`);
}
console.log(`  Updated ${emtbBikes.length} eMTB bikes\n`);

// Final summary
console.log('📊 Final Distribution:');
const summary = db.prepare(`
  SELECT category, sub_category, COUNT(*) as cnt 
  FROM bikes 
  WHERE is_active = TRUE
  GROUP BY category, sub_category 
  ORDER BY category, cnt DESC
`).all();
summary.forEach(s => console.log(`  [${s.category}] ${s.sub_category || '(none)'}: ${s.cnt}`));

db.close();
console.log('\n✅ Done!\n');
