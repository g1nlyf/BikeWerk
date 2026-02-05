import React from 'react';
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="mb-8 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-900">Выгодная цена</div>
            <div className="text-xs text-emerald-600">
              {discountPercent > 0 ? `${discountPercent}% ниже рынка` : 'По рыночной цене'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-emerald-700">{price.toLocaleString()} €</div>
          <div className="text-xs text-emerald-500 line-through">{market_price.toLocaleString()} € рынок</div>
        </div>
      </div>
    </div>
  );
}
