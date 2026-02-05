"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { apiGet } from "@/api";
import { calculateMarketingBreakdown, refreshRates } from "@/lib/pricing";
import { BikeCard, type BikeData } from "@/components/catalog/BikeCard";

// Мини-каталог для главной страницы: две строки-карусели
// 1) "Лучшие предложения" — по экономии/скидке
// 2) "Новые объявления" — только из официальных источников, по added_at

function calcTotals(price: number) {
  const b = calculateMarketingBreakdown(price);
  return { totalEur: Math.round(b.totalEur), totalRub: Math.round(b.totalRub) };
}

function mapBikeToCard(b: any): BikeData {
  const priceEU = Math.round(Number(b.price || 0));
  const { totalEur, totalRub } = calcTotals(priceEU);
  const mainImg = b.main_image
    || (Array.isArray(b.images) && (typeof b.images[0] === "string" ? b.images[0] : b.images[0]?.image_url))
    || "";
  const savings = Math.max(0, Number((b.original_price || 0) - (b.price || 0)));
  const status: BikeData["status"] = b.is_new
    ? "new"
    : (b.condition_status === "used" ? "used" : "available");

  return {
    id: String(b.id),
    name: String(b.name || ""),
    brand: b.brand || "",
    model: b.model || b.name || "",
    year: Number(b.year || 0),
    type: b.category || "other",
    status,
    priceEU,
    priceWithDelivery: totalEur,
    priceRUB: totalRub,
    savings,
    image: mainImg,
    description: b.description || "",
    tags: Array.isArray(b.features) ? b.features : [],
    size: b.size || undefined,
    wheelDiameter: b.wheel_diameter || undefined,
    favoritesCount: typeof b.favorites_count === "number" ? b.favorites_count : undefined,
  };
}

import { PersonalizedBlock } from "@/components/recommendations/PersonalizedBlock";

export default function MiniCatalogSection() {
  const [hotDeals, setHotDeals] = React.useState<BikeData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Горячие предложения — используем Smart Rank
        await refreshRates();
        const params = new URLSearchParams({ limit: '15', offset: '0', sort: 'rank', sortOrder: 'DESC' });
        // params.append('hot', 'true'); // Убрал фильтр hot, чтобы показать просто лучшие по рейтингу
        const dealsResp = await apiGet(`/catalog/bikes?${params.toString()}`);
        const dealsItems: any[] = Array.isArray(dealsResp?.bikes) ? dealsResp.bikes : [];
        const dealsMapped: BikeData[] = dealsItems.map(mapBikeToCard);

        if (!cancelled) {
          setHotDeals(dealsMapped);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Не удалось загрузить мини-каталог");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true };
  }, []);

  return (
    <section className="container mx-auto px-4 md:px-6 pt-8 pb-12 space-y-12">
      
      {/* Персональные рекомендации */}
      <PersonalizedBlock />

      {/* Лучшие предложения (Smart Rank) */}
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Топ рейтинга</h2>
              <p className="text-sm md:text-base text-muted-foreground leading-tight">Самые популярные и выгодные предложения</p>
            </div>
            <Button variant="link" className="text-base" onClick={() => (window.location.href = "/catalog")}>
              Посмотреть все →
            </Button>
          </div>
          
          {loading ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               {[1,2,3,4].map(i => <div key={i} className="h-[300px] bg-muted animate-pulse rounded-xl"/>)}
             </div>
          ) : (
            <Carousel className="w-full">
              <CarouselContent className="-ml-4">
                {hotDeals.map((bike) => (
                  <CarouselItem key={bike.id} className="pl-4 basis-[85%] md:basis-1/2 lg:basis-1/4">
                    <BikeCard bike={bike} variant="compact" />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex" />
              <CarouselNext className="hidden md:flex" />
            </Carousel>
          )}
        </div>
      </div>
    </section>
  );
}
