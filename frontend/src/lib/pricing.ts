let initialRate = 105; // Default fallback (Hardcoded for Sprint 1 consistency)
try {
  const v = localStorage.getItem('eur_to_rub');
  if (v) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) initialRate = n;
  }
} catch {}

export const RATES = {
  eur_to_rub: initialRate,
  real_delivery: 170, // Default Cargo
};

import { apiGet } from '@/api';

export async function refreshRates() {
  try {
    const data = await apiGet('/rates/eur');
    const v = Number(data && data.value);
    if (Number.isFinite(v) && v > 0) {
      RATES.eur_to_rub = v;
      try { localStorage.setItem('eur_to_rub', String(v)); } catch {}
      return v;
    }
  } catch {}
  return RATES.eur_to_rub;
}

export function getEurRate() {
  return RATES.eur_to_rub;
}

export function formatEUR(amount: number) {
  const v = Math.round(amount || 0);
  return `${v} €`;
}

// NOTE: Most UI components already compute totals in RUB and only need formatting.
export function formatRUB(amountRub: number) {
  const rub = Math.round(amountRub || 0);
  return `${rub.toLocaleString("ru-RU")} ₽`;
}

export function formatRUBFromEUR(amountEur: number, rate = RATES.eur_to_rub) {
  const eur = Number(amountEur || 0);
  const r = normalizeEurToRubRate(rate);
  return formatRUB(Math.round(eur * r));
}

// Some sources may provide rate in "cents" (e.g. 10500 instead of 105).
export function normalizeEurToRubRate(value: unknown, fallback = RATES.eur_to_rub) {
  const n = Number(value);
  const fb = Number(fallback);
  if (!Number.isFinite(n) || n <= 0) return Number.isFinite(fb) && fb > 0 ? fb : 105;
  if (n > 1000) return n / 100;
  return n;
}

/**
 * THE FINANCIAL BRAIN (Frontend Mirror)
 * Matches backend PriceCalculatorService.js logic perfectly.
 */
export function calculatePriceBreakdown(bikePriceEur: number, shippingOption: 'Cargo' | 'CargoProtected' | 'EMS' | 'EMSProtected' | 'Premium' | 'PremiumGroup' = 'Cargo', insuranceIncluded: boolean = true) {
    const shippingRates = {
        'Cargo': 170,
        'CargoProtected': 250,
        'EMS': 220,
        'EMSProtected': 300,
        'Premium': 650,
        'PremiumGroup': 450
    };
    const shippingCostEur = shippingRates[shippingOption] || 170;
    
    // 1. Calculate Margin (M_agent)
    let mAgent = 0;
    if (bikePriceEur < 1500) {
        mAgent = 250;
    } else if (bikePriceEur < 3500) {
        mAgent = 400;
    } else if (bikePriceEur < 6000) {
        mAgent = 600;
    } else {
        mAgent = bikePriceEur * 0.10;
    }

    // 2. Breakdown Components
    const fTransfer = (bikePriceEur + shippingCostEur) * 0.07;
    const fWarehouse = 80;
    const fService = Math.max(0, mAgent - fWarehouse);

    // Insurance
    let insuranceCostEur = 0;
    if (insuranceIncluded) {
        insuranceCostEur = bikePriceEur * 0.04;
    }

    // 3. Total Price (EUR)
    const totalEur = bikePriceEur + shippingCostEur + insuranceCostEur + fTransfer + fWarehouse + fService;

    // 4. Convert to RUB
    const totalRub = Math.ceil(totalEur * RATES.eur_to_rub);
    
    // 5. Booking Deposit (2% of Total RUB)
    const bookingRub = Math.ceil(totalRub * 0.02);

    return {
        totalRub,
        bookingRub,
        details: {
            bikePriceEur,
            shippingCostEur,
            insuranceCostEur,
            paymentCommissionEur: Number(fTransfer.toFixed(2)),
            warehouseFeeEur: Number(fWarehouse.toFixed(2)),
            serviceFeeEur: Number(fService.toFixed(2)),
            marginTotalEur: Number(mAgent.toFixed(2)),
            exchangeRate: RATES.eur_to_rub,
            shippingMethod: shippingOption,
            finalPriceEur: Number(totalEur.toFixed(2))
        }
    };
}

// Deprecated but kept for compatibility with legacy components if any
export function calculateMarketingBreakdown(bikePrice: number) {
  const calc = calculatePriceBreakdown(bikePrice, 'Cargo', false);
  return {
    bikePrice,
    serviceCost: calc.details.serviceFeeEur, // Approx mapping
    deliveryCost: calc.details.shippingCostEur,
    logisticsFees: calc.details.warehouseFeeEur,
    otherFees: calc.details.paymentCommissionEur,
    totalEur: calc.details.finalPriceEur,
    totalRub: calc.totalRub,
  };
}
