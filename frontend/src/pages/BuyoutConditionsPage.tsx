import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Info, MapPin } from "lucide-react";

import { apiGet, resolveImageUrl } from "@/api";
import { formatRUB } from "@/lib/pricing";
import { calculateCheckoutCashflow, getDeliveryPriceEur } from "@/lib/cashflowPricing";
import { DELIVERY_OPTIONS } from "@/data/buyoutOptions";
import type { AddonSelection, DeliveryOptionId } from "@/data/buyoutOptions";

type DraftV1 = {
  v: 1;
  bikeId: string;
  delivery: DeliveryOptionId;
  addons: AddonSelection;
};

type InfoStrip = {
  title: string;
  text: string;
  href: string;
  linkText: string;
};

type CheckoutAddon = {
  id: string;
  title: string;
  description: string;
  priceEur: number;
  badge?: string;
  badgeTone?: "neutral" | "accent";
};

function draftKey(bikeId: string) {
  return `booking_checkout_draft_v1:${bikeId}`;
}

function readDraft(bikeId: string): DraftV1 | null {
  try {
    const raw = sessionStorage.getItem(draftKey(bikeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return null;
    if (String(parsed.bikeId || "") !== String(bikeId || "")) return null;
    return parsed as DraftV1;
  } catch {
    return null;
  }
}

export default function BuyoutConditionsPage() {
  const { id } = useParams();
  const bikeId = String(id || "");
  const navigate = useNavigate();
  const location = useLocation();

  const initialBike = (location.state as any)?.bike || null;

  const [bike, setBike] = useState<any>(initialBike);
  const [loading, setLoading] = useState(!initialBike);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [delivery, setDelivery] = useState<DeliveryOptionId>("Cargo");
  const [addons, setAddons] = useState<AddonSelection>({});
  const [showAllDelivery, setShowAllDelivery] = useState(false);

  useEffect(() => {
    if (!bikeId) return;
    const d = readDraft(bikeId);
    if (!d) return;
    setDelivery(d.delivery || "Cargo");
    setAddons(d.addons || {});
  }, [bikeId]);

  useEffect(() => {
    if (bike || !bikeId) return;

    let mounted = true;
    setLoading(true);
    setLoadError(null);

    apiGet(`/bikes/${bikeId}`)
      .then((data) => {
        if (!mounted) return;
        const resolved = (data as any)?.bike || (data as any)?.data || data;
        setBike(resolved || null);
      })
      .catch(() => {
        if (!mounted) return;
        setLoadError("Не удалось загрузить данные о байке. Попробуйте позже.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [bike, bikeId]);

  const bikePriceEur = Number((bike as any)?.price || (bike as any)?.price_eur || 0);

  const deliveryOption = DELIVERY_OPTIONS.find((o) => o.id === delivery) || DELIVERY_OPTIONS[0];
  const availableDeliveryOptionIds: DeliveryOptionId[] = ["Cargo", "EMS", "PremiumGroup", "Premium"];
  const primaryDeliveryOptionIds: DeliveryOptionId[] = ["Cargo", "EMS"];

  const cashflow = useMemo(
    () => calculateCheckoutCashflow({ bikePriceEur, deliveryId: delivery, addons }),
    [bikePriceEur, delivery, addons]
  );
  const totalRub = cashflow.totalRub;
  const totalEur = cashflow.totalEur;
  const formatEur = (value: number) => `€ ${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}`;
  const inspectionPromoActive = Date.now() <= Date.UTC(2026, 2, 31, 23, 59, 59, 999);

  const checkoutAddons: CheckoutAddon[] = [
    {
      id: "cargo_insurance",
      title: "Страховка груза",
      description: "Дополнительная защита на этапе международной перевозки и сортировки.",
      priceEur: 40,
      badge: "Рекомендуем для байков от € 1 500",
      badgeTone: "accent",
    },
    {
      id: "personal_inspection",
      title: "Экспертная проверка",
      description: "Проверим состояние байка перед выкупом и добавим фотофиксацию ключевых узлов.",
      priceEur: inspectionPromoActive ? 0 : 80,
      badge: inspectionPromoActive ? "Акция до 31.03.2026" : undefined,
      badgeTone: inspectionPromoActive ? "accent" : "neutral",
    },
    {
      id: "video_call",
      title: "Видеозвонок с байком",
      description: "Короткий live-осмотр перед финальным подтверждением выкупа.",
      priceEur: 15,
    },
    {
      id: "extra_packaging",
      title: "Усиленная упаковка",
      description: "Дополнительная защита рамы и уязвимых элементов в транспортной упаковке.",
      priceEur: 15,
    },
  ];

  const isAddonEnabled = (addonId: string) => Math.max(0, Number(addons[addonId] || 0)) > 0;
  const setAddonEnabled = (addonId: string, enabled: boolean) => {
    setAddons((prev) => {
      const next = { ...prev };
      if (enabled) {
        next[addonId] = 1;
      } else {
        delete next[addonId];
      }
      return next;
    });
  };

  const selectedAddonsCount = checkoutAddons.filter((addon) => isAddonEnabled(addon.id)).length;
  const selectedAddonsTotalEur = cashflow.cargoInsuranceEur + cashflow.optionalServicesEur;

  const proceed = () => {
    if (!bikeId) return;
    const d: DraftV1 = { v: 1, bikeId, delivery, addons };
    try {
      sessionStorage.setItem(draftKey(bikeId), JSON.stringify(d));
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    navigate(`/booking-checkout/${bikeId}/booking`);
  };

  if (loading && !bike) {
    return (
      <div className="min-h-screen bg-zinc-100 px-4 text-zinc-900 flex items-center justify-center">
        <Card className="w-full max-w-lg rounded-[12px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-3 h-5 w-1/2 animate-pulse rounded bg-[#f4f4f5]" />
          <div className="mb-6 h-4 w-2/3 animate-pulse rounded bg-[#f4f4f5]" />
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-[12px] bg-[#f4f4f5]" />
            <div className="h-12 animate-pulse rounded-[12px] bg-[#f4f4f5]" />
            <div className="h-12 animate-pulse rounded-[12px] bg-[#f4f4f5]" />
          </div>
        </Card>
      </div>
    );
  }

  if (!bike && !loading) {
    return (
      <div className="min-h-screen bg-zinc-100 px-4 text-zinc-900 flex items-center justify-center">
        <Card className="w-full max-w-lg rounded-[12px] border border-zinc-200 bg-white p-6 text-center space-y-3 shadow-sm">
          <h2 className="text-lg font-semibold">Ошибка загрузки</h2>
          <p className="text-sm text-zinc-700">{loadError || "Байк не найден"}</p>
          <Button className="h-12 rounded-[8px] bg-[#18181b] px-8 text-white hover:bg-black" onClick={() => navigate("/catalog")}>
            Перейти в каталог
          </Button>
        </Card>
      </div>
    );
  }

  const title =
    (bike as any)?.title ||
    (bike as any)?.name ||
    `${(bike as any)?.brand || ""} ${(bike as any)?.model || ""}`.trim() ||
    "Байк";

  const mediaGalleryFirst = Array.isArray((bike as any)?.media?.gallery)
    ? (bike as any).media.gallery[0]
    : null;
  const imagesFirst = Array.isArray((bike as any)?.images) ? (bike as any).images[0] : null;
  const bikeImageCandidate =
    (bike as any)?.main_image ??
    (bike as any)?.image ??
    (bike as any)?.image_url ??
    (bike as any)?.media?.main_image ??
    (typeof mediaGalleryFirst === "string" ? mediaGalleryFirst : (mediaGalleryFirst as any)?.image_url) ??
    (typeof imagesFirst === "string" ? imagesFirst : (imagesFirst as any)?.image_url) ??
    null;
  const bikeImage = resolveImageUrl(bikeImageCandidate) || "/placeholder-bike.svg";

  const bikeFrameSize = (bike as any)?.frameSize || (bike as any)?.size || null;
  const bikeYear = (bike as any)?.year || (bike as any)?.model_year || (bike as any)?.modelYear || null;
  const bikeBrand = String((bike as any)?.brand || "").trim();
  const bikeLocation = String((bike as any)?.location || (bike as any)?.city || (bike as any)?.seller_city || "").trim();
  const bikeMetaChips = [
    bikeYear ? `Год: ${bikeYear}` : null,
    bikeFrameSize ? `Размер: ${bikeFrameSize}` : null,
  ].filter(Boolean) as string[];

  const infoStrips: InfoStrip[] = [
    {
      title: "Очередь и приоритетный резерв",
      text: "Бесплатная бронь ставит вас в очередь по времени заявки. Приоритетный резерв 2% не является доплатой сверху: это часть будущего платежа. После оплаты резерва велосипед закрепляется за вами, а бесплатные брони по этому байку закрываются.",
      href: "/journal/reservation-priority-and-queue",
      linkText: "Как работает очередь и резерв",
    },
    {
      title: "Сроки доставки",
      text: `По текущему выбору ориентир ${deliveryOption.eta}. Финальный срок фиксируем после подтверждения продавца, проверки документов и брони логистического окна.`,
      href: "/journal/delivery-process",
      linkText: "Подробнее о доставке в журнале",
    },
    {
      title: "Защита покупателя",
      text: "Оплата открывается только после верификации продавца и состояния велосипеда. До этого мы удерживаем процесс на нашей стороне и исключаем риск перевода средств вслепую.",
      href: "/journal/insurance-guarantee",
      linkText: "Подробнее о защите в журнале",
    },
    {
      title: "Проверка и выкуп",
      text: "Если байк не проходит проверку по состоянию или документам, бронь отменяется без штрафов. Если всё подтверждено, запускаем выкуп и доставку в РФ по выбранному тарифу.",
      href: "/journal/protocol-130",
      linkText: "Подробнее о проверке в журнале",
    },
    {
      title: "Таможня",
      text: "Таможенное оформление и пакет документов мы ведем централизованно. До выдачи вы видите прозрачный статус по каждому этапу и не остаетесь без информации о грузе.",
      href: "/journal/delivery-process",
      linkText: "Подробнее о таможне в журнале",
    },
    {
      title: "FAQ",
      text: "Когда фиксируются точные даты, когда и за что платить, и что происходит при отклонении сделки по проверке — все ответы собрали в одном разделе.",
      href: "/journal",
      linkText: "Читать FAQ в журнале",
    },
  ];

  return (
    <div className="checkout-desktop-soft min-h-screen bg-[#f4f4f5] text-zinc-900">
      <BikeflipHeaderPX />

      <div className="mx-auto max-w-[1120px] px-4 pb-40 pt-4 md:pt-6">
        <div className="mb-5 flex flex-wrap items-center gap-4 text-sm">
          <button
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-zinc-700 hover:bg-zinc-100"
            onClick={() => navigate(`/product/${bikeId}`)}
          >
            Назад
          </button>

          <div className="flex items-center gap-2 text-zinc-700">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-black text-xs font-semibold text-white">1</span>
            <span className="font-medium text-zinc-900">Доставка</span>
            <span className="mx-1 h-px w-8 bg-zinc-300" />
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-200 text-xs font-semibold text-zinc-400">2</span>
            <span className="text-zinc-400">Оплата</span>
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <Card className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="heading-fielmann text-2xl leading-none text-zinc-950 lg:text-[28px]">Выбор доставки</h2>
                  <p className="mt-2 text-sm text-zinc-600 md:text-base">
                    Стандарт и ускоренная доставка доступны сразу. Остальные тарифы можно открыть кнопкой ниже.
                  </p>
                </div>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                  Шаг 1 из 2
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {(showAllDelivery
                  ? DELIVERY_OPTIONS.filter((opt) => availableDeliveryOptionIds.includes(opt.id))
                  : DELIVERY_OPTIONS.filter((opt) => primaryDeliveryOptionIds.includes(opt.id))).map((opt) => (
                    <label
                      key={opt.id}
                      className={`group block cursor-pointer rounded-xl border p-4 transition-colors ${delivery === opt.id ? "border-zinc-900 bg-white" : "border-zinc-200 bg-zinc-50/40 hover:border-zinc-400"}`}
                      onClick={() => setDelivery(opt.id)}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${delivery === opt.id ? "border-zinc-900" : "border-zinc-300"}`}>
                          {delivery === opt.id ? <span className="h-2.5 w-2.5 rounded-full bg-black" /> : null}
                        </span>

                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-2xl font-semibold leading-tight text-zinc-950 lg:text-[24px]">{opt.title}</div>
                            <div className="text-2xl font-semibold leading-tight text-zinc-950 lg:text-[24px]">€ {getDeliveryPriceEur(opt.id)}</div>
                          </div>

                          <div className="mt-1 text-base text-zinc-700 md:text-lg">{opt.subtitle}</div>

                          <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#e5eff8] px-3 py-1 text-sm text-zinc-700">
                            <MapPin className="h-3.5 w-3.5" />
                            Ориентировочная доставка: <strong>{opt.eta}</strong>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}

                <Button
                  variant="outline"
                  className="h-11 rounded-full border border-zinc-900 px-6 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
                  onClick={() => setShowAllDelivery((prev) => !prev)}
                >
                  {showAllDelivery ? "Скрыть дополнительные варианты" : "Показать все варианты"}
                </Button>
              </div>
            </Card>

            <Card className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 lg:text-[26px]">Дополнительные услуги</h3>
                  <p className="mt-2 text-sm text-zinc-600 md:text-base">
                    Выберите только нужные опции. Все изменения сразу отражаются в расчётах справа.
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-right text-xs text-zinc-600">
                  <div>Выбрано: {selectedAddonsCount}</div>
                  <div className="mt-0.5 font-semibold text-zinc-900">+ {formatEur(selectedAddonsTotalEur)}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {checkoutAddons.map((addon) => {
                  const enabled = isAddonEnabled(addon.id);
                  return (
                    <div
                      key={addon.id}
                      className={`rounded-xl border p-4 transition-colors ${enabled ? "border-zinc-900 bg-white" : "border-zinc-200 bg-zinc-50/40 hover:border-zinc-400"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-zinc-950">{addon.title}</div>
                            {addon.badge ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${addon.badgeTone === "accent" ? "bg-[#e5eff8] text-zinc-800" : "bg-zinc-100 text-zinc-700"}`}
                              >
                                {addon.badge}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm leading-relaxed text-zinc-700">{addon.description}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-sm font-semibold text-zinc-900">
                            {formatEur(addon.priceEur)}
                          </span>
                          <Button
                            type="button"
                            variant={enabled ? "default" : "outline"}
                            className={enabled ? "h-9 rounded-full bg-black px-4 text-xs font-semibold text-white hover:bg-zinc-800" : "h-9 rounded-full border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"}
                            onClick={() => setAddonEnabled(addon.id, !enabled)}
                          >
                            {enabled ? "Убрать" : "Добавить"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
              <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 lg:text-[26px]">Сроки, защита, выкуп и FAQ</h3>
              <div className="mt-4 border-y border-zinc-200">
                {infoStrips.map((item, idx) => (
                  <details key={item.title} className={`group ${idx > 0 ? "border-t border-zinc-200" : ""}`}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-2 py-4 text-base font-medium text-zinc-900 lg:text-[22px] lg:leading-tight">
                      <span>{item.title}</span>
                      <span className="text-3xl leading-none text-zinc-500 transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <div className="pb-4 px-2 text-sm leading-relaxed text-zinc-700 md:text-base">
                      {item.text}
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-1 font-medium text-zinc-900 hover:text-black"
                        onClick={() => navigate(item.href)}
                      >
                        {item.linkText}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </details>
                ))}
              </div>
            </Card>

          </div>

          <aside className="lg:h-fit lg:self-start lg:sticky lg:top-5">
            <Card className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
              <div>
                <h2 className="heading-fielmann text-[21px] leading-none text-zinc-950">Сводка заказа</h2>

                <div className="mt-3 flex items-start gap-3">
                  <div className="w-[148px] shrink-0 overflow-hidden rounded-[10px] border border-zinc-200 bg-zinc-100">
                    <img src={bikeImage} alt={title} className="h-[106px] w-full object-cover" loading="lazy" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {bikeBrand ? <div className="text-[13px] text-zinc-700">{bikeBrand}</div> : null}
                    <div className="mt-0.5 text-[20px] leading-[1.08] font-semibold tracking-tight text-zinc-950">{title}</div>
                    {bikeLocation ? <div className="mt-1 text-[13px] text-zinc-600">{bikeLocation}</div> : null}

                    {bikeMetaChips.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {bikeMetaChips.map((chip) => (
                          <span key={chip} className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] text-zinc-700">
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 border-t border-zinc-200 pt-3 text-sm text-zinc-800">
                  <div className="flex justify-between"><span>Цена велосипеда</span><span className="tabular-nums font-medium">{formatEur(cashflow.bikeEur)}</span></div>
                  <div className="mt-1.5 flex justify-between"><span>Сервис</span><span className="tabular-nums font-medium">{formatEur(cashflow.serviceEur)}</span></div>
                  <div className="mt-1.5 flex justify-between"><span>Доставка</span><span className="tabular-nums font-medium">{formatEur(cashflow.deliveryEur)}</span></div>
                  <div className="mt-1.5 flex justify-between"><span>Безопасная оплата</span><span className="tabular-nums font-medium">{formatEur(cashflow.insuranceFeesEur)}</span></div>
                  {cashflow.cargoInsuranceEur > 0 && (
                    <div className="mt-1.5 flex justify-between"><span>Страховка груза</span><span className="tabular-nums font-medium">{formatEur(cashflow.cargoInsuranceEur)}</span></div>
                  )}
                  {cashflow.optionalServicesEur > 0 && (
                    <div className="mt-1.5 flex justify-between"><span>Доп. услуги</span><span className="tabular-nums font-medium">{formatEur(cashflow.optionalServicesEur)}</span></div>
                  )}
                  <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 text-[12px] text-zinc-500">
                    <span>Промежуточная сумма</span>
                    <span className="tabular-nums">{formatEur(cashflow.subtotalEur)}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between"><span>Комиссия за перевод (7%)</span><span className="tabular-nums font-medium">{formatEur(cashflow.paymentCommissionEur)}</span></div>
                  <div className="mt-3 flex justify-between border-t border-zinc-200 pt-3 text-[21px] font-semibold text-zinc-950">
                    <span>Итого</span>
                    <span className="flex items-baseline gap-2 text-right">
                      <span className="tabular-nums">{formatRUB(totalRub)}</span>
                      <span className="tabular-nums text-sm font-medium text-zinc-500">{formatEur(totalEur)}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-zinc-100 p-2.5 text-[11px] leading-relaxed text-zinc-700">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4" />
                    <span>Оплата после проверки продавца и подтверждения состояния байка.</span>
                  </div>
                </div>
              </div>

              <Button
                className="mt-4 h-11 w-full rounded-full bg-black text-sm font-semibold text-white hover:bg-zinc-800"
                onClick={proceed}
              >
                К бесплатной брони
              </Button>
            </Card>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold">Итого: {formatRUB(totalRub)}</div>
              <div className="text-xs text-zinc-700">Сейчас 0 ₽ • оплата после проверки</div>
            </div>
            <Button className="h-11 whitespace-nowrap rounded-full bg-black px-6 text-sm font-semibold text-white hover:bg-zinc-800" onClick={proceed}>
              К бесплатной брони
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
