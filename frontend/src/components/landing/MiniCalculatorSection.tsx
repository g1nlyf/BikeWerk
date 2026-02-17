import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2 } from "lucide-react";
import { calculatePriceBreakdown } from "@/lib/pricing";

export function MiniCalculatorSection() {
  const [priceEur, setPriceEur] = useState<string>('');
  const [priceRub, setPriceRub] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const price = parseFloat(priceEur);

    // Clear timeout if user keeps typing
    const timer = setTimeout(() => {
      if (!isNaN(price) && price > 0) {
        setIsLoading(true);
        // Simulate network/calculation delay for "premium feel"
        setTimeout(() => {
          const { totalRub } = calculatePriceBreakdown(price, 'Cargo', false);
          setPriceRub(totalRub);
          setIsLoading(false);
        }, 600);
      } else {
        setPriceRub(null);
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [priceEur]);

  return (
    <section className="w-full py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="text-[32px] md:text-5xl lg:text-[56px] leading-[1.1] font-extrabold text-gray-900 mb-12 tracking-tight text-center">
          Сколько будет<br className="hidden md:block" /> стоить твой байк?
        </h2>

        <div className="max-w-4xl mx-auto bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-8 md:p-12 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gray-50 rounded-full -mr-32 -mt-32 z-0 pointer-events-none" />

          <div className="flex flex-col md:flex-row gap-8 md:items-end relative z-10">

            {/* Input EUR */}
            <div className="flex-1 space-y-3">
              <label className="block text-left text-base font-bold text-gray-900 ml-1">
                Цена байка в Германии
              </label>
              <div className="relative group">
                <Input
                  type="number"
                  placeholder="3000"
                  className="h-16 text-3xl font-bold pl-6 pr-12 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-black focus:bg-white transition-all duration-300 shadow-sm group-hover:bg-gray-100/50"
                  value={priceEur}
                  onChange={(e) => setPriceEur(e.target.value)}
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">€</span>
              </div>
            </div>

            {/* Arrow Icon */}
            <div className="hidden md:flex pb-5 text-gray-300">
              <ArrowRight className="w-10 h-10" />
            </div>

            {/* Output RUB */}
            <div className="flex-1 space-y-3">
              <label className="block text-left text-base font-bold text-gray-900 ml-1">
                Финальная цена в РФ
              </label>
              <div className="relative">
                <div className="h-16 flex items-center px-6 rounded-2xl bg-black text-white shadow-xl overflow-hidden relative">
                  {isLoading ? (
                    <div className="flex items-center gap-2 animate-pulse">
                      <Loader2 className="w-6 h-6 animate-spin text-white/70" />
                      <span className="text-xl font-medium text-white/70">Считаем...</span>
                    </div>
                  ) : (
                    <div className="flex items-center w-full">
                      <span className="text-3xl font-bold tracking-tight">
                        {priceRub ? priceRub.toLocaleString('ru-RU') : '---'}
                      </span>
                      <span className="absolute right-6 text-xl font-medium text-white/50">₽</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Button & Disclaimer */}
          <div className="mt-12 text-center space-y-6 relative z-10">
            <Button
              className="w-full md:w-auto rounded-full px-12 h-14 md:h-16 text-base md:text-lg font-bold bg-black text-white hover:bg-gray-800 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1"
              onClick={() => window.location.href = '/calculator'}
            >
              Подробные расчеты
            </Button>
            <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
              Включено: выкуп, доставка, растаможка, страховка, комиссия сервиса.<br />
              Финальная цена может незначительно отличаться.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
