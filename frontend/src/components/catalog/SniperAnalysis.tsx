import React from 'react';
import { Sparkles, TrendingDown } from "lucide-react";

interface SniperAnalysisProps {
  product: {
    price: number;
    market_price?: number;
    technicalSummary?: string;
    characteristics?: Record<string, string | number>;
    condition?: string;
  };
}

export function SniperAnalysis({ product }: SniperAnalysisProps) {
  const { price, market_price } = product;

  // Hide if no FMV or if price is significantly ABOVE market (more than 5% above)
  if (!market_price || market_price <= 0) {
    return null;
  }

  const discountPercent = Math.round(((market_price - price) / market_price) * 100);

  // Only show if price is below or roughly equal to market (within 5% above)
  if (discountPercent < -5) {
    return null;
  }

  const priceLabel = `${price.toLocaleString('ru-RU')} €`;
  const marketLabel = `${market_price.toLocaleString('ru-RU')} €`;
  const isDiscounted = discountPercent > 0;
  const savingsLabel = isDiscounted ? `${discountPercent}% ниже рынка` : 'Рыночный уровень цены';
  const toneClass = isDiscounted ? "text-emerald-600" : "text-zinc-500";
  const meter = Math.max(18, Math.min(100, isDiscounted ? discountPercent * 4 : 24));

  return (
    <div className="relative mb-8 overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white p-5 md:p-6 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.45)]">
      <div className="pointer-events-none absolute -right-16 -top-14 h-44 w-44 rounded-full bg-gradient-to-br from-emerald-300/30 via-sky-300/20 to-transparent blur-2xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-zinc-600">
            <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
            Price Intelligence
          </div>

          <div className="mt-3 flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <TrendingDown className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="text-lg font-semibold tracking-tight text-zinc-900">Выгодная цена</div>
              <div className={`mt-0.5 text-sm font-medium ${toneClass}`}>{savingsLabel}</div>
              <div className="mt-2 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${isDiscounted ? "bg-emerald-500" : "bg-zinc-400"}`}
                  style={{ width: `${meter}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 text-right backdrop-blur-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Цена сейчас</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">{priceLabel}</div>
          <div className="mt-1 text-xs text-zinc-500">
            Рыночная: <span className="line-through">{marketLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
