"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { apiGet, apiPost, resolveImageUrl, metricsApi, catalogApi } from "@/api";
import { calculateMarketingBreakdown, refreshRates, formatRUB, calculatePriceBreakdown } from "@/lib/pricing";
import type { BikeData } from "@/components/catalog/BikeCard";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { tracker } from "@/lib/analytics";
import { ChevronLeft, ChevronRight, Heart, ArrowRight } from "lucide-react";

// Визуальная версия мини‑каталога в стиле блока "Selected for you".
// Полностью повторяет бэкенд‑логику MiniCatalogSection (загрузка, расчёт цен, маппинг),
// изменён только UI.

type ExtendedBikeData = BikeData & { images: string[] };

function calcTotals(price: number) {
  const calc = calculatePriceBreakdown(price, 'Cargo', false);
  return { totalEur: Math.round(calc.details.finalPriceEur), totalRub: Math.round(calc.totalRub) };
}

function mapBikeToCard(b: any): ExtendedBikeData {
  const priceEU = Math.round(Number(b.price || 0));
  const { totalEur, totalRub } = calcTotals(priceEU);
  const mainImg = b.main_image
    || (Array.isArray(b.images) && (typeof b.images[0] === "string" ? b.images[0] : b.images[0]?.image_url))
    || "";

  const allImages = Array.isArray(b.images)
    ? b.images.map((img: any) => {
      const url = typeof img === "string" ? img : img?.image_url;
      return resolveImageUrl(url);
    }).filter(Boolean)
    : (mainImg ? [resolveImageUrl(mainImg)] : []);

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
    image: resolveImageUrl(mainImg) || "",
    images: allImages,
    description: b.description || "",
    tags: Array.isArray(b.features) ? b.features : [],
    size: b.size || undefined,
    wheelDiameter: b.wheel_diameter || undefined,
    favoritesCount: typeof b.favorites_count === "number" ? b.favorites_count : undefined,
    is_hot: !!b.is_hot,
    ranking_score: b.ranking_score,
  };
}

