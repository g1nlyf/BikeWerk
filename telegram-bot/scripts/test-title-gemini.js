const path = require('path');
const GeminiProcessor = require('../gemini-processor');

(async () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  const gp = new GeminiProcessor(apiKey, apiUrl);
  const first = process.env.TEST_FIRST
    ? path.resolve(process.env.TEST_FIRST)
    : path.resolve(__dirname, '../screenshots/screenshot_1763739719785_part1.jpg');
  const second = process.env.TEST_SECOND
    ? path.resolve(process.env.TEST_SECOND)
    : path.resolve(__dirname, '../screenshots/screenshot_1763739719785_part2.jpg');
  const ctx = {
    title: 'Specialized Status 160 S4',
    location: '',
    price: 0,
    originalUrl: 'https://www.kleinanzeigen.de/s-anzeige/specialized-status-160-s4/3106536764-217-7614'
  };
  const res = await gp.processBikeDataFromTwoShots(first, second, ctx);
  console.log('--- TWO SHOTS RESULT ---');
  console.log(JSON.stringify(res, null, 2));
  const raw = {
    title: ctx.title,
    description: null,
    brand: null,
    model: null,
    price: ctx.price,
    location: ctx.location,
    frameSize: null,
    wheelDiameter: null,
    year: null,
    category: null,
    isNegotiable: null,
    deliveryOption: null,
    originalUrl: ctx.originalUrl
  };
  const unified = await gp.finalizeUnifiedData(raw, res);
  console.log('--- FINAL UNIFIED ---');
  console.log(JSON.stringify(unified, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });