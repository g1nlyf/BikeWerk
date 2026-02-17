/**
 * BikeWerk Frontend Pricing Calculator
 * Must stay in sync with backend PriceCalculatorService.js.
 */

let initialRate = 96;
try {
  const v = localStorage.getItem('eur_to_rub');
  if (v) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) initialRate = n;
  }
} catch {
  // ignore
}

export const RATES = {
  eur_to_rub: initialRate,
  real_delivery: 170,
};

export const COMPLIANCE_LIMITS = {
  minBikePriceEur: 500,
  maxBikePriceEur: 5000,
} as const;

import { apiGet } from '@/api';

export async function refreshRates() {
  try {
    const data = await apiGet('/rates/eur');
    const v = Number(data && data.value);
    if (Number.isFinite(v) && v > 0) {
      RATES.eur_to_rub = v;
      try {
        localStorage.setItem('eur_to_rub', String(v));
      } catch {
        // ignore
      }
      return v;
    }
  } catch {
    // ignore
  }
  return RATES.eur_to_rub;
}

export function getEurRate() {
  return RATES.eur_to_rub;
}

export function formatEUR(amount: number) {
  const v = Math.round(amount || 0);
  return `${v} €`;
}

export function formatRUB(amountRub: number) {
  const rub = Math.round(amountRub || 0);
  return `${rub.toLocaleString('ru-RU')} ₽`;
}

export function formatRUBFromEUR(amountEur: number, rate = RATES.eur_to_rub) {
  const eur = Number(amountEur || 0);
  const r = normalizeEurToRubRate(rate);
  return formatRUB(Math.round(eur * r));
}

export function normalizeEurToRubRate(value: unknown, fallback = RATES.eur_to_rub) {
  const n = Number(value);
  const fb = Number(fallback);
  if (!Number.isFinite(n) || n <= 0) return Number.isFinite(fb) && fb > 0 ? fb : 96;
  if (n > 1000) return n / 100;
  return n;
}

function calculateServiceFeeEur(bikePriceEur: number) {
  const price = Number(bikePriceEur || 0);
  if (!Number.isFinite(price) || price <= 0) return 0;

  if (price <= 1000) return 180;
  if (price <= 1500) return 230;
  if (price <= 2200) return 300;
  if (price <= 3000) return 380;
  if (price <= 4000) return 500;
  if (price <= 5000) return 650;
  return price * 0.10;
}

/**
 * @param bikePriceEur Bike price in EUR
 * @param shippingOption Delivery method
 * @param cargoInsurance Include optional 40 EUR cargo insurance
 */
export function calculatePriceBreakdown(
  bikePriceEur: number,
  shippingOption: 'Cargo' | 'EMS' | 'PremiumGroup' | 'PremiumIndividual' = 'Cargo',
  cargoInsurance: boolean = false
) {
  const shippingRates = {
    Cargo: 170,
    EMS: 220,
    PremiumGroup: 450,
    PremiumIndividual: 600,
  };
  const shippingCostEur = shippingRates[shippingOption] || 170;

  const serviceFeeEur = calculateServiceFeeEur(bikePriceEur);
  const insuranceFeesEur = bikePriceEur * 0.025 + 40;
  const cargoInsuranceEur = cargoInsurance ? 40 : 0;

  const subtotalEur = bikePriceEur + shippingCostEur + serviceFeeEur + insuranceFeesEur + cargoInsuranceEur;
  const paymentCommissionEur = subtotalEur * 0.07;
  const totalEur = subtotalEur + paymentCommissionEur;

  const totalRub = Math.ceil(totalEur * RATES.eur_to_rub);
  const bookingRub = Math.ceil(totalRub * 0.02);

  return {
    totalRub,
    bookingRub,
    details: {
      bikePriceEur: Number(bikePriceEur.toFixed(2)),
      shippingCostEur: Number(shippingCostEur.toFixed(2)),
      serviceFeeEur: Number(serviceFeeEur.toFixed(2)),
      insuranceFeesEur: Number(insuranceFeesEur.toFixed(2)),
      cargoInsuranceEur: Number(cargoInsuranceEur.toFixed(2)),
      subtotalEur: Number(subtotalEur.toFixed(2)),
      paymentCommissionEur: Number(paymentCommissionEur.toFixed(2)),
      exchangeRate: RATES.eur_to_rub,
      shippingMethod: shippingOption,
      finalPriceEur: Number(totalEur.toFixed(2)),
    },
  };
}

export function calculatePriceBreakdownWithDeliveryCost(
  bikePriceEur: number,
  deliveryCostEur: number,
  cargoInsurance: boolean = false,
  eurToRubRate?: number
) {
  const bikePrice = Number(bikePriceEur || 0);
  const delivery = Number(deliveryCostEur || 0);
  const rate = normalizeEurToRubRate(eurToRubRate ?? RATES.eur_to_rub);

  const serviceFeeEur = calculateServiceFeeEur(bikePrice);
  const insuranceFeesEur = bikePrice * 0.025 + 40;
  const cargoInsuranceEur = cargoInsurance ? 40 : 0;
  const subtotalEur = bikePrice + delivery + serviceFeeEur + insuranceFeesEur + cargoInsuranceEur;
  const paymentCommissionEur = subtotalEur * 0.07;
  const totalEur = subtotalEur + paymentCommissionEur;
  const totalRub = Math.ceil(totalEur * rate);
  const bookingRub = Math.ceil(totalRub * 0.02);

  return {
    totalRub,
    bookingRub,
    details: {
      bikePriceEur: Number(bikePrice.toFixed(2)),
      shippingCostEur: Number(delivery.toFixed(2)),
      serviceFeeEur: Number(serviceFeeEur.toFixed(2)),
      insuranceFeesEur: Number(insuranceFeesEur.toFixed(2)),
      cargoInsuranceEur: Number(cargoInsuranceEur.toFixed(2)),
      subtotalEur: Number(subtotalEur.toFixed(2)),
      paymentCommissionEur: Number(paymentCommissionEur.toFixed(2)),
      exchangeRate: rate,
      finalPriceEur: Number(totalEur.toFixed(2)),
    },
  };
}

/**
 * Legacy helper used by old UI blocks.
 */
export function calculateMarketingBreakdown(bikePrice: number) {
  const calc = calculatePriceBreakdown(bikePrice, 'Cargo', false);
  return {
    bikePrice,
    serviceCost: calc.details.serviceFeeEur,
    deliveryCost: calc.details.shippingCostEur,
    logisticsFees: calc.details.insuranceFeesEur,
    otherFees: calc.details.paymentCommissionEur,
    totalEur: calc.details.finalPriceEur,
    totalRub: calc.totalRub,
  };
}
