import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Info, Shield, Truck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { apiGet } from "@/api";
import { formatRUB, getEurRate, normalizeEurToRubRate } from "@/lib/pricing";
import { ADDON_OPTIONS, calculateAddonsTotals, DELIVERY_OPTIONS, INCLUDED_SERVICES } from "@/data/buyoutOptions";
import type { AddonSelection, DeliveryOptionId } from "@/data/buyoutOptions";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";

type DraftV1 = {
  v: 1;
  bikeId: string;
  delivery: DeliveryOptionId;
  addons: AddonSelection;
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

  const exchangeRate = useMemo(() => {
    const raw = (bike as any)?.exchange_rate ?? (bike as any)?.price_rate;
    return normalizeEurToRubRate(raw, getEurRate());
  }, [bike]);

  const bikePriceEur = Number((bike as any)?.price || (bike as any)?.price_eur || 0);

  const deliveryOption = DELIVERY_OPTIONS.find((o) => o.id === delivery) || DELIVERY_OPTIONS[0];
  const primaryDeliveryOptionIds: DeliveryOptionId[] = ["Cargo", "EMS", "PremiumGroup"];
  const primaryAddons = ["personal_inspection", "extra_packaging", "extra_insurance"];
  const faqItems = [
    {
      question: "Когда я плачу?",
      answer: "Сейчас ничего не списывается. Сначала мы проверяем продавца и байк, и только после подтверждения вы переходите к оплате.",
    },
    {
      question: "Что входит в проверку?",
      answer: "Проверяем продавца, соответствие байка описанию и документы. При необходимости запрашиваем дополнительные фото и видео.",
    },
    {
      question: "Можно ли отменить бронь?",
      answer: "Да, бронь бесплатная и без штрафов до этапа оплаты.",
    },
    {
      question: "Почему есть EUR и ₽?",
      answer: "EUR — базовая валюта расчёта. Сумма в рублях показывается как ориентир по текущему курсу.",
    },
  ];

  const baseTotalRub = Math.round((bikePriceEur + deliveryOption.priceEur) * exchangeRate);
  const addonsTotals = calculateAddonsTotals({ bikePriceEur, baseTotalRub, exchangeRate, selection: addons });
  const totalRub = baseTotalRub + addonsTotals.totalRub;

  const handleAddonQty = (addonId: string, qty: number) => {
    setAddons((prev) => ({ ...prev, [addonId]: Math.max(0, qty) }));
  };

  const toggleAddon = (addonId: string) => {
    setAddons((prev) => ({ ...prev, [addonId]: prev[addonId] ? 0 : 1 }));
  };

  const proceed = () => {
    if (!bikeId) return;
    const d: DraftV1 = { v: 1, bikeId, delivery, addons };
    try {
      sessionStorage.setItem(draftKey(bikeId), JSON.stringify(d));
    } catch {
      // ignore
    }
    navigate(`/booking-checkout/${bikeId}/booking`);
  };

  if (loading && !bike) {
    return (
      <div className="min-h-screen bg-white text-[#18181b] flex items-center justify-center px-4">
        <Card className="w-full max-w-lg p-6 rounded-[12px] shadow-sm bg-white">
          <div className="h-5 w-1/2 bg-[#f4f4f5] rounded mb-3 animate-pulse" />
          <div className="h-4 w-2/3 bg-[#f4f4f5] rounded mb-6 animate-pulse" />
          <div className="space-y-3">
            <div className="h-12 bg-[#f4f4f5] rounded-[12px] animate-pulse" />
            <div className="h-12 bg-[#f4f4f5] rounded-[12px] animate-pulse" />
            <div className="h-12 bg-[#f4f4f5] rounded-[12px] animate-pulse" />
          </div>
        </Card>
      </div>
    );
  }

  if (!bike && !loading) {
    if (loadError) {
      return (
        <div className="min-h-screen bg-white text-[#18181b] flex items-center justify-center px-4">
          <Card className="w-full max-w-lg p-6 rounded-[12px] shadow-sm bg-white text-center space-y-3">
            <h2 className="text-lg font-semibold">Ошибка загрузки</h2>
            <p className="text-sm text-zinc-500">{loadError}</p>
            <Button className="h-12 rounded-[8px] bg-[#18181b] text-white px-8 hover:bg-black" onClick={() => navigate("/catalog")}>Перейти в каталог</Button>
          </Card>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white text-[#18181b] flex items-center justify-center px-4">
        <Card className="w-full max-w-lg p-6 rounded-[12px] shadow-sm bg-white text-center space-y-3">
          <h2 className="text-lg font-semibold">Байк не найден</h2>
          <p className="text-sm text-zinc-500">Попробуйте вернуться в каталог и открыть карточку снова.</p>
          <Button className="h-12 rounded-[8px] bg-[#18181b] text-white px-8 hover:bg-black" onClick={() => navigate("/catalog")}>Перейти в каталог</Button>
        </Card>
      </div>
    );
  }

  const title =
    (bike as any)?.title ||
    (bike as any)?.name ||
    `${(bike as any)?.brand || ""} ${(bike as any)?.model || ""}`.trim() ||
    "Байк";

  return (
    <div className="min-h-screen bg-white text-[#18181b]">
      <BikeflipHeaderPX />
      <div className="max-w-6xl mx-auto px-4 pb-40 pt-8 space-y-6">
        <header className="flex items-start justify-between gap-6">
          <div>
            <Breadcrumbs
              items={[
                { label: "Каталог", href: "/catalog" },
                { label: "Карточка байка", href: `/product/${bikeId}` },
                { label: "Условия выкупа" },
              ]}
            />
            <h1 className="heading-fielmann text-3xl md:text-4xl mt-3">Условия выкупа и доставки</h1>
            <p className="text-fielmann mt-3">Сейчас ничего платить не нужно — оформим бесплатную бронь, а оплата будет только после проверки.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="rounded-full bg-[#f4f4f5] px-3 py-1 text-xs">Бронь бесплатная</div>
              <div className="rounded-full bg-[#f4f4f5] px-3 py-1 text-xs">Оплата после проверки</div>
              <div className="rounded-full bg-[#f4f4f5] px-3 py-1 text-xs">Отмена без штрафов</div>
            </div>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-sm text-zinc-500">Байк</div>
            <div className="font-medium">{title}</div>
            <div className="text-sm text-zinc-500">{(bike as any)?.frameSize || (bike as any)?.size || ""}</div>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
            <Card className="p-6 rounded-[24px] shadow-sm bg-white border border-zinc-200">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4" />
                <h2 className="font-semibold text-lg">Как проходит процесс</h2>
              </div>
              <div className="grid sm:grid-cols-3 gap-2 text-sm">
                <div className="rounded-xl bg-[#f4f4f5] p-3">
                  <div className="font-medium">1. Бесплатная бронь</div>
                  <p className="mt-1 text-xs text-zinc-500">Фиксируем выбранные условия без оплаты.</p>
                </div>
                <div className="rounded-xl bg-[#f4f4f5] p-3">
                  <div className="font-medium">2. Проверка</div>
                  <p className="mt-1 text-xs text-zinc-500">Проверяем продавца и состояние байка.</p>
                </div>
                <div className="rounded-xl bg-[#f4f4f5] p-3">
                  <div className="font-medium">3. Оплата и доставка</div>
                  <p className="mt-1 text-xs text-zinc-500">Оплачиваете только после подтверждения.</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 rounded-[24px] shadow-sm bg-white border border-zinc-200">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4" />
                <h2 className="font-semibold text-lg">Доставка</h2>
              </div>
              <div className="space-y-3">
                {(showAllDelivery
                  ? DELIVERY_OPTIONS
                  : DELIVERY_OPTIONS.filter((opt) => primaryDeliveryOptionIds.includes(opt.id))).map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${delivery === opt.id ? "border-[#18181b] bg-[#f4f4f5]" : "border-[#e4e4e7] hover:bg-[#f4f4f5]"}`}
                      onClick={() => setDelivery(opt.id)}
                    >
                      <span className={`mt-1 h-4 w-4 rounded-full border ${delivery === opt.id ? "bg-[#18181b] border-[#18181b]" : "border-zinc-400"}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{opt.title}</div>
                          <div className="font-semibold">€ {opt.priceEur}</div>
                        </div>
                        <div className="text-sm text-zinc-500">{opt.subtitle}</div>
                        <div className="text-xs text-zinc-500">Сроки: {opt.eta}</div>
                        {opt.highlight && <div className="mt-1 text-xs text-[#18181b]">{opt.highlight}</div>}
                      </div>
                    </label>
                  ))}
                <Button
                  variant="outline"
                  className="btn-pill-secondary h-11"
                  onClick={() => setShowAllDelivery((prev) => !prev)}
                >
                  {showAllDelivery ? "Скрыть дополнительные варианты" : "Показать все варианты"}
                </Button>
              </div>
            </Card>

            <Card className="p-6 rounded-[24px] shadow-sm bg-white border border-zinc-200">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4" />
                <h2 className="font-semibold text-lg">Доп. услуги</h2>
              </div>
              <div className="space-y-3 text-sm">
                {ADDON_OPTIONS.filter((addon) => primaryAddons.includes(addon.id)).map((addon) => (
                  <div key={addon.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#e4e4e7]">
                    <div>
                      <div className="font-medium">{addon.title}</div>
                      <div className="text-zinc-500 text-xs">{addon.description}</div>
                    </div>
                    <Button size="sm" variant={addons[addon.id] ? "default" : "outline"} className="h-9 rounded-[8px]" onClick={() => toggleAddon(addon.id)}>
                      {addons[addon.id] ? "Включено" : "Добавить"}
                    </Button>
                  </div>
                ))}

                <Accordion type="single" collapsible>
                  <AccordionItem value="more-addons" className="border border-zinc-200 rounded-xl px-3">
                    <AccordionTrigger className="text-sm">Ещё услуги</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {ADDON_OPTIONS.filter((addon) => !primaryAddons.includes(addon.id)).map((addon) => (
                          <div key={addon.id} className="rounded-xl border border-[#e4e4e7] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-medium">{addon.title}</div>
                                <div className="text-zinc-500 text-xs">{addon.description}</div>
                              </div>
                              {addon.type === "per_unit" ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 rounded-full border-zinc-200 bg-white hover:bg-[#f4f4f5]"
                                    onClick={() => handleAddonQty(addon.id, (addons[addon.id] || 0) - 1)}
                                  >
                                    -
                                  </Button>
                                  <div className="w-8 text-center tabular-nums">{addons[addon.id] || 0}</div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 rounded-full border-zinc-200 bg-white hover:bg-[#f4f4f5]"
                                    onClick={() => handleAddonQty(addon.id, (addons[addon.id] || 0) + 1)}
                                  >
                                    +
                                  </Button>
                                </div>
                              ) : (
                                <Button size="sm" variant={addons[addon.id] ? "default" : "outline"} className="h-8 rounded-[8px]" onClick={() => toggleAddon(addon.id)}>
                                  {addons[addon.id] ? "Включено" : "Добавить"}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </Card>

            <Card className="p-6 rounded-[24px] shadow-sm bg-white border border-zinc-200">
              <h2 className="font-semibold text-lg mb-3">Ответы на частые вопросы</h2>
              <Accordion type="single" collapsible>
                {faqItems.map((item, index) => (
                  <AccordionItem key={item.question} value={`faq-${index}`}>
                    <AccordionTrigger className="text-sm text-left">{item.question}</AccordionTrigger>
                    <AccordionContent className="text-sm text-zinc-600">{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>

            <Card className="p-6 rounded-[24px] shadow-sm bg-white border border-zinc-200">
              <h2 className="font-semibold text-lg mb-3">Что включено</h2>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {INCLUDED_SERVICES.map((item) => (
                  <div key={item} className="flex items-center gap-2 p-2 rounded-xl bg-[#f4f4f5]">
                    <Check className="w-4 h-4" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4 order-1 lg:order-2 lg:sticky lg:top-24">
            <Card className="p-6 rounded-[24px] shadow-sm bg-white border border-zinc-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-lg">Итог</h2>
                  <div className="mt-1 text-xs text-zinc-500">Сейчас 0 ₽. Оплата после подтверждения проверки.</div>
                </div>
                <div className="rounded-full bg-[#f4f4f5] px-3 py-1 text-xs text-[#18181b]">бесплатно</div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Байк</span><span>€ {bikePriceEur.toLocaleString("ru-RU")}</span></div>
                <div className="flex justify-between"><span>Доставка</span><span>€ {deliveryOption.priceEur.toLocaleString("ru-RU")}</span></div>
                <div className="flex justify-between"><span>Услуги</span><span>€ {addonsTotals.totalEur.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}</span></div>
                <div className="flex justify-between font-semibold"><span>Итого</span><span>€ {(bikePriceEur + deliveryOption.priceEur + addonsTotals.totalEur).toLocaleString("ru-RU", { maximumFractionDigits: 0 })}</span></div>
                <div className="flex justify-between text-xs text-zinc-500"><span>Ориентир в ₽</span><span>{formatRUB(totalRub)}</span></div>
              </div>

              <div className="mt-4 rounded-[12px] border border-zinc-200 bg-[#f4f4f5] p-4 text-sm">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4" />
                  <div>
                    <div className="font-medium">Оплата только после проверки</div>
                    <div className="mt-1 text-xs text-zinc-500">Мы проверяем байк и продавца. После подтверждения переходите к оплате и выкупу.</div>
                  </div>
                </div>
              </div>

              {loadError && <div className="mt-3 text-sm text-red-600">{loadError}</div>}

              <div className="mt-4 grid gap-2">
                <Button
                  className="btn-pill-primary h-14"
                  onClick={proceed}
                >
                  Перейти к бесплатному бронированию
                </Button>
                <div className="text-center text-xs text-zinc-500">Ничего не спишем на этом шаге</div>
                <Button
                  variant="outline"
                  className="btn-pill-secondary h-14"
                  onClick={() => navigate(`/product/${bikeId}`)}
                >
                  Вернуться к байку
                </Button>
              </div>
            </Card>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white p-3 lg:hidden">
          <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold">Итого: {formatRUB(totalRub)}</div>
              <div className="text-xs text-zinc-500">Сейчас 0 ₽ • оплата после проверки</div>
            </div>
            <Button className="btn-pill-primary h-11 px-6 text-sm" onClick={proceed}>
              К бесплатной брони
            </Button>
          </div>
        </div>
      </div>
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}
