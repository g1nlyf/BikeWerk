// backend/config/source-priority.js

const SOURCE_PRIORITY = {
  'buycycle': {
    priority: 100,
    data_completeness: 0.95,
    price_reliability: 0.90,
    shipping_guaranteed: true,
    advantages: [
      'Structured data (year, size always present)',
      'Professional sellers',
      'Buyer protection included'
    ]
  },
   
  'bikeflip': {
    priority: 90,
    data_completeness: 0.85,
    price_reliability: 0.85,
    shipping_guaranteed: true,
    advantages: [
      'Premium focus (high-end bikes)',
      'Verified sellers'
    ]
  },
   
  'kleinanzeigen': {
    priority: 70,
    data_completeness: 0.60, // Often missing year/size
    price_reliability: 0.70,
    shipping_guaranteed: false,
    advantages: [
      'Largest volume',
      'Best prices (private sellers)'
    ]
  }
};

// Strategy: Buycycle for FMV + quality control
//           Kleinanzeigen for hot deals (lowest prices)
//           Bikeflip for premium Tier 1

module.exports = SOURCE_PRIORITY;
