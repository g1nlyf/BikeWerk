// backend/scripts/test-extraction.js

// Mocking extractBrand from fill-data-lake.js (copying logic here for isolation or importing)
// Since fill-data-lake.js is a script not a module, I'll duplicate the logic for testing as per user request snippet, 
// OR I can refactor fill-data-lake.js to export it. 
// User snippet implies standalone test file with the function defined inside or imported.
// I will copy the UPDATED logic to test it.

function extractBrand(title) {
  const brands = {
    'Santa Cruz': ['santa cruz', 'santa-cruz', 'santacruz', 'sc bikes'],
    'YT': ['yt industries', 'yt-industries', 'yt ', ' yt', 'yt,'],
    'Specialized': ['specialized', 's-works', 'sworks'],
    'Canyon': ['canyon'],
    'Pivot': ['pivot'],
    'Trek': ['trek'],
    'Giant': ['giant'],
    'Scott': ['scott'],
    'Cube': ['cube'],
    'Propain': ['propain'],
    'Rose': ['rose', 'rosebikes'],
    'Commencal': ['commencal'],
    'Transition': ['transition'],
    'Evil': ['evil bikes', 'evil'],
    'Intense': ['intense'],
    'Yeti': ['yeti cycles', 'yeti']
  };
  
  const lower = title.toLowerCase();
  
  // Sort patterns by length (descending) to match longest first
  for (const [brand, patterns] of Object.entries(brands)) {
    const sortedPatterns = patterns.sort((a, b) => b.length - a.length);
    if (sortedPatterns.some(p => lower.includes(p.toLowerCase()))) return brand;
  }
  
  return null;
}

// Logic from fill-data-lake.js for year/size
function extractYear(title) {
  const yearMatch = title.match(/\b(20[1-2][0-9])\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 2010 && year <= 2026) return year;
  }
  return null;
}

function extractFrameSize(title) {
  const titleUpper = title.toUpperCase();
  const sizePatterns = [
    { regex: /\b(XS)\b/, size: 'XS' },
    { regex: /(?:^|\s)(S)(?:$|\s)/, size: 'S' }, // Fix for S-Works
    { regex: /\b(M)\b(?!\w)/, size: 'M' },
    { regex: /\b(L)\b(?!\w)/, size: 'L' },
    { regex: /\b(XL)\b/, size: 'XL' },
    { regex: /\b(XXL)\b/, size: 'XXL' },
    { regex: /RAHMEN\s*(XS|S|M|L|XL|XXL)/i, size: null },
    { regex: /GR[ÖO]ẞE\s*(XS|S|M|L|XL|XXL)/i, size: null },
    { regex: /SIZE\s*(XS|S|M|L|XL|XXL)/i, size: null }
  ];
  
  for (const pattern of sizePatterns) {
    const match = titleUpper.match(pattern.regex);
    if (match) return pattern.size || match[1];
  }
  
  const numericMatch = title.match(/\b(1[5-9]|2[0-3])\s*(zoll|"|'')/i);
  if (numericMatch) {
    const inches = parseInt(numericMatch[1]);
    if (inches <= 16) return 'S';
    if (inches <= 18) return 'M';
    if (inches <= 20) return 'L';
    return 'XL';
  }
  return null;
}

const testTitles = [
  'Canyon Torque 2025 XL Fully',
  'Santa Cruz Bronson 2018 M MTB',
  'YT Industries Capra Pro 2021 Größe L',
  'Specialized Enduro S-Works 2019 Rahmen 19 Zoll',
  'YT Capra 2020'
];

testTitles.forEach(title => {
  const brand = extractBrand(title);
  const year = extractYear(title);
  const size = extractFrameSize(title);
  console.log(`"${title}"`);
  console.log(`  Brand: ${brand}, Year: ${year || 'NOT FOUND'}, Size: ${size || 'NOT FOUND'}\n`);
});
