import type { AddonSelection, DeliveryOptionId } from "@/data/buyoutOptions";
import { normalizeEurToRubRate, RATES } from "@/lib/pricing";

export const CASHFLOW_DEFAULT_EUR_RUB_RATE = 96;

const DELIVERY_PRICE_EUR: Record<DeliveryOptionId, number> = {
  Cargo: 170,
  CargoProtected: 170,
  EMS: 220,
  EMSProtected: 220,
  PremiumGroup: 450,
  Premium: 600,
};

export function getDeliveryPriceEur(deliveryId: DeliveryOptionId) {
  return DELIVERY_PRICE_EUR[deliveryId] ?? 170;
}

const INSPECTION_PROMO_END_UTC = Date.UTC(2026, 2, 31, 23, 59, 59, 999);

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateServiceFeeEur(bikePriceEur: number) {
  if (bikePriceEur <= 1000) return 180;
  if (bikePriceEur <= 1500) return 230;
  if (bikePriceEur <= 2200) return 300;
  if (bikePriceEur <= 3000) return 380;
  if (bikePriceEur <= 4000) return 500;
  if (bikePriceEur <= 5000) return 650;
  return round2(bikePriceEur * 0.1);
}

function qty(selection: AddonSelection, addonId: string) {
  return Math.max(0, Number(selection[addonId] || 0));
}

export function calculateCheckoutCashflow({
  bikePriceEur,
  deliveryId,
  addons,
  eurToRubRate,
  now = new Date(),
}: {
  bikePriceEur: number;
  deliveryId: DeliveryOptionId;
  addons: AddonSelection;
  eurToRubRate?: number;
  now?: Date;
}) {
  const exchangeRate = normalizeEurToRubRate(
    eurToRubRate ?? RATES.eur_to_rub,
    CASHFLOW_DEFAULT_EUR_RUB_RATE
  );
  const bike = Math.max(0, Number(bikePriceEur || 0));
  const delivery = getDeliveryPriceEur(deliveryId);
  const service = calculateServiceFeeEur(bike);
  const insuranceFees = round2(bike * 0.025 + 40);

  const personalInspectionQty = qty(addons, "personal_inspection");
  const extraPackagingQty = qty(addons, "extra_packaging");
  const videoCallQty = qty(addons, "video_call");

  const inspectionUnitPrice = now.getTime() <= INSPECTION_PROMO_END_UTC ? 0 : 80;
  const inspection = round2(personalInspectionQty * inspectionUnitPrice);
  const packaging = round2(extraPackagingQty * 15);
  const video = round2(videoCallQty * 15);
  const optionalServices = round2(inspection + packaging + video);

  const cargoInsuranceSelected = qty(addons, "cargo_insurance") > 0 || qty(addons, "extra_insurance") > 0;
  const cargoInsurance = cargoInsuranceSelected ? 40 : 0;

  const subtotal = round2(bike + delivery + service + insuranceFees + cargoInsurance + optionalServices);
  const paymentCommission = round2(subtotal * 0.07);
  const totalEur = round2(subtotal + paymentCommission);
  const totalRub = Math.ceil(totalEur * exchangeRate);
  const reservationRub = Math.ceil(totalRub * 0.02);

  const servicesAndFeesEur = round2(totalEur - bike - delivery);
  const servicesAndFeesRub = Math.ceil(servicesAndFeesEur * exchangeRate);

  return {
    exchangeRate,
    bikeEur: bike,
    deliveryEur: delivery,
    serviceEur: service,
    insuranceFeesEur: insuranceFees,
    cargoInsuranceEur: cargoInsurance,
    optionalServicesEur: optionalServices,
    subtotalEur: subtotal,
    paymentCommissionEur: paymentCommission,
    servicesAndFeesEur,
    servicesAndFeesRub,
    totalEur,
    totalRub,
    reservationRub,
  };
}
