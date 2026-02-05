const path = require('path');
// The module exports an instance, not the class
const collector = require('../../scrapers/buycycle-collector');

console.log('--- Buycycle URL Builder Demo ---');

// 1. Target Search Example
const criteria1 = {
    brand: 'Specialized',
    model: 'Stumpjumper',
    minPrice: 1500,
    maxPrice: 4000,
    minYear: 2020,
    frameSizes: ['L', 'XL']
};

const url1 = collector.buildSearchUrl(criteria1);
console.log(`\nCriteria 1 (Targeted): ${JSON.stringify(criteria1, null, 2)}`);
console.log(`Generated URL: ${url1}`);

// 2. Simple Search Example
const criteria2 = {
    brand: 'Santa Cruz',
    model: 'Megatower'
};

const url2 = collector.buildSearchUrl(criteria2);
console.log(`\nCriteria 2 (Simple): ${JSON.stringify(criteria2, null, 2)}`);
console.log(`Generated URL: ${url2}`);

// 3. Category/Opportunity Logic (Simulated)
const categorySegment = 'mountainbike/high-demand/1';
const baseUrl = 'https://buycycle.com/de-de/shop/main-types/bikes/bike-types/';
const url3 = `${baseUrl}${categorySegment}`;
console.log(`\nCriteria 3 (Category/Opportunity): Segment="${categorySegment}"`);
console.log(`Generated URL: ${url3}`);
