"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Info, LogIn, UserPlus } from "lucide-react";

import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { apiGet, crmApi, metricsApi } from "@/api";
import { useAuth } from "@/lib/auth";
import { formatRUB, getEurRate, normalizeEurToRubRate } from "@/lib/pricing";
import { DELIVERY_OPTIONS, ADDON_OPTIONS, calculateAddonsTotals } from "@/data/buyoutOptions";
import type { DeliveryOptionId, AddonSelection } from "@/data/buyoutOptions";
import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";

type DraftV1 = {
  v: 1;
  bikeId: string;
  delivery: DeliveryOptionId;
  addons: AddonSelection;
};

type SuccessState = {
  order?: string;
  tempPassword?: string;
  login?: string;
};

const contactOptions = [
  { id: "phone", label: "Телефон / WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "email", label: "Email" },
] as const;

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

export default function BookingFinalizePage() {
  const { id } = useParams();
  const bikeId = String(id || "");
  const navigate = useNavigate();
  const { user } = useAuth();

  const [bike, setBike] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [delivery, setDelivery] = useState<DeliveryOptionId>("Cargo");
  const [addons, setAddons] = useState<AddonSelection>({});

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [contactMethod, setContactMethod] = useState<"phone" | "telegram" | "email">("phone");
  const [city, setCity] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const [authOverlayOpen, setAuthOverlayOpen] = useState(false);
  const [authOverlayMode, setAuthOverlayMode] = useState<"login" | "register">("login");
  const [showBookingForm, setShowBookingForm] = useState(false);

  useEffect(() => {
    if (!bikeId) return;
    const draft = readDraft(bikeId);
    if (draft) {
      setDelivery(draft.delivery || "Cargo");
      setAddons(draft.addons || {});
    } else {
      // If user entered from a deep link, we still allow default values.
      setDelivery("Cargo");
      setAddons({});
    }
  }, [bikeId]);

  useEffect(() => {
    if (!bikeId) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    apiGet(`/bikes/${bikeId}`)
      .then((data) => {
        if (!mounted) return;
        const resolved = (data as any)?.bike || (data as any)?.data || data;
        setBike(resolved || null);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Не удалось загрузить данные о байке. Попробуйте позже.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [bikeId]);

  const exchangeRate = useMemo(() => {
    const raw = (bike as any)?.exchange_rate ?? (bike as any)?.price_rate;
    return normalizeEurToRubRate(raw, getEurRate());
  }, [bike]);

  const bikePriceEur = Number((bike as any)?.price || (bike as any)?.price_eur || 0);
  const deliveryOption = DELIVERY_OPTIONS.find((o) => o.id === delivery) || DELIVERY_OPTIONS[0];

  const baseTotalRub = Math.round((bikePriceEur + deliveryOption.priceEur) * exchangeRate);
  const addonsTotals = calculateAddonsTotals({ bikePriceEur, baseTotalRub, exchangeRate, selection: addons });
  const totalRub = baseTotalRub + addonsTotals.totalRub;
  const reservationRub = Math.ceil(totalRub * 0.02);
  const finalPriceEur = bikePriceEur + deliveryOption.priceEur + addonsTotals.totalEur;

  const contactPlaceholder =
    contactMethod === "email"
      ? "Email"
      : contactMethod === "telegram"
        ? "Telegram"
        : "Телефон / WhatsApp";

  const saveDraft = () => {
    if (!bikeId) return;
    const draft: DraftV1 = { v: 1, bikeId, delivery, addons };
    try {
      sessionStorage.setItem(draftKey(bikeId), JSON.stringify(draft));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    saveDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery, addons, bikeId]);

  const handleAddonQty = (addonId: string, qty: number) => {
    setAddons((prev) => ({ ...prev, [addonId]: Math.max(0, qty) }));
  };

  const openLogin = () => {
    setAuthOverlayMode("login");
    setAuthOverlayOpen(true);
  };

  const openRegister = () => {
    setAuthOverlayMode("register");
    setAuthOverlayOpen(true);
  };

  const scrollToBooking = () => {
    setShowBookingForm(true);
    setTimeout(() => {
      const el = document.getElementById("booking-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleSubmitBooking = async () => {
    if (!bike) return;
    if (!name.trim() || !contact.trim() || !city.trim()) {
      const missingFields: string[] = [];
      if (!name.trim()) missingFields.push("name");
      if (!contact.trim()) missingFields.push("contact");
      if (!city.trim()) missingFields.push("city");
      metricsApi.sendEvents([
        {
          type: "checkout_validation_error",
          bikeId: Number((bike as any)?.id || bikeId),
          metadata: { flow: "booking_finalize", missing_fields: missingFields }
        }
      ]).catch(() => void 0);
      setError("Заполните имя, контакт и город.");
      return;
    }
    setSubmitting(true);
    setError(null);
    metricsApi.sendEvents([
      {
        type: "checkout_submit_attempt",
        bikeId: Number((bike as any)?.id || bikeId),
        metadata: { flow: "booking_finalize", contact_method: contactMethod, delivery_option: deliveryOption.id }
      }
    ]).catch(() => void 0);
    try {
      const payload: any = {
        bike_id: (bike as any)?.id || bikeId,
        customer: {
          name: name.trim(),
          email: contactMethod === "email" ? contact.trim() : undefined,
          phone: contactMethod === "phone" ? contact.trim() : undefined,
          telegram_id: contactMethod === "telegram" ? contact.trim() : undefined,
          contact_method: contactMethod,
          contact_value: contact.trim(),
          city: city.trim(),
        },
        bike_details: {
          ...(bike || {}),
          price: bikePriceEur,
          bike_url: (bike as any)?.external_link || (bike as any)?.source_url || (bike as any)?.bike_url,
        },
        delivery_method: deliveryOption.id,
        total_price_rub: totalRub,
        booking_amount_rub: reservationRub,
        exchange_rate: exchangeRate,
        final_price_eur: finalPriceEur,
        addons: Object.entries(addons)
          .filter(([, qty]) => Number(qty) > 0)
          .map(([addonId, qty]) => ({ id: addonId, qty: Number(qty) })),
        booking_form: {
          city: city.trim(),
          contact_method: contactMethod,
          contact_value: contact.trim(),
          comment: comment.trim(),
          delivery_option: deliveryOption.id,
          addons_selection: addons,
        },
      };

      const resp = await crmApi.createBooking(payload);
      if (!resp?.success) throw new Error(resp?.error || "Не удалось создать бронь");
      metricsApi.sendEvents([
        {
          type: "checkout_submit_success",
          bikeId: Number((bike as any)?.id || bikeId),
          metadata: { flow: "booking_finalize", order_code: resp?.order_code || null }
        }
      ]).catch(() => void 0);

      if (resp?.auth?.token) {
        localStorage.setItem("authToken", resp.auth.token);
        if (resp.auth.user) localStorage.setItem("currentUser", JSON.stringify(resp.auth.user));
      }

      setSuccess({
        order: resp.order_code,
        tempPassword: resp?.auth?.temp_password,
        login: contact.trim(),
      });

      try {
        sessionStorage.setItem(
          "booking_auth_hint",
          JSON.stringify({ login: contact.trim(), tempPassword: resp?.auth?.temp_password || "" })
        );
      } catch {
        // no-op
      }
    } catch (e: any) {
      metricsApi.sendEvents([
        {
          type: "checkout_submit_failed",
          bikeId: Number((bike as any)?.id || bikeId),
          metadata: { flow: "booking_finalize", error: String(e?.message || "unknown") }
        }
      ]).catch(() => void 0);
      setError(e?.message || "Ошибка при бронировании");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-[#18181b]">
        <BikeflipHeaderPX />
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <Card className="rounded-[16px] border-zinc-200 p-6 shadow-sm">
            <div className="h-6 w-1/3 rounded bg-[#f4f4f5] animate-pulse" />
            <div className="mt-3 h-4 w-1/2 rounded bg-[#f4f4f5] animate-pulse" />
            <div className="mt-8 grid gap-3">
              <div className="h-14 rounded-full bg-[#f4f4f5] animate-pulse" />
              <div className="h-14 rounded-full bg-[#f4f4f5] animate-pulse" />
              <div className="h-14 rounded-full bg-[#f4f4f5] animate-pulse" />
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (!bike) {
    return (
      <div className="min-h-screen bg-white text-[#18181b]">
        <BikeflipHeaderPX />
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <Card className="rounded-[16px] border-zinc-200 p-6 shadow-sm">
            <div className="text-lg font-semibold">Байк не найден</div>
            <div className="mt-2 text-sm text-zinc-500">Вернитесь в каталог и откройте карточку снова.</div>
            <div className="mt-6">
              <Button className="h-12 rounded-[12px] bg-[#18181b] px-8 text-white" onClick={() => navigate("/catalog")}>
                Перейти в каталог
              </Button>
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (success?.order) {
    return (
      <div className="min-h-screen bg-white text-[#18181b]">
        <BikeflipHeaderPX />
        <main className="mx-auto max-w-[920px] px-4 py-10">
          <Card className="rounded-[16px] border-zinc-200 p-6 shadow-sm">
            <div className="text-2xl font-semibold">Бронь создана</div>
            <div className="mt-2 text-sm text-zinc-500">
              Номер брони: <span className="font-medium text-[#18181b]">{success.order}</span>
            </div>

            <div className="mt-6 rounded-[12px] border border-zinc-200 bg-[#f4f4f5] p-4 text-sm">
              <div className="font-medium">Доступ к аккаунту</div>
              <div className="mt-2 grid gap-1">
                <div>Логин: <span className="font-medium">{success.login || "—"}</span></div>
                <div>Пароль: <span className="font-medium">{success.tempPassword || "—"}</span></div>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Если аккаунт уже существовал, пароль может не показываться.
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                className="h-12 rounded-[12px] bg-[#18181b] px-8 text-white"
                onClick={() => navigate(`/order-tracking/${success.order}`)}
              >
                Перейти к отслеживанию
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-[12px] border-zinc-200 bg-white px-8 hover:bg-[#f4f4f5]"
                onClick={() => navigate(`/product/${bikeId}`)}
              >
                Вернуться к байку
              </Button>
            </div>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const bikeTitle =
    (bike as any)?.title ||
    (bike as any)?.name ||
    `${(bike as any)?.brand || ""} ${(bike as any)?.model || ""}`.trim() ||
    "Байк";

  return (
    <div className="min-h-screen bg-white text-[#18181b]">
      <BikeflipHeaderPX />

      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-8 md:px-6">
        <Breadcrumbs
          items={[
            { label: "Каталог", href: "/catalog" },
            { label: "Карточка байка", href: `/product/${bikeId}` },
            { label: "Условия выкупа", href: `/booking-checkout/${bikeId}` },
            { label: "Бронирование" },
          ]}
        />

        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <section className="rounded-[24px] border border-zinc-200 bg-white p-8 shadow-sm">
              <h1 className="heading-fielmann text-3xl md:text-4xl">BikeWerk аккаунт</h1>
              <p className="text-fielmann mt-3 max-w-xl">
                Войдите или создайте аккаунт, чтобы сохранить бронь, избранное и получать уведомления по проверке.
              </p>

              {user ? (
                <div className="mt-6 rounded-[16px] border border-zinc-200 bg-[#f4f4f5] p-4 text-sm">
                  Вы уже в аккаунте: <span className="font-medium">{user.email || user.phone || `#${user.id}`}</span>
                </div>
              ) : (
                <div className="mt-8 grid gap-4">
                  <Button
                    className="btn-pill-primary h-14"
                    onClick={openLogin}
                  >
                    <LogIn className="mr-2 h-5 w-5" />
                    Войти
                  </Button>
                  <Button
                    variant="outline"
                    className="btn-pill-secondary h-14"
                    onClick={scrollToBooking}
                  >
                    Продолжить как гость
                  </Button>

                  <div className="mt-2 flex flex-col items-center gap-3">
                    <div className="text-sm text-zinc-500">Нет аккаунта?</div>
                    <Button
                      variant="outline"
                      className="btn-pill-secondary h-14 w-full"
                      onClick={openRegister}
                    >
                      <UserPlus className="mr-2 h-5 w-5" />
                      Создать аккаунт
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-[24px] border border-zinc-200 bg-[#f8f9fa] p-8 shadow-sm">
              <div className="text-lg font-semibold">Преимущества аккаунта</div>
              <div className="mt-4 grid gap-3 text-sm">
                {[
                  "Все брони и статусы проверки в одном месте.",
                  "Избранное и сохраненные фильтры для каталога.",
                  "Уведомления по этапам: проверка, выкуп, доставка.",
                  "Быстрее повторное бронирование без лишних шагов.",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 text-[#18181b]" />
                    <div className="text-[#18181b]">{t}</div>
                  </div>
                ))}
              </div>
            </section>

            {(showBookingForm || user) && (
              <section id="booking-form" className="rounded-[24px] border border-zinc-200 bg-white p-8 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">К бронированию</div>
                    <div className="mt-1 text-sm text-zinc-500">
                      Оплата будет производиться только после полной проверки байка и продавца.
                    </div>
                  </div>
                  <Badge className="rounded-full bg-[#f4f4f5] px-3 py-1 text-xs text-[#18181b]">
                    бесплатно
                  </Badge>
                </div>

                <Separator className="my-5" />

                <div className="grid gap-3">
                  <Input
                    placeholder="Имя"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-[12px] border-zinc-200 bg-white"
                  />
                  <Input
                    placeholder={contactPlaceholder}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="h-12 rounded-[12px] border-zinc-200 bg-white"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {contactOptions.map((opt) => (
                      <Button
                        key={opt.id}
                        type="button"
                        variant={contactMethod === opt.id ? "default" : "outline"}
                        className={cn(
                          "h-11 rounded-[12px]",
                          contactMethod === opt.id
                            ? "bg-[#18181b] text-white hover:bg-black"
                            : "border-zinc-200 bg-white text-[#18181b] hover:bg-[#f4f4f5]"
                        )}
                        onClick={() => setContactMethod(opt.id)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <Input
                    placeholder="Город доставки"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-12 rounded-[12px] border-zinc-200 bg-white"
                  />
                  <Input
                    placeholder="Комментарий (необязательно)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="h-12 rounded-[12px] border-zinc-200 bg-white"
                  />

                  {error && (
                    <div className="rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button
                    className="h-12 rounded-[12px] bg-[#18181b] px-8 text-white hover:bg-black"
                    disabled={submitting}
                    onClick={handleSubmitBooking}
                  >
                    {submitting ? "Бронируем..." : "Забронировать"}
                  </Button>

                  <div className="text-xs text-zinc-500">
                    Бронь бесплатная. Резерв 2% оплачивается позже, после проверки, на странице отслеживания.
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24">
            <Card className="rounded-[16px] border-zinc-200 p-5 shadow-sm">
              <div className="text-lg font-semibold">Чек-аут</div>
              <div className="mt-1 text-sm text-zinc-500">{bikeTitle}</div>

              <Separator className="my-4" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-zinc-600">Байк</span>
                  <span className="font-medium">€ {Math.round(bikePriceEur).toLocaleString("ru-RU")}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-zinc-600">Доставка</span>
                  <span className="font-medium">€ {Math.round(deliveryOption.priceEur).toLocaleString("ru-RU")}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-zinc-600">Доп. услуги</span>
                  <span className="font-medium">{formatRUB(addonsTotals.totalRub)}</span>
                </div>
                <div className="flex justify-between gap-3 pt-1 text-base">
                  <span className="font-semibold">Итого</span>
                  <span className="font-semibold">{formatRUB(totalRub)}</span>
                </div>
                <div className="flex justify-between gap-3 text-xs text-zinc-500">
                  <span>Резервирование (2%)</span>
                  <span>{formatRUB(reservationRub)}</span>
                </div>
              </div>

              <div className="mt-4 rounded-[12px] border border-zinc-200 bg-[#f4f4f5] p-4 text-sm">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4" />
                  <div>
                    <div className="font-medium">Оплата только после проверки</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Мы проверяем байк и продавца, и только после этого вы оплачиваете резерв и переходите к выкупу.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <Button
                  variant="outline"
                  className="h-11 rounded-[12px] border-zinc-200 bg-white hover:bg-[#f4f4f5]"
                  onClick={() => navigate(`/booking-checkout/${bikeId}`)}
                >
                  Изменить услуги
                </Button>
                <Button
                  className="h-11 rounded-[12px] bg-[#18181b] text-white hover:bg-black"
                  onClick={scrollToBooking}
                >
                  К бронированию
                </Button>
              </div>
            </Card>

            <Card className="mt-4 rounded-[16px] border-zinc-200 p-5 shadow-sm">
              <div className="text-sm font-semibold">Доставка и услуги</div>
              <div className="mt-3 space-y-3">
                <div className="rounded-[12px] border border-zinc-200 p-3">
                  <div className="text-xs text-zinc-500">Доставка</div>
                  <div className="mt-1 text-sm font-medium">{deliveryOption.title}</div>
                </div>

                <div className="rounded-[12px] border border-zinc-200 p-3">
                  <div className="text-xs text-zinc-500">Доп. услуги</div>
                  <div className="mt-2 space-y-2">
                    {ADDON_OPTIONS.filter((a) => Number(addons[a.id] || 0) > 0).length === 0 && (
                      <div className="text-sm text-zinc-500">Не выбраны</div>
                    )}
                    {ADDON_OPTIONS.filter((a) => Number(addons[a.id] || 0) > 0).map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-zinc-700">{a.title}</span>
                        <span className="font-medium">x{addons[a.id] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </main>

      <Footer />

      <AuthOverlay
        open={authOverlayOpen}
        onOpenChange={setAuthOverlayOpen}
        initialMode={authOverlayMode}
      />
    </div>
  );
}
