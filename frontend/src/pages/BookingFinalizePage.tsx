"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, CheckCircle2, Copy, Info, LogIn, UserPlus } from "lucide-react";

import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { apiGet, crmApi, metricsApi, resolveImageUrl } from "@/api";
import { useAuth } from "@/lib/auth";
import { formatRUB } from "@/lib/pricing";
import { calculateCheckoutCashflow } from "@/lib/cashflowPricing";
import { DELIVERY_OPTIONS } from "@/data/buyoutOptions";
import type { DeliveryOptionId, AddonSelection } from "@/data/buyoutOptions";
import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { LegalConsentFields } from "@/components/legal/LegalConsentFields";
import { DEFAULT_FORM_LEGAL_CONSENT, buildLegalAuditLine, hasRequiredFormLegalConsent } from "@/lib/legal";

type DraftV1 = {
  v: 1;
  bikeId: string;
  delivery: DeliveryOptionId;
  addons: AddonSelection;
};

type ReservationStrategy = "free_queue" | "priority_reserve";

type SuccessState = {
  order?: string;
  tempPassword?: string;
  login?: string;
  showAccessCredentials?: boolean;
  reservationStrategy?: ReservationStrategy;
  sellerQuestionsCount?: number;
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

function parseSellerQuestions(raw: string): string[] {
  return Array.from(
    new Set(
      String(raw || "")
        .split(/\r?\n+/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .map((line) => line.slice(0, 220))
    )
  ).slice(0, 5);
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
  const [reservationStrategy, setReservationStrategy] = useState<ReservationStrategy>("free_queue");
  const [sellerQuestionsText, setSellerQuestionsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [legalConsent, setLegalConsent] = useState(DEFAULT_FORM_LEGAL_CONSENT);

  const [authOverlayOpen, setAuthOverlayOpen] = useState(false);
  const [authOverlayMode, setAuthOverlayMode] = useState<"login" | "register">("login");
  const [showBookingForm, setShowBookingForm] = useState(false);
  const isAuthenticated = Boolean(user?.id || user?.email || user?.phone);
  const shouldShowBookingForm = isAuthenticated || showBookingForm;

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
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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

  const bikePriceEur = Number((bike as any)?.price || (bike as any)?.price_eur || 0);
  const deliveryOption = DELIVERY_OPTIONS.find((o) => o.id === delivery) || DELIVERY_OPTIONS[0];
  const cashflow = useMemo(
    () => calculateCheckoutCashflow({ bikePriceEur, deliveryId: delivery, addons }),
    [bikePriceEur, delivery, addons]
  );
  const exchangeRate = cashflow.exchangeRate;
  const totalRub = cashflow.totalRub;
  const reservationRub = cashflow.reservationRub;
  const finalPriceEur = cashflow.totalEur;
  const formatEur = (value: number) => `€ ${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}`;

  const contactPlaceholder =
    contactMethod === "email"
      ? "Email"
      : contactMethod === "telegram"
        ? "Telegram"
        : "Телефон / WhatsApp";

  const sellerQuestions = useMemo(
    () => (reservationStrategy === "priority_reserve" ? parseSellerQuestions(sellerQuestionsText) : []),
    [reservationStrategy, sellerQuestionsText]
  );

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

  useEffect(() => {
    if (!isAuthenticated) return;
    if (name.trim()) return;
    const fallbackName =
      String((user as any)?.name || "").trim() ||
      String(user?.email || "").split("@")[0] ||
      String(user?.phone || "").trim();
    if (fallbackName) setName(fallbackName);
  }, [isAuthenticated, name, user]);

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
    if (!hasRequiredFormLegalConsent(legalConsent)) {
      setError("Подтвердите согласие с условиями оферты и обработкой персональных данных.");
      return;
    }
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
        metadata: {
          flow: "booking_finalize",
          contact_method: contactMethod,
          delivery_option: deliveryOption.id,
          reservation_strategy: reservationStrategy,
          seller_questions_count: sellerQuestions.length
        }
      }
    ]).catch(() => void 0);
    const wasAuthenticated = isAuthenticated;
    const legalAudit = buildLegalAuditLine(legalConsent.marketingAccepted);
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
        notes: legalAudit,
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
          reservation_strategy: reservationStrategy,
          seller_questions: sellerQuestions,
        },
      };

      const resp = await crmApi.createBooking(payload);
      if (!resp?.success) throw new Error(resp?.error || "Не удалось создать бронь");
      metricsApi.sendEvents([
        {
          type: "checkout_submit_success",
          bikeId: Number((bike as any)?.id || bikeId),
          metadata: {
            flow: "booking_finalize",
            order_code: resp?.order_code || null,
            reservation_strategy: reservationStrategy,
            seller_questions_count: sellerQuestions.length
          }
        }
      ]).catch(() => void 0);

      if (!wasAuthenticated && resp?.auth?.token) {
        localStorage.setItem("authToken", resp.auth.token);
        if (resp.auth.user) localStorage.setItem("currentUser", JSON.stringify(resp.auth.user));
      }

      setSuccess({
        order: resp.order_code,
        tempPassword: resp?.auth?.temp_password,
        login: contact.trim(),
        showAccessCredentials: !wasAuthenticated,
        reservationStrategy,
        sellerQuestionsCount: sellerQuestions.length,
      });

      if (!wasAuthenticated) {
        try {
          sessionStorage.setItem(
            "booking_auth_hint",
            JSON.stringify({ login: contact.trim(), tempPassword: resp?.auth?.temp_password || "" })
          );
        } catch {
          // no-op
        }
      }
    } catch (e: any) {
      metricsApi.sendEvents([
        {
          type: "checkout_submit_failed",
          bikeId: Number((bike as any)?.id || bikeId),
          metadata: {
            flow: "booking_finalize",
            error: String(e?.message || "unknown"),
            reservation_strategy: reservationStrategy,
            seller_questions_count: sellerQuestions.length
          }
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
      <div className="min-h-screen bg-[#f6f6f7] text-[#18181b]">
        <BikeflipHeaderPX />
        <main className="mx-auto max-w-[980px] px-4 py-10 md:py-14">
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-0 -top-20 mx-auto h-72 w-[92%] max-w-[980px] rounded-[44px] bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.14),rgba(16,185,129,0.10),rgba(255,255,255,0))] blur-2xl" />
            <div className="relative rounded-[36px] bg-gradient-to-b from-white/70 via-white/60 to-white/50 p-[1px] shadow-[0_40px_120px_rgba(0,0,0,0.10)]">
              <Card className="rounded-[35px] border border-white/60 bg-white/80 p-6 backdrop-blur-xl md:p-10">
                <div className="flex flex-col items-center text-center md:items-start md:text-left">
                  <div className="inline-flex items-center rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-zinc-700">
                    УСПЕШНО
                  </div>

                  <div className="mt-6 flex h-[86px] w-[86px] items-center justify-center rounded-full bg-white shadow-[0_18px_50px_rgba(0,0,0,0.10)] ring-1 ring-zinc-200/70 md:mt-8">
                    <div className="flex h-[66px] w-[66px] items-center justify-center rounded-full bg-gradient-to-b from-emerald-50 to-white ring-1 ring-emerald-200/60">
                      <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                    </div>
                  </div>

                  <h1 className="mt-7 text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
                    Бронь создана
                  </h1>
                  <p className="mt-3 max-w-[58ch] text-base text-zinc-600 md:text-lg">
                    Мы зафиксировали заявку. Дальше идет проверка продавца и состояния байка. Оплата потребуется только после подтверждения.
                  </p>

                  <div className="mt-5 w-full rounded-[22px] border border-zinc-200/80 bg-white/70 p-4 text-left text-sm text-zinc-700 md:p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Режим брони</div>
                    <div className="mt-1 text-base font-semibold text-zinc-900">
                      {success.reservationStrategy === "priority_reserve"
                        ? "Приоритетный резерв 2%"
                        : "Бесплатная бронь в очереди"}
                    </div>
                    <p className="mt-1 leading-relaxed">
                      {success.reservationStrategy === "priority_reserve"
                        ? "Оплата 2% делается на странице отслеживания. После оплаты байк закрепляется за вами вне очереди, сумма учитывается в оставшейся оплате."
                        : "Бронь сохранена без оплаты. Если на байк есть несколько бесплатных броней, выкуп предлагается по очереди по времени заявки."}
                    </p>
                    {Boolean(success.sellerQuestionsCount) && (
                      <p className="mt-1 text-xs text-zinc-600">
                        Вопросы к продавцу переданы менеджеру: {success.sellerQuestionsCount}
                      </p>
                    )}
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center text-xs font-medium text-zinc-800 underline-offset-2 hover:underline"
                      onClick={() => navigate("/journal/reservation-priority-and-queue")}
                    >
                      Подробнее об очереди и резерве
                    </button>
                  </div>

                  <div className="mt-7 w-full rounded-[26px] border border-zinc-200/80 bg-white/70 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.06)] md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Номер брони</div>
                        <div className="mt-2 font-mono text-2xl font-semibold tracking-[0.08em] text-zinc-950 md:text-3xl">
                          {success.order}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-full border-zinc-300 bg-white/80 px-5 text-sm font-semibold hover:bg-white"
                          onClick={() => {
                            const v = String(success.order || "");
                            if (!v) return;
                            navigator.clipboard?.writeText(v).catch(() => void 0);
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Скопировать
                        </Button>
                        <Button
                          type="button"
                          className="h-11 rounded-full bg-[#18181b] px-5 text-sm font-semibold text-white hover:bg-black"
                          onClick={() => navigate(`/order-tracking/${success.order}`)}
                        >
                          Открыть статус
                        </Button>
                      </div>
                    </div>
                  </div>

                  {success.showAccessCredentials ? (
                    <div className="mt-6 w-full rounded-[26px] border border-zinc-200/80 bg-white/70 p-5 text-sm md:p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-semibold text-zinc-900">Доступ к аккаунту</div>
                        <div className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                          создан автоматически
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-zinc-800">
                        <div>Логин: <span className="font-medium">{success.login || "—"}</span></div>
                        <div>Пароль: <span className="font-medium">{success.tempPassword || "—"}</span></div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                    <Button
                      className="h-14 rounded-full bg-[#18181b] px-8 text-base font-semibold text-white hover:bg-black"
                      onClick={() => navigate(`/order-tracking/${success.order}`)}
                    >
                      Перейти к отслеживанию
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 rounded-full border-zinc-300 bg-white/70 px-8 text-base font-semibold hover:bg-white"
                      onClick={() => navigate(`/product/${bikeId}`)}
                    >
                      Вернуться к байку
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
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
  const bikeBrand = String((bike as any)?.brand || "").trim();
  const bikeLocation = String((bike as any)?.location || (bike as any)?.city || (bike as any)?.seller_city || "").trim();
  const bikeFrameSize = (bike as any)?.frameSize || (bike as any)?.size || null;
  const bikeYear = (bike as any)?.year || (bike as any)?.model_year || (bike as any)?.modelYear || null;
  const bikeMetaChips = [
    bikeYear ? `Год: ${bikeYear}` : null,
    bikeFrameSize ? `Размер: ${bikeFrameSize}` : null,
  ].filter(Boolean) as string[];

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8f8f8] via-white to-[#f6f6f6] text-[#18181b]">
      <BikeflipHeaderPX />

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-6 md:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-4 text-sm">
          <button
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-zinc-700 hover:bg-zinc-100"
            onClick={() => navigate(`/booking-checkout/${bikeId}`)}
          >
            Назад
          </button>

          <div className="flex items-center gap-2 text-zinc-700">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
            <span className="text-zinc-700">Доставка</span>
            <span className="mx-1 h-px w-8 bg-zinc-300" />
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-black text-xs font-semibold text-white">2</span>
            <span className="font-medium text-zinc-900">Оплата</span>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            {!isAuthenticated ? (
              <>
                <section className="rounded-[24px] border border-zinc-200 bg-white p-8 shadow-sm">
                  <h1 className="heading-fielmann text-3xl md:text-4xl">BikeWerk аккаунт</h1>
                  <p className="text-fielmann mt-3 max-w-xl">
                    Войдите или создайте аккаунт, чтобы сохранить бронь, избранное и получать уведомления по проверке.
                  </p>

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
              </>
            ) : null}

            {shouldShowBookingForm && (
              <section id="booking-form" className="rounded-[28px] border-[1.5px] border-zinc-300 bg-white p-8 shadow-sm">
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
                    className="h-12 rounded-[16px] border-[1.5px] border-zinc-300 bg-white"
                  />
                  <Input
                    placeholder={contactPlaceholder}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="h-12 rounded-[16px] border-[1.5px] border-zinc-300 bg-white"
                  />
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {contactOptions.map((opt) => (
                      <Button
                        key={opt.id}
                        type="button"
                        variant={contactMethod === opt.id ? "default" : "outline"}
                        className={cn(
                          "h-11 rounded-full border-[1.5px] whitespace-nowrap text-sm md:text-base",
                          opt.id === "phone" ? "col-span-2 md:col-span-1" : "",
                          contactMethod === opt.id
                            ? "bg-[#18181b] text-white hover:bg-black"
                            : "border-zinc-300 bg-white text-[#18181b] hover:bg-[#f4f4f5]"
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
                    className="h-12 rounded-[16px] border-[1.5px] border-zinc-300 bg-white"
                  />
                  <Input
                    placeholder="Комментарий (необязательно)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="h-12 rounded-[16px] border-[1.5px] border-zinc-300 bg-white"
                  />

                  <div className="rounded-[18px] border-[1.5px] border-zinc-300 bg-zinc-50/40 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Сценарий бронирования</div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                      Выбирайте удобный формат: бесплатная очередь или приоритетный резерв 2%. Это не upsell, а часть будущей оплаты.
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <button
                        type="button"
                        className={cn(
                          "rounded-[14px] border-[1.5px] p-3 text-left transition-colors",
                          reservationStrategy === "free_queue"
                            ? "border-zinc-900 bg-white"
                            : "border-zinc-300 bg-white hover:border-zinc-400"
                        )}
                        onClick={() => setReservationStrategy("free_queue")}
                      >
                        <div className="text-sm font-semibold text-zinc-900">Бесплатная бронь</div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Ничего не оплачиваете сейчас. Если броней несколько, выкуп идет по очереди.
                        </div>
                      </button>

                      <button
                        type="button"
                        className={cn(
                          "rounded-[14px] border-[1.5px] p-3 text-left transition-colors",
                          reservationStrategy === "priority_reserve"
                            ? "border-zinc-900 bg-white"
                            : "border-zinc-300 bg-white hover:border-zinc-400"
                        )}
                        onClick={() => setReservationStrategy("priority_reserve")}
                      >
                        <div className="text-sm font-semibold text-zinc-900">Приоритетный резерв 2%</div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Оплата 2% позже в отслеживании. После оплаты байк закрепляется за вами вне очереди.
                        </div>
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                      Возврат резерва: если сделка отменена не по вашей вине (качество хуже, продавец исчез, риски безопасности).
                    </div>
                  </div>

                  <div className="rounded-[18px] border-[1.5px] border-zinc-300 bg-zinc-50/40 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Вопросы продавцу до завершения проверки</div>
                    {reservationStrategy === "priority_reserve" ? (
                      <>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                          Менеджер добавит эти пункты в диалог с продавцом. Один вопрос - одна строка.
                        </p>
                        <textarea
                          value={sellerQuestionsText}
                          onChange={(e) => setSellerQuestionsText(e.target.value)}
                          placeholder={"Например: Есть ли сервисная история вилки?\nОригинальный ли карбоновый руль?"}
                          className="mt-3 min-h-[112px] w-full rounded-[14px] border-[1.5px] border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
                        />
                        <div className="mt-2 text-[11px] text-zinc-500">
                          Сохранится вопросов: {sellerQuestions.length} из 5
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 rounded-[12px] border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-600">
                        Блок вопросов к продавцу доступен только при выборе «Приоритетный резерв 2%».
                      </div>
                    )}
                  </div>

                  <LegalConsentFields value={legalConsent} onChange={setLegalConsent} />

                  {error && (
                    <div className="rounded-[16px] border-[1.5px] border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button
                    className="h-12 rounded-full bg-[#18181b] px-8 text-white hover:bg-black"
                    disabled={submitting || !hasRequiredFormLegalConsent(legalConsent)}
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

          <aside className="lg:h-fit lg:self-start lg:sticky lg:top-5">
            <Card className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
              <div>
                <h2 className="heading-fielmann text-[21px] leading-none text-zinc-950">Сводка заказа</h2>

                <div className="mt-3 flex items-start gap-3">
                  <div className="w-[148px] shrink-0 overflow-hidden rounded-[10px] border border-zinc-200 bg-zinc-100">
                    <img src={bikeImage} alt={bikeTitle} className="h-[106px] w-full object-cover" loading="lazy" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {bikeBrand ? <div className="text-[13px] text-zinc-700">{bikeBrand}</div> : null}
                    <div className="mt-0.5 text-[20px] leading-[1.08] font-semibold tracking-tight text-zinc-950">{bikeTitle}</div>
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
                      <span className="tabular-nums text-sm font-medium text-zinc-500">{formatEur(finalPriceEur)}</span>
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
                onClick={scrollToBooking}
              >
                К бесплатной брони
              </Button>
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
