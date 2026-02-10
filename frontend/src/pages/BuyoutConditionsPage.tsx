import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Shield, Truck, Info } from "lucide-react";
import { apiGet, crmApi } from "@/api";
import { formatRUB } from "@/lib/pricing";
import { DELIVERY_OPTIONS, INCLUDED_SERVICES, ADDON_OPTIONS, calculateAddonsTotals } from "@/data/buyoutOptions";
import type { DeliveryOptionId, AddonSelection } from "@/data/buyoutOptions";

const contactOptions = [
  { id: "phone", label: "Телефон / WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "email", label: "Email" },
] as const;

type SuccessState = {
  order?: string;
  token?: string;
  tempPassword?: string;
  login?: string;
};

export default function BuyoutConditionsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialBike = (location.state as any)?.bike || null;

  const [bike, setBike] = useState<any>(initialBike);
  const [loading, setLoading] = useState(!initialBike);
  const [delivery, setDelivery] = useState<DeliveryOptionId>("Cargo");
  const [addons, setAddons] = useState<AddonSelection>({});
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [contactMethod, setContactMethod] = useState<"phone" | "telegram" | "email">("phone");
  const [city, setCity] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [credentialsConfirmed, setCredentialsConfirmed] = useState(false);
  const contactPlaceholder =
    contactMethod === "email"
      ? "Email"
      : contactMethod === "telegram"
        ? "Telegram"
        : "Телефон / WhatsApp";

  useEffect(() => {
    if (bike || !id) return;
    let mounted = true;
    setLoading(true);
    apiGet(`/bikes/${id}`)
      .then((data) => {
        if (!mounted) return;
        const resolved = data?.bike || data?.data || data;
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
  }, [bike, id]);

  const exchangeRate = useMemo(() => {
    return Number((bike as any)?.exchange_rate || (bike as any)?.price_rate || 105);
  }, [bike]);

  const bikePriceEur = Number((bike as any)?.price || (bike as any)?.price_eur || 0);
  const deliveryOption = DELIVERY_OPTIONS.find((o) => o.id === delivery) || DELIVERY_OPTIONS[0];
  const deliveryRub = Math.round(deliveryOption.priceEur * exchangeRate);

  const baseTotalRub = Math.round((bikePriceEur + deliveryOption.priceEur) * exchangeRate);
  const addonsTotals = calculateAddonsTotals({ bikePriceEur, baseTotalRub, exchangeRate, selection: addons });
  const totalRub = baseTotalRub + addonsTotals.totalRub;
  const reservationRub = Math.ceil(totalRub * 0.02);
  const finalPriceEur = bikePriceEur + deliveryOption.priceEur + addonsTotals.totalEur;

  const handleAddonQty = (id: string, qty: number) => {
    setAddons((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
  };

  const handleSubmit = async () => {
    if (!bike) {
      setError("Не удалось загрузить байк. Попробуйте вернуться назад.");
      return;
    }
    if (!name || !contact || !city) {
      setError("Заполните имя, контакт и город.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        bike_id: (bike as any)?.id || id,
        customer: {
          name,
          email: contactMethod === "email" ? contact : undefined,
          phone: contactMethod === "phone" ? contact : undefined,
          telegram_id: contactMethod === "telegram" ? contact : undefined,
          contact_method: contactMethod,
          contact_value: contact,
          city,
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
          city,
          contact_method: contactMethod,
          contact_value: contact,
          comment,
          delivery_option: deliveryOption.id,
          addons_selection: addons,
        },
      };
      const resp = await crmApi.createBooking(payload as any);
      if (!resp?.success) {
        throw new Error(resp?.error || "Не удалось создать бронь");
      }
      if (resp?.auth?.token) {
        localStorage.setItem("authToken", resp.auth.token);
        if (resp.auth.user) localStorage.setItem("currentUser", JSON.stringify(resp.auth.user));
      }
      setSuccess({
        order: resp.order_code,
        token: resp?.auth?.token,
        tempPassword: resp?.auth?.temp_password,
        login: contact,
      });
      setCredentialsConfirmed(false);
      try {
        sessionStorage.setItem('booking_auth_hint', JSON.stringify({
          login: contact,
          tempPassword: resp?.auth?.temp_password || ''
        }));
      } catch {
        // no-op
      }
    } catch (e: any) {
      setError(e?.message || "Ошибка при бронировании");
    } finally {
      setSubmitting(false);
    }
  };

  const goToTracking = () => {
    if (!credentialsConfirmed) return;
    const orderNumber = success?.order;
    if (orderNumber) navigate(`/order-tracking/${orderNumber}`);
    else navigate("/order-tracking");
  };

  if (loading && !bike) {
    return (
      <div className="min-h-screen bg-[#f4f4f5] text-[#18181b] flex items-center justify-center px-4">
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
    return (
      <div className="min-h-screen bg-[#f4f4f5] text-[#18181b] flex items-center justify-center px-4">
        <Card className="w-full max-w-lg p-6 rounded-[12px] shadow-sm bg-white text-center space-y-3">
          <h2 className="text-lg font-semibold">Байк не найден</h2>
          <p className="text-sm text-muted-foreground">Попробуйте вернуться в каталог и открыть карточку снова.</p>
          <Button className="h-12 rounded-[8px] bg-black text-white px-8" onClick={() => navigate('/catalog')}>
            Перейти в каталог
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#f4f4f5] text-[#18181b]"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Карточка байка → Условия выкупа</p>
            <h1 className="text-2xl font-semibold">Показать условия выкупа</h1>
          </div>
          {bike && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Байк</div>
              <div className="font-medium">{(bike as any).title || `${(bike as any).brand || ""} ${(bike as any).model || ""}`}</div>
              <div className="text-sm text-muted-foreground">{(bike as any).frameSize || (bike as any).size}</div>
            </div>
          )}
        </header>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4 rounded-[12px] shadow-sm bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4" />
                <h2 className="font-semibold text-lg">Этапы и безопасность</h2>
              </div>
              <ul className="space-y-3 text-sm text-[#18181b]">
                <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5" />Бронь бесплатная. Мы связываемся с продавцом и собираем данные по чек‑листу (30 пунктов).</li>
                <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5" />Безопасная оплата: деньги продавцу только после подтверждения и проверки.</li>
                <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5" />Проверка механиком и повторная оценка качества перед выкупом (первое время бесплатно).</li>
                <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5" />Резервирование 2% после проверки фиксирует приоритет в очереди. Сумма вычитается из цены.</li>
                <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5" />Таможня и доставка прозрачны, варианты ниже. Вы выбираете способ связи.</li>
              </ul>
            </Card>

            <Card className="p-4 rounded-[12px] shadow-sm bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4" />
                <h2 className="font-semibold text-lg">Доставка</h2>
              </div>
              <div className="space-y-3">
                {DELIVERY_OPTIONS.map((opt) => (
                  <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border ${delivery === opt.id ? "border-black bg-[#f4f4f5]" : "border-[#e4e4e7]"}`} onClick={() => setDelivery(opt.id)}>
                    <span className={`mt-1 h-4 w-4 rounded-full border ${delivery === opt.id ? "bg-black border-black" : "border-zinc-400"}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{opt.title}</div>
                        <div className="font-semibold">€ {opt.priceEur}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">{opt.subtitle}</div>
                      <div className="text-xs text-muted-foreground">Сроки: {opt.eta}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Card>

            <Card className="p-4 rounded-[12px] shadow-sm bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4" />
                <h2 className="font-semibold text-lg">Доп услуги</h2>
              </div>
              <div className="space-y-3 text-sm">
                {ADDON_OPTIONS.map((addon) => (
                  <div key={addon.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#e4e4e7]">
                    <div>
                      <div className="font-medium">{addon.title}</div>
                      <div className="text-muted-foreground text-xs">{addon.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleAddonQty(addon.id, (addons[addon.id] || 0) - 1)}>-</Button>
                      <div className="w-8 text-center">{addons[addon.id] || 0}</div>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleAddonQty(addon.id, (addons[addon.id] || 0) + 1)}>+</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 rounded-[12px] shadow-sm bg-white">
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

          <div className="space-y-4">
            <Card className="p-4 rounded-[12px] shadow-sm bg-white">
              <h2 className="font-semibold text-lg mb-3">Итог</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Байк</span><span>€ {bikePriceEur.toLocaleString("ru-RU")}</span></div>
                <div className="flex justify-between"><span>Доставка</span><span>€ {deliveryOption.priceEur.toLocaleString("ru-RU")}</span></div>
                <div className="flex justify-between"><span>Доставка в ₽</span><span>{formatRUB(deliveryRub)}</span></div>
                <div className="flex justify-between"><span>Доп услуги</span><span>{formatRUB(addonsTotals.totalRub)}</span></div>
                <div className="flex justify-between font-semibold"><span>Итого</span><span>{formatRUB(totalRub)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>Резервирование (2%)</span><span>{formatRUB(reservationRub)}</span></div>
              </div>
              <div className="h-px bg-[#e4e4e7] my-3" />
              <div className="space-y-3 text-sm">
                <Input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} className="rounded-[12px] h-12 bg-[#f4f4f5] border-none" />
                <Input placeholder={contactPlaceholder} value={contact} onChange={(e) => setContact(e.target.value)} className="rounded-[12px] h-12 bg-[#f4f4f5] border-none" />
                <div className="grid grid-cols-3 gap-2">
                  {contactOptions.map((opt) => (
                    <Button key={opt.id} type="button" variant={contactMethod === opt.id ? "default" : "outline"} className="w-full rounded-[8px]" onClick={() => setContactMethod(opt.id)}>
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <Input placeholder="Город доставки" value={city} onChange={(e) => setCity(e.target.value)} className="rounded-[12px] h-12 bg-[#f4f4f5] border-none" />
                <Input placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} className="rounded-[12px] h-12 bg-[#f4f4f5] border-none" />
                {error && <div className="text-sm text-red-600">{error}</div>}
                <Button className="w-full h-12 rounded-[8px] bg-black text-white px-8 py-3.5" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? "Бронируем…" : "Забронировать"}
                </Button>
                <div className="text-xs text-muted-foreground text-center">Бронь бесплатна. Резерв 2% оплачивается позже в отслеживании.</div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {success && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4">
          <Card className="w-full max-w-md p-6 rounded-[16px] bg-white space-y-3 text-center">
            <h3 className="text-xl font-semibold">Успешная бронь!</h3>
            <p className="text-sm text-muted-foreground">Номер брони: {success.order}</p>
            <div className="bg-[#f4f4f5] rounded-[12px] p-3 text-sm text-left space-y-1">
              <div>Логин: {success.login}</div>
              <div>Пароль: {success.tempPassword || '—'}</div>
              <div className="text-xs text-muted-foreground">Войдите с этими данными в отслеживании, чтобы закрепить доступ.</div>
            </div>
            <label className="flex items-start gap-2 text-left text-xs text-zinc-600">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={credentialsConfirmed}
                onChange={(e) => setCredentialsConfirmed(e.target.checked)}
              />
              <span>Я прочитал(а) и сохранил(а) данные для входа</span>
            </label>
            <Button
              className="w-full h-12 rounded-[8px] bg-black text-white px-8 py-3.5"
              onClick={goToTracking}
              disabled={!credentialsConfirmed}
            >
              Перейти к отслеживанию
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
