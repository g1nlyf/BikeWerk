"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartUI } from "@/lib/cart-ui";
import { resolveImageUrl } from "@/api";
import { calculateMarketingBreakdown, formatEUR } from "@/lib/pricing";
import { adminApi } from "@/api";
import { useCart } from "@/context/CartContext";

function canReadAdminEvaluation(): boolean {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) return false;
    const raw = localStorage.getItem("currentUser");
    if (!raw) return false;
    const u = JSON.parse(raw);
    const role = String(u?.role || "").toLowerCase();
    return role === "admin" || role === "manager";
  } catch {
    return false;
  }
}

export default function MiniCartContent() {
  const { closeCart } = useCartUI();
  const { items, loading } = useCart();
  const [bestMap, setBestMap] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!canReadAdminEvaluation()) {
          if (!cancelled) setBestMap({});
          return;
        }
        const ids = Array.from(new Set(items.map(i => i.bike_id)));
        if (ids.length === 0) return;
        const evaluations = await Promise.all(ids.map(async (id) => {
          try {
            const r = await adminApi.getEvaluation(Number(id));
            const score = r?.evaluation?.price_value_score ?? null;
            return { id, best: Number(score) === 10 };
          } catch { return { id, best: false }; }
        }));
        if (!cancelled) {
          const m: Record<number, boolean> = {};
          for (const e of evaluations) m[e.id] = !!e.best;
          setBestMap(m);
        }
      } catch {}
    })();
    return () => { cancelled = true };
  }, [items]);

  const subtotal = items.reduce(
    (acc, i) => {
      const b = calculateMarketingBreakdown(i.price);
      acc.eur += b.totalEur * i.quantity;
      acc.rub += b.totalRub * i.quantity;
      return acc;
    },
    { eur: 0, rub: 0 }
  );

  return (
    <div className="w-80 max-w-[85vw]">
      <div className="mb-2 text-sm font-semibold">Быстрый просмотр корзины</div>
      {loading ? (
        <div className="py-4 text-sm text-muted-foreground">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="py-4 text-sm text-muted-foreground">Корзина пуста</div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 3).map((i) => {
            const imageUrl = i.image ? resolveImageUrl(i.image) : undefined;
            const breakdown = calculateMarketingBreakdown(i.price);
            const perItemRub = breakdown.totalRub;
            const perItemEur = breakdown.totalEur;
            return (
              <div
                key={i.bike_id}
                className="grid grid-cols-6 items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 rounded"
                onClick={() => (window.location.href = `/product/${i.bike_id}`)}
              >
                <div className="col-span-1">
                  {imageUrl ? (
                    <img src={imageUrl} alt={i.name || i.model} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted" />
                  )}
                </div>
                <div className="col-span-3">
                  <div className="font-medium truncate">{i.name || `${i.brand} ${i.model}`}</div>
                  <div className="text-xs text-muted-foreground">Кол-во: {i.quantity}</div>
                </div>
                <div className={(bestMap[i.bike_id] ? "text-red-600 " : "text-black ") + "col-span-2 text-right font-medium"}>
                  {perItemRub.toLocaleString()} ₽
                  <span className="ml-1 text-xs text-muted-foreground">≈ {formatEUR(perItemEur)}</span>
                </div>
                <Separator className="col-span-6 my-2" />
              </div>
            );
          })}
          {items.length > 3 && (
            <div className="text-xs text-muted-foreground">И ещё {items.length - 3} товаров…</div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Итого</span>
            <span className="font-bold text-black">
              {subtotal.rub.toLocaleString()} ₽
              <span className="ml-1 text-xs text-muted-foreground">≈ {formatEUR(subtotal.eur)}</span>
            </span>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              closeCart();
              window.location.href = "/cart";
            }}
          >
            Перейти в корзину
          </Button>
        </div>
      )}
    </div>
  );
}