function MiniCatalogCard({ bike, onClick, className }: { bike: ExtendedBikeData; onClick?: () => void; className?: string }) {
  const { user } = useAuth();
  const [isHot, setIsHot] = React.useState(!!bike.is_hot);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const timerRef = React.useRef<number | null>(null);

  // Favorites logic
  const [isFavorite, setIsFavorite] = React.useState(false);
  const favKey = "guestFavorites";

  React.useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (user?.id) {
        try {
          const res = await apiGet(`/favorites/check/${Number(bike.id)}`);
          if (!cancelled && typeof res?.isInFavorites === "boolean") setIsFavorite(Boolean(res.isInFavorites));
        } catch {
          try {
            const arr = JSON.parse(localStorage.getItem(favKey) || "[]");
            if (!cancelled) setIsFavorite(arr.includes(Number(bike.id)));
          } catch { void 0 }
        }
      } else {
        try {
          const arr = JSON.parse(localStorage.getItem(favKey) || "[]");
          if (!cancelled) setIsFavorite(arr.includes(Number(bike.id)));
        } catch { void 0 }
      }
    };
    init();
    return () => { cancelled = true };
  }, [user, bike.id]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !isFavorite;
    setIsFavorite(next);
    if (user?.id) {
      try { await apiPost('/favorites/toggle', { bikeId: Number(bike.id) }); } catch { void 0 }
    } else {
      try {
        const arr = JSON.parse(localStorage.getItem(favKey) || "[]");
        const idNum = Number(bike.id);
        const uniq = Array.from(new Set(Array.isArray(arr) ? arr.map((x: any) => Number(x)) : []));
        const nextArr = next ? (uniq.includes(idNum) ? uniq : [idNum, ...uniq]) : uniq.filter((x) => x !== idNum);
        localStorage.setItem(favKey, JSON.stringify(nextArr));
      } catch { void 0 }
    }
    try { if (next) metricsApi.sendEvents([{ type: 'favorite', bikeId: Number(bike.id) }]); } catch { void 0 }
  };

  // Ensure we have images to cycle through
  const images = bike.images.length > 0 ? bike.images : (bike.image ? [bike.image] : []);

  const toggleHot = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.role !== 'admin') return;
    const next = !isHot;
    setIsHot(next);
    try {
      await apiPost(`/admin/bikes/${bike.id}/toggle-hot`, { hot: next });
    } catch (err) {
      console.error(err);
      setIsHot(!next);
    }
  };

  const conditionText = (b: BikeData) => {
    if (b.status === "used") return "Б/У";
    if (b.status === "new") return "Новый";
    return "Б/У";
  };

  const startAuto = () => {
    if (timerRef.current != null || images.length < 2) return;
    timerRef.current = window.setInterval(() => {
      setCurrentIndex((idx) => (images.length ? (idx + 1) % images.length : idx));
    }, 1275);
  };

  const stopAuto = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((idx) => (images.length ? (idx + 1) % images.length : idx));
  };

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((idx) => (images.length ? (idx - 1 + images.length) % images.length : idx));
  };

  return (
    <div
      className={cn("block group relative h-full flex flex-col bg-white rounded-3xl overflow-hidden border border-transparent hover:shadow-xl transition-all duration-300", className)}
      onClick={() => {
        if (onClick) onClick();
        window.location.href = `/product/${bike.id}`;
      }}
      onMouseEnter={startAuto}
      onMouseLeave={() => {
        stopAuto();
        setCurrentIndex(0);
      }}
    >
      {/* Image Container with fixed 9:10 aspect ratio */}
      <div className="relative overflow-hidden bg-gray-50" style={{ aspectRatio: '9 / 10' }}>
        <img
          src={images[currentIndex] || "/placeholder-bike.svg"}
          alt={bike.name || `${bike.brand} ${bike.model}`}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          {isHot && (
            <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] uppercase font-bold px-2.5 py-1 rounded-full shadow-md tracking-wide">
              BEST DEAL
            </div>
          )}
          {bike.savings > 0 && (
            <div className="bg-emerald-500 text-white text-[10px] uppercase font-bold px-2.5 py-1 rounded-full shadow-sm tracking-wide">
              Sale
            </div>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={toggleFavorite}
          className="absolute top-3 right-3 rounded-full bg-white/90 p-2.5 shadow-sm hover:bg-white hover:scale-110 transition-all z-20 group/fav"
        >
          <Heart className={cn("w-4 h-4 transition-colors", isFavorite ? "fill-red-500 text-red-500" : "text-gray-400 group-hover/fav:text-red-500")} />
        </button>

        {/* Admin Hot Toggle */}
        {user?.role === 'admin' && (
          <button
            onClick={toggleHot}
            className={cn(
              "absolute left-3 bottom-3 z-20 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm transition-colors border",
              isHot ? "bg-red-600 text-white border-red-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
            )}
          >
            {isHot ? "HOT" : "Make Hot"}
          </button>
        )}

        {/* Image Navigation Buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white text-gray-800 shadow-sm z-20"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white text-gray-800 shadow-sm z-20"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Dots indicator */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {images.slice(0, 5).map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors shadow-sm",
                    idx === currentIndex ? "bg-white" : "bg-white/60"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-grow">
        {/* Brand & Title */}
        <div className="mb-3">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{bike.brand}</span>
          <h3 className="text-lg font-bold leading-tight line-clamp-2 min-h-[3rem] mt-1" title={`${bike.brand} ${bike.model}`}>
            {bike.model} {bike.year ? bike.year : ""}
          </h3>
        </div>

        {/* Friendly Specs - Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            Size {bike.size || "L"}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {conditionText(bike)}
          </span>
        </div>

        {/* Price & Action */}
        <div className="mt-auto pt-3 border-t border-gray-50">
          <div className="flex items-baseline gap-2 mb-4">
            <span className={cn("font-extrabold text-2xl tracking-tight", (bike.savings > 0 || isHot) ? "text-red-600" : "text-gray-900")}>
              {bike.priceRUB?.toLocaleString("ru-RU")} ₽
            </span>
            {bike.savings > 0 && (
              <span className="text-sm text-muted-foreground line-through">
                {Math.round(calculateMarketingBreakdown(bike.priceEU + bike.savings).totalRub).toLocaleString("ru-RU")} ₽
              </span>
            )}
          </div>

          <Button
            className="w-full rounded-full bg-black hover:bg-gray-800 text-white font-bold h-11 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            onClick={(e) => {
              e.preventDefault(); // prevent double navigation if wrapped in link
              e.stopPropagation();
              window.location.href = `/product/${bike.id}`;
            }}
          >
            Подробнее
          </Button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  title?: string;
  subtitle?: string;
  limit?: number;
  offset?: number;
  shuffle?: boolean;
  accentPriceColor?: string;
  personalized?: boolean;
  hot?: boolean;
};

export default function MiniCatalogBikeflip({ title = "Лучшие предложения", subtitle, limit = 15, offset = 0, shuffle = false, accentPriceColor, personalized = false, hot = false }: Props) {
  const [items, setItems] = React.useState<BikeData[]>([]);
  const [bestPrice, setBestPrice] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const mobileRef = React.useRef<HTMLDivElement>(null);
  const dragData = React.useRef<{ startX: number; scrollLeft: number }>({ startX: 0, scrollLeft: 0 });
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        await refreshRates();

        let list: any[] = [];
        // Try personalized recommendations when enabled
        if (personalized && !hot) {
          try {
            const p = tracker.getProfile();
            const params = new URLSearchParams();
            params.set('limit', '60');
            params.set('offset', String(offset));

            if (p.disciplines) {
              const topDisciplines = Object.entries(p.disciplines)
                .sort(([, a], [, b]) => Number(b) - Number(a))
                .slice(0, 3)
                .map(([d]) => d);
              const toCategory = (k: string): string => {
                const raw = String(k || '').trim();
                if (!raw) return '';
                const u = raw.toLowerCase();
                if (u === 'горный' || u === 'шоссейный' || u === 'гравийный' || u === 'электро' || u === 'детский') return raw;
                if (u === 'mtb' || u.startsWith('mtb ') || u === 'dh' || u === 'downhill' || u === 'enduro' || u === 'trail' || u === 'xc' || u === 'xco') return 'Горный';
                if (u === 'road' || u.startsWith('road ') || u === 'aero' || u === 'endurance' || u === 'climbing' || u === 'tt' || u === 'triathlon' || u === 'granfondo') return 'Шоссейный';
                if (u === 'gravel' || u.startsWith('gravel ') || u === 'race' || u === 'allroad' || u === 'all-road' || u === 'bikepacking') return 'Гравийный';
                if (u === 'emtb' || u === 'ebike') return 'Электро';
                if (u === 'kids' || u.startsWith('kids ')) return 'Детский';
                return '';
              };
              const cats = Array.from(new Set(topDisciplines.map(toCategory).filter(Boolean)));
              if (cats.length) params.set('profile_disciplines', cats.join(','));
            }
            if (p.brands) {
              const topBrands = Object.entries(p.brands)
                .sort(([, a], [, b]) => Number(b) - Number(a))
                .slice(0, 3)
                .map(([b]) => b);
              if (topBrands.length) params.set('profile_brands', topBrands.join(','));
            }

            // Add Price Affinity (Target Price)
            if (p.priceSensitivity && p.priceSensitivity.weightedAverage > 0) {
              params.set('target_price', String(Math.round(p.priceSensitivity.weightedAverage)));
            }

            const respP = await apiGet(`/bikes?${params.toString()}`);
            list = Array.isArray(respP?.bikes) ? respP.bikes : [];
          } catch { void 0 }
        }
        // Fallback to general lists
        if (!list.length) {
          try {
            const resp = await catalogApi.list({ limit: 60, offset, sort: 'rank', hot });
            list = Array.isArray((resp as any)?.bikes) ? (resp as any).bikes : [];

            // Fallback for Hot Offers: if empty, show top ranked
            if (hot && list.length === 0) {
              const respFallback = await catalogApi.list({ limit: 60, offset, sort: 'rank' });
              list = Array.isArray((respFallback as any)?.bikes) ? (respFallback as any).bikes : [];
            }
          } catch {
            const params2 = new URLSearchParams({
              limit: '60',
              offset: String(offset),
              sort: 'rank',
              sortOrder: 'DESC'
            });
            if (hot) params2.append('hot', 'true');
            let resp2 = await apiGet(`/catalog/bikes?${params2.toString()}`);
            list = Array.isArray(resp2?.bikes) ? resp2.bikes : [];

            // Fallback in catch block too
            if (hot && list.length === 0) {
              params2.delete('hot');
              resp2 = await apiGet(`/catalog/bikes?${params2.toString()}`);
              list = Array.isArray(resp2?.bikes) ? resp2.bikes : [];
            }
          }
        }

        const scoreById: Record<string, number> = {};
        const mapped = list.map((x: any) => {
          const m = mapBikeToCard(x);
          if (x.ranking_score) scoreById[x.id] = x.ranking_score;
          return m;
        });

        if (!cancelled) {
          if (shuffle) {
            setItems(mapped.sort(() => 0.5 - Math.random()).slice(0, limit));
          } else {
            setItems(mapped.slice(0, limit));
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Не удалось загрузить");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true };
  }, [limit, offset, shuffle, personalized, hot]);

  return (
    <section className="container mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">{title}</h2>
          {subtitle && <p className="text-base text-muted-foreground">{subtitle}</p>}
        </div>
        <Button variant="outline" className="hidden md:flex rounded-full px-6 border-2 hover:bg-gray-100" onClick={() => window.location.href = '/catalog'}>
          Все предложения <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[3/4] rounded-3xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <Carousel className="w-full">
          <CarouselContent className="-ml-4 pb-2">
            {items.map((bike) => (
              <CarouselItem key={bike.id} className="pl-4 basis-[70%] sm:basis-[60%] md:basis-1/2 lg:basis-1/4 h-full">
                <MiniCatalogCard bike={bike as ExtendedBikeData} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-4 w-12 h-12 border-none bg-white shadow-lg hover:bg-gray-50" />
          <CarouselNext className="hidden md:flex -right-4 w-12 h-12 border-none bg-white shadow-lg hover:bg-gray-50" />
        </Carousel>
      )}

      <div className="mt-4 flex justify-center md:hidden">
        <Button variant="outline" className="rounded-full w-full max-w-xs border" onClick={() => window.location.href = '/catalog'}>
          Смотреть все <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
