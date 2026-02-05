"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Share2, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { apiPost } from "@/api";
import { useCheckoutUI } from "@/lib/checkout-ui";
import { metricsApi } from "@/api";

type ContactMethod = "telegram" | "whatsapp" | "email" | "call";

type WizardState = {
  name: string;
  method: ContactMethod | null;
  value: string;
};

const LS_KEY = "guestOrderWizard";

function loadState(): WizardState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...JSON.parse(raw) };
  } catch { void 0 }
  return { name: "", method: null, value: "" };
}

function saveState(s: WizardState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { void 0 }
}

function onlyLettersSpaces(v: string) {
  return /^[A-Za-zА-Яа-яЁё\s]{2,}$/.test(v.trim());
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function digits(v: string) { return v.replace(/\D+/g, ""); }

function formatPhoneRU(v: string) {
  const d = digits(v);
  if (!d) return "";
  const pref = d.startsWith("7") || d.startsWith("8") ? d.replace(/^8/, "7") : d;
  const p = pref.padEnd(11, "");
  const a = ["+", p[0] ?? "", " ", p.slice(1,4), " ", p.slice(4,7), "-", p.slice(7,9), "-", p.slice(9,11)].join("");
  return a.trim();
}

export default function BuybackDialog() {
  const { state, closeAll } = useCheckoutUI();
  const bike = state.bike;
  const [wiz, setWiz] = React.useState<WizardState>(() => loadState());
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<null | { message: string; raw?: unknown }>(null);

  React.useEffect(() => {
    if (state.buybackOpen && bike?.id) {
      try { metricsApi.sendEvents([{ type: "buyback_overlay_shown", bikeId: Number(bike.id) }]); } catch { void 0 }
    }
  }, [state.buybackOpen, bike?.id]);

  React.useEffect(() => { saveState(wiz) }, [wiz]);

  const nameOk = onlyLettersSpaces(wiz.name);
  const valueOk = (() => {
    if (wiz.method === "email") return isEmail(wiz.value);
    if (wiz.method === "telegram" || wiz.method === "whatsapp" || wiz.method === "call") {
      return digits(wiz.value).length >= 10;
    }
    return false;
  })();

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const contact_method = wiz.method === "call" ? "phone" : wiz.method ?? "";
    const contact_value = wiz.method === "email" ? wiz.value.trim() : digits(wiz.value);
    try {
      const res = await apiPost("/v1/crm/applications", {
        name: wiz.name.trim(),
        contact_method,
        contact_value,
        notes: null,
      });
      if (res?.success) {
        const id = String(res.application_id || "");
        const num = String(res.application_number || "");
        const track = String(res.tracking_url || "");
        try { localStorage.removeItem(LS_KEY) } catch { void 0 }
        window.location.href = `/guest-order/success/${encodeURIComponent(id)}?num=${encodeURIComponent(num)}&track=${encodeURIComponent(track)}`;
      } else {
        const msg = res?.error || "Не удалось создать заявку";
        setError({ message: msg, raw: res });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError({ message: msg || "Сетевая ошибка", raw: e });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={state.buybackOpen} onOpenChange={(o) => { if (!o) closeAll(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl rounded-3xl p-6 md:p-7">
        <DialogHeader>
          <DialogTitle className="text-2xl md:text-3xl font-semibold">Можем сразу создать заявку!</DialogTitle>
          <DialogDescription className="sr-only">Быстрый переход к заявке на выкуп</DialogDescription>
        </DialogHeader>
        <div className="mt-3">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl">Заявка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Share2 className="h-4 w-4" /> Мы сразу примем вашу заявку в обработку и будем держать вас в курсе!
              </div>
              <Separator />
              {bike && (
                <div className="text-sm">
                  <div className="font-medium">{bike.title || `${bike.brand || ""} ${bike.model || ""}`}</div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Как к вам обращаться?</Label>
                <Input id="name" placeholder="Иван Иванов" value={wiz.name}
                  onChange={e => setWiz(s => ({ ...s, name: e.target.value }))} />
                {!nameOk && wiz.name.length > 0 && (
                  <div className="text-xs text-red-600">Минимум 2 символа, только буквы и пробелы</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium">Какой способ связи удобнее всего?</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["telegram","whatsapp","email","call"] as ContactMethod[]).map(m => (
                    <button key={m} type="button"
                      onClick={() => setWiz(s => ({ ...s, method: m }))}
                      className={"rounded-xl border px-3 py-2 text-sm hover:bg-muted/60 " + (wiz.method===m?"border-foreground":"border-muted")}
                    >{m === "telegram" ? "Telegram" : m === "whatsapp" ? "WhatsApp" : m === "email" ? "Email" : "Звонок"}</button>
                  ))}
                </div>
              </div>

              {wiz.method && (
                <div className="space-y-2">
                  <Label htmlFor="value">
                    {wiz.method === "email" ? "Email" : "Номер телефона"}
                  </Label>
                  <Input id="value" inputMode={wiz.method === "email" ? "email" : "tel"}
                    placeholder={wiz.method === "email" ? "name@example.com" : "+7 999 999-99-99"}
                    value={wiz.method === "email" ? wiz.value : formatPhoneRU(wiz.value)}
                    onChange={e => setWiz(s => ({ ...s, value: e.target.value }))}
                  />
                  {!valueOk && wiz.value.length > 0 && (
                    <div className="text-xs text-red-600">
                      {wiz.method === "email" ? "Введите корректный email" : "Введите корректный номер (минимум 10 цифр)"}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-2xl border p-3 text-sm">
                  <div className="font-medium">Ошибка: {error.message}</div>
                  <pre className="mt-2 overflow-auto max-h-60 text-xs bg-muted/40 p-2 rounded-md">{JSON.stringify(error.raw, null, 2)}</pre>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => closeAll()}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Назад
                </Button>
                <Button disabled={!nameOk || !valueOk || !wiz.method || submitting}
                  className="rounded-full"
                  onClick={submit}
                >
                  {submitting ? "Отправляем..." : <>Далее <ArrowRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5" /> Ваши данные сохраняются локально до отправки и не теряются при перезагрузке.
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
