// backend/scripts/test-brand-extraction.js

const UnifiedHunter = require('../../telegram-bot/unified-hunter');

// Mock options to avoid DB/Gemini init if possible or just ignore errors
const hunter = new UnifiedHunter({ logger: () => {} });

// Ensure methods are bound if needed, but they are on prototype.
// The error suggests that maybe we are requiring a different file or the previous edit failed silently/partially?
// We will manually check prototype.

const testTitles = [
  'Santa Cruz Heckler 6 MTB Fully L',
  'YT Capra 29 2021 Mountainbike',
  'Specialized S-Works Epic Hardtail',
  'Canyon Spectral CF 8.0 2022',
  'Scott Genius 920 MTB Fully',
  'Cube Stereo 140 HPC Race 29',
  'Invalid Listing - No Brand Here'
];

console.log('🧪 BRAND EXTRACTION TEST\n');

testTitles.forEach(title => {
  // Direct prototype check
  const brandFn = hunter.extractBrandFromTitle;
  if (typeof brandFn !== 'function') {
      console.error('ERROR: extractBrandFromTitle is NOT a function on hunter instance.');
      // Try to see what IS on hunter
      console.log('Hunter keys:', Object.keys(hunter));
      console.log('Hunter proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(hunter)));
      return;
  }

  const brand = hunter.extractBrandFromTitle(title);
  const model = brand ? hunter.extractModelFromTitle(title, brand) : null;
  
  console.log(`Title: "${title}"`);
  console.log(`  → Brand: ${brand || 'NOT DETECTED'}`);
  console.log(`  → Model: ${model || 'N/A'}\n`);
});
