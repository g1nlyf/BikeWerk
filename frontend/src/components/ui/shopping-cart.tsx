'use client';
import * as React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
// import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Trash2, ShoppingCart as ShoppingCartIcon, HelpCircle } from 'lucide-react';
import { RATES, calculateMarketingBreakdown, formatEUR, refreshRates, getEurRate } from '@/lib/pricing';
import { adminApi } from '@/api';

interface CartItem {
  id: string;
  name: string;
  price: number; // base price in EUR
  quantity: number;
  imageUrl: string;
}

interface ShoppingCartProps {
  items: CartItem[];
  onQuantityChange: (id: string, newQuantity: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout?: () => void;
}

export const ShoppingCart: React.FC<ShoppingCartProps> = ({ items, onQuantityChange, onRemoveItem, onCheckout }) => {
  const [bestMap, setBestMap] = React.useState<Record<string, boolean>>({});
  const [eurRate, setEurRate] = React.useState<number>(RATES.eur_to_rub);

  React.useEffect(() => {
    let cancelled = false;
    (async () => { try { const v = await refreshRates(); if (!cancelled) setEurRate(v); } catch {} })();
    (async () => {
      try {
        const ids = Array.from(new Set(items.map(i => i.id))).filter(Boolean);
        const evaluations = await Promise.all(ids.map(async (id) => {
          try {
            const r = await adminApi.getEvaluation(Number(id));
            const score = r?.evaluation?.price_value_score ?? null;
            return { id, best: Number(score) === 10 };
          } catch { return { id, best: false }; }
        }));
        if (!cancelled) {
          const m: Record<string, boolean> = {};
          for (const e of evaluations) m[e.id] = !!e.best;
          setBestMap(m);
        }
      } catch {}
    })();
    return () => { cancelled = true };
  }, [items]);
  const aggregated = items.reduce(
    (acc, item) => {
      const b = calculateMarketingBreakdown(item.price);
      acc.eur += b.totalEur * item.quantity;
      acc.rub += b.totalRub * item.quantity;
      return acc;
    },
    { eur: 0, rub: 0 }
  );

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <ShoppingCartIcon className="h-6 w-6" /> Ваша корзина
        </CardTitle>
        <span className="text-sm text-muted-foreground">{items.length} товар(ов)</span>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Ваша корзина пуста. Начните покупки!
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const breakdown = calculateMarketingBreakdown(item.price);
              const perItemTotalEur = breakdown.totalEur;
              const perItemTotalRub = breakdown.totalRub;
              const lineTotalRub = perItemTotalRub * item.quantity;
              const lineTotalEur = perItemTotalEur * item.quantity;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 border p-3 rounded-lg cursor-pointer hover:bg-muted/30"
                  onClick={() => {
                    window.location.href = `/product/${item.id}`;
                  }}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded-md"
                  />
                  <div className="flex-1 grid gap-1">
                    <h3 className="font-medium text-lg">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {perItemTotalRub.toLocaleString()} ₽ за единицу (вкл. доставку и сборы)
                      <span className="ml-1 text-xs">≈ {formatEUR(perItemTotalEur)}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); onQuantityChange(item.id, item.quantity - 1); }}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const newQty = parseInt(e.target.value);
                          if (!isNaN(newQty) && newQty >= 1) {
                            onQuantityChange(item.id, newQty);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                        className="w-16 text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); onQuantityChange(item.id, item.quantity + 1); }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className={(bestMap[item.id] ? "text-red-600 " : "text-black ") + "font-semibold text-lg"}>
                      {lineTotalRub.toLocaleString()} ₽
                      <span className="ml-2 text-xs text-muted-foreground">≈ {formatEUR(lineTotalEur)}</span>
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Separator className="my-6" />
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span>Товары (RUB)</span>
            <span className="font-medium">{aggregated.rub.toLocaleString()} ₽</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">≈ в EUR</span>
            <span className="text-muted-foreground">{formatEUR(aggregated.eur)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              Актуальный курс
              <HelpCircle className="h-4 w-4 text-muted-foreground" title="Курсы обновляются дважды в сутки и соответствуют лучшему курсу банковской онлайн-покупки." />
            </span>
            <span className="text-muted-foreground">1 € = {eurRate} ₽</span>
          </div>
          <Separator className="my-2" />
          <div className="mt-2 flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-4">
            <span className="text-xl md:text-2xl font-bold">Итого</span>
            <span className="text-2xl md:text-3xl font-extrabold leading-tight tracking-tight text-black">
              {aggregated.rub.toLocaleString()} ₽
              <span className="block text-sm text-muted-foreground">≈ {formatEUR(aggregated.eur)}</span>
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-6">
        <Button className="w-full" disabled={items.length === 0} onClick={onCheckout}>
          Оформить заказ
        </Button>
      </CardFooter>
    </Card>
  );
};