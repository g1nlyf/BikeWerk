"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolveImageUrl, apiGet, apiPost, adminApi } from "@/api";
import { getThumbnailUrl } from "@/utils/imagekit";
import { useCheckoutUI } from "@/lib/checkout-ui";
import { useAuth } from "@/lib/auth";
import { metricsApi } from "@/api";
import { useCartUI } from "@/lib/cart-ui";
import { useLeadSystem } from "@/context/LeadSystemContext";
import { cn } from "@/lib/utils";
import { formatRUB, calculatePriceBreakdown, calculateMarketingBreakdown } from "@/lib/pricing";
import { useAnalytics, useImpression } from "@/components/AnalyticsProvider";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  ShoppingCart,
  TrendingDown,
  Truck,
  PackageCheck,
  AlertCircle,
  Search,
  Flame,
  ShieldCheck
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface BikeData {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: number;
  type: string;
  status: "available" | "order" | "new" | "used";
  priceEU: number;
  priceWithDelivery: number;
  priceRUB: number;
  savings: number;
  image: string;
  description: string;
  tags: string[];
  size?: string;
  wheelDiameter?: string;
  favoritesCount?: number;
  isReserviert?: boolean;
  is_hot?: boolean;
  ranking_score?: number;
  seller?: string;
  sellerType?: string;
  initial_quality_class?: 'A' | 'B' | 'C';
  final_quality_class?: 'A' | 'B' | 'C';
  active_order_status?: string;
  shipping_option?: string;
  logistics_priority?: 'none' | 'medium' | 'high';
  condition_score?: number;
  condition_grade?: string;
  condition_reason?: string;
  seller_name?: string;
  seller_type?: string;
  seller_member_since?: string;
  seller_badges?: string[];
  guaranteed_pickup?: boolean;
  hotness_score?: number;
  sub_category?: string;
  discipline?: string;
}

export const BikeCard: React.FC<{ bike: BikeData; variant?: "default" | "compact" }> = ({ bike, variant = "default" }) => {
  const { openCart, showNotification } = useCartUI();
  const { openLeadModal } = useLeadSystem();
  const { openBuyback } = useCheckoutUI();
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [isHot, setIsHot] = React.useState(!!bike.is_hot);
  const [negotiationStarted, setNegotiationStarted] = React.useState(false);
  const [negotiationLoading, setNegotiationLoading] = React.useState(false);

  const calc = calculatePriceBreakdown(Number(bike.priceEU), 'Cargo', false);
  const priceRub = calc.totalRub;

  // AI Hotness Badge Logic
  const getHotnessBadge = (score?: number) => {
    // Priority: Explicit Hot Flag
    if (bike.is_hot) return { text: '🔥 BEST DEAL', color: 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md', description: 'Best value for money!' };

    if (!score) return null;
    if (score >= 80) return { text: '🔥 HOT DEAL', color: 'bg-gradient-to-r from-red-500 to-rose-600', description: 'High demand! Likely to sell within 3 days.' };
    if (score >= 60) return { text: '⚡ Popular', color: 'bg-gradient-to-r from-orange-400 to-amber-500', description: 'Getting lots of views.' };
    if (score >= 40) return { text: '👍 Good Value', color: 'bg-gradient-to-r from-blue-500 to-indigo-600', description: 'Solid choice for the price.' };
    return null;
  };

  const hotnessBadge = getHotnessBadge(bike.hotness_score);

  // Logistics Sniper 2.0 Logic (Triad Status)
  let isShippingAvailable: boolean, isGuaranteedPickup: boolean, isLocalLot: boolean;

  // Use Triad ID if available (Unified with ProductDetailPage)
  if ((bike as any).triad_id) {
    const tid = Number((bike as any).triad_id);
    isShippingAvailable = tid === 1;
    isGuaranteedPickup = tid === 2;
    isLocalLot = tid === 3;
  } else {
    isShippingAvailable = !bike.shipping_option || bike.shipping_option === 'available' || bike.shipping_option === 'unknown';
    isGuaranteedPickup = !isShippingAvailable && !!bike.guaranteed_pickup;
    isLocalLot = !isShippingAvailable && !isGuaranteedPickup;
  }
  const isPickupOnly = !isShippingAvailable;

  const isAvailable = bike.status === "available";
  const isSuperHot = (bike.hotness_score || 0) > 1000;

  const handleNegotiationRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (negotiationStarted) return;

    setNegotiationLoading(true);
    try {
      await apiPost('/negotiation/request', { bikeId: bike.id });
      setNegotiationStarted(true);
      showNotification({
        title: "Переговоры начаты",
        message: "ИИ-агент отправил предложение продавцу. Мы сообщим результат.",
        type: "success"
      });
    } catch (error) {
      showNotification({
        title: "Ошибка",
        message: "Не удалось начать переговоры.",
        type: "error"
      });
    } finally {
      setNegotiationLoading(false);
    }
  };

  const [added, setAdded] = React.useState(false);
  const [ripple, setRipple] = React.useState(false);
  const [images, setImages] = React.useState<string[]>(
    (bike.image ? [resolveImageUrl(bike.image)] : []).filter((x): x is string => !!x)
  );
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const timerRef = React.useRef<number | null>(null);

  // Tracking: Scroll (debounced)
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const bikeId = Number(bike.id);
    const handler = setTimeout(() => {
      metricsApi.sendEvents([{ type: 'scroll', bikeId }]).catch(() => { });
    }, 2000);
    return () => clearTimeout(handler);
  }, [currentIndex, bike.id]);

  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const [orderOverlayOpen, setOrderOverlayOpen] = React.useState(false);
  const [bestPrice, setBestPrice] = React.useState(false);
  const favKey = "guestFavorites";
  const { trackEvent } = useAnalytics();
  const cardRef = React.useRef<HTMLDivElement>(null);

  const analyticsData = React.useMemo(() => ({
    price: bike.priceEU,
    brand: bike.brand,
    discipline: bike.type
  }), [bike.priceEU, bike.brand, bike.type]);

  useImpression(cardRef, Number(bike.id), analyticsData);

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
    if (next) trackEvent('favorite', Number(bike.id), analyticsData);
  };

  const toggleHot = async (e: React.MouseEvent) => {
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

  const fallbackSrc = "/placeholder-bike.svg";
  const handleImgError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const el = e.currentTarget as HTMLImageElement;
    if (el.dataset.fallbackApplied === "1") return;
    el.dataset.fallbackApplied = "1";
    el.src = fallbackSrc;
  };

  // Sync images from bike.image prop if it changes (e.g., after API data loads)
  React.useEffect(() => {
    if (bike.image && images.length === 0) {
      const resolved = resolveImageUrl(bike.image);
      if (resolved) setImages([resolved]);
    }
  }, [bike.image]);

  React.useEffect(() => {
    let cancelled = false;
    type ImagesRespItem = { image_url?: string };
    type ImagesResp = { images?: ImagesRespItem[] };
    apiGet(`/bike-images?bikeId=${bike.id}`)
      .then((resp: ImagesResp) => {
        if (cancelled) return;
        const arr: string[] = Array.isArray(resp?.images)
          ? resp.images.map((x: ImagesRespItem) => resolveImageUrl(x.image_url)).filter((x): x is string => !!x)
          : [];
        if (arr.length > 0) setImages(arr);
      })
      .catch(() => { void 0 });
    return () => { cancelled = true };
  }, [bike.id]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await adminApi.getEvaluation(Number(bike.id));
        const score = r?.evaluation?.price_value_score ?? null;
        if (!cancelled) setBestPrice(Number(score) === 10);
      } catch { void 0 }
    })();
    return () => { cancelled = true };
  }, [bike.id]);

  // Fallback to bike.image if images array is empty
  const imageSrc = images[currentIndex] || images[0] || (bike.image ? resolveImageUrl(bike.image) : null) || "";

  const next = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    trackEvent('gallery_swipe', Number(bike.id), analyticsData, { direction: 'next', index: (currentIndex + 1) % images.length });
    setCurrentIndex((idx) => (images.length ? (idx + 1) % images.length : idx));
  };
  const prev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    trackEvent('gallery_swipe', Number(bike.id), analyticsData, { direction: 'prev' });
    setCurrentIndex((idx) => (images.length ? (idx - 1 + images.length) % images.length : idx));
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

  const title = (bike.name && bike.name.trim())
    || [bike.brand, bike.model].filter(Boolean).join(" ").trim();

  // Generate SEO-friendly alt text
  const altText = `${bike.brand} ${bike.model} ${bike.year || ''} б/у - ${title}`.trim();
  const badgeChips = React.useMemo(() => {
    const chips: string[] = [];
    const poolArr = [title, bike.model, bike.description, ...(Array.isArray(bike.tags) ? bike.tags : [])].filter(Boolean);
    const poolText = poolArr.join(" ");
    const norm = poolText
      .replace(/\u00A0/g, ' ')
      .replace(/[,]/g, '.')
      .replace(/\s+\/\s+/g, '/')
      .trim();
    const yearVal = Number(bike.year) || ((): number | null => {
      const m = norm.match(/\b(20\d{2})\b/);
      return m ? Number(m[1]) : null;
    })();
    const sizeVal = bike.size || ((): string | null => {
      const up = norm.toUpperCase();
      const m1 = up.match(/\b(XXS|XS|S|SM|MD|M|LG|L|XL|XXL|S[1-6])\b/);
      if (m1) return m1[1];
      const m2 = up.match(/\b(SMALL|MEDIUM|LARGE)\b/);
      if (m2) { const map: Record<string, string> = { SMALL: 'S', MEDIUM: 'M', LARGE: 'L' }; return map[m2[1]]; }
      const m3 = up.match(/\b(4[8-9]|5[0-9]|6[0-2])\s?CM\b/);
      if (m3) return `${m3[1]}cm`;
      const m4 = up.match(/\b(17|18|19|20|21)\s?"?\b/);
      if (m4) return `${m4[1]}"`;
      return null;
    })();
    const wheelVal = bike.wheelDiameter || ((): string | null => {
      const t = norm.toLowerCase();
      const m1 = t.match(/\b(29|27\.5|26|28|24|20)\b/);
      if (m1) return m1[1] === '27.5' ? '27.5"' : `${m1[1]}"`;
      const m2 = t.match(/\b700\s?c\b/);
      if (m2) return '700c';
      const m3 = t.match(/\b650\s?b\b/);
      if (m3) return '650b';
      const m4 = t.match(/\b29er\b/);
      if (m4) return '29"';
      return null;
    })();
    const isKnown = (v: unknown) => {
      const s = String(v ?? '').trim();
      return !!s && !/^(не указан|не указано|unknown|not specified)$/i.test(s);
    };
    if (yearVal) chips.push(String(yearVal));
    if (isKnown(sizeVal)) chips.push(String(sizeVal).toUpperCase());
    if (isKnown(wheelVal)) chips.push(String(wheelVal));
    return chips.slice(0, 3);
  }, [title, bike.model, bike.description, bike.tags, bike.year, bike.size, bike.wheelDiameter]);


  const statusColors = {
    available: "bg-green-500/10 text-green-500 border-green-500/20",
    order: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    new: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    used: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  } as const;

  const statusLabels = {
    available: "Доступен",
    order: "Под заказ",
    new: "Новый",
    used: "Б/У",
  } as const;

  const isQualityChecking = bike.active_order_status === 'deposit_paid' || bike.active_order_status === 'under_inspection';

  const qualityColor = (cls?: string) => {
    if (cls === 'A') return "bg-green-500 hover:bg-green-600";
    if (cls === 'B') return "bg-yellow-500 hover:bg-yellow-600";
    if (cls === 'C') return "bg-orange-500 hover:bg-orange-600";
    return "bg-gray-500";
  };

  const renderLogisticsBadge = () => {
    if (isShippingAvailable) {
      return (
        <Badge className="bg-emerald-500/90 hover:bg-emerald-600 text-white border-none backdrop-blur-md shadow-sm px-2 py-0.5 text-[10px]">
          <PackageCheck className="w-3 h-3 mr-1" /> Доставка доступна
        </Badge>
      );
    }
    if (isGuaranteedPickup) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-blue-500/90 hover:bg-blue-600 text-white border-none backdrop-blur-md shadow-sm px-2 py-0.5 text-[10px]">
                <ShieldCheck className="w-3 h-3 mr-1" /> Гарантированный самовывоз
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Мы лично заберем этот байк. +X€ к цене за выезд эксперта.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    if (isLocalLot) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-orange-500/90 hover:bg-orange-600 text-white border-none backdrop-blur-md shadow-sm px-2 py-0.5 text-[10px]">
                <AlertCircle className="w-3 h-3 mr-1" /> Локальный лот
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Требуется согласование. Попробуем договориться с продавцом об отправке.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return null;
  };

  if (variant === "compact") {
    const hasDiscount = Number(bike.savings) > 0;
    const originalBasePrice = hasDiscount ? (bike.priceEU + bike.savings) : 0;
    const originalPriceRub = hasDiscount ? Math.round(calculatePriceBreakdown(originalBasePrice, 'Cargo', false).totalRub) : null;
    const discountPercent = originalBasePrice ? Math.max(0, Math.round((1 - (bike.priceEU / originalBasePrice)) * 100)) : 0;
    return (
      <div
        ref={cardRef}
        data-testid="bike-card"
        className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-sm cursor-pointer w-full md:w-auto shrink-0 snap-start"
        onClick={() => {
          trackEvent('click', Number(bike.id), analyticsData);
          window.location.href = `/product/${bike.id}`;
        }}
        onMouseEnter={() => {
          // Only on desktop
          if (window.matchMedia('(min-width: 768px)').matches) {
            startAuto();
            trackEvent('hover', Number(bike.id), analyticsData);
          }
        }}
        onMouseLeave={stopAuto}
      >
        {/* Fixed 9:10 aspect ratio for consistent card heights */}
        <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: '9 / 10' }}>
          {imageSrc ? (
            <img
              src={getThumbnailUrl(imageSrc)}
              alt={altText}
              onError={handleImgError}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              Нет фотографий
            </div>
          )}

          {/* Quality Badge for Compact */}
          {bike.initial_quality_class && (
            <div className="absolute top-2 left-2 z-20">
              <Badge className={cn("text-white font-bold px-2 py-0.5 text-[10px] shadow-sm", qualityColor(bike.initial_quality_class))}>
                Класс {bike.initial_quality_class}
              </Badge>
            </div>
          )}

          {/* Reservation Overlay for Compact */}
          {bike.isReserviert && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
              <span className="text-white text-xl font-bold text-center px-4">
                {isQualityChecking ? "Идет проверка качества" : "Зарезервирован"}
              </span>
            </div>
          )}

          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
            {renderLogisticsBadge()}
            {isHot && !bike.initial_quality_class && (
              <div className="bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm">
                Горячее предложение
              </div>
            )}

            {/* AI Hotness Badge for Compact */}
            {hotnessBadge && (
              <div className={cn(
                "text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm backdrop-blur-sm",
                hotnessBadge.color
              )}>
                {hotnessBadge.text}
              </div>
            )}
          </div>
          {hasDiscount && (
            <div className="absolute top-2 right-2 bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 z-10 rounded-full shadow-sm">
              Скидка
            </div>
          )}
          {user?.role === 'admin' && (
            <button
              onClick={toggleHot}
              className={cn(
                "absolute left-3 top-8 z-20 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm transition-colors border",
                isHot ? "bg-red-600 text-white border-red-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
              )}
            >
              {isHot ? "HOT" : "Make Hot"}
            </button>
          )}
          <img src="/minilogo11.png" alt="" className="absolute right-2 top-2 h-8 w-8 opacity-70 pointer-events-none select-none" />
          {images.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/60 p-2 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/60 p-2 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <button
            data-testid="favorite-btn"
            aria-pressed={isFavorite}
            onClick={toggleFavorite}
            className="absolute right-3 bottom-3 rounded-full bg-white/90 px-2 py-1 text-xs flex items-center gap-1 shadow-sm"
          >
            <Heart
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
              )}
            />
            <span className="text-muted-foreground">{(() => { const idNum = Number(bike.id) || 0; const n = ((idNum * 9301 + 49297) % 233280) / 233280; return 8 + Math.floor(n * 23); })()}</span>
          </button>
        </div>

        <div className="p-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 min-h-[20px]">
            {badgeChips.map((chip, idx) => (
              <span
                data-testid="chip"
                key={`${chip}-${idx}`}
                className="inline-flex rounded-md border border-muted-foreground/20 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="mb-1">
            {bike.brand && (
              <p className="text-xs text-muted-foreground">{bike.brand}</p>
            )}
            <h3 className="text-base font-semibold leading-tight line-clamp-1">
              {title}
            </h3>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-900">
              от {Math.round(priceRub).toLocaleString('ru-RU')} ₽
            </span>
            <span className="text-[10px] text-muted-foreground">
              ({Math.round(bike.priceEU)} €)
            </span>
          </div>

          <div className="mt-1.5">
            {bike.status === "new" ? (
              <Badge className="border bg-green-500/10 text-green-600 border-green-500/20">New</Badge>
            ) : null}
          </div>
          <div className="mt-2">
            <Button
              size="sm"
              className={cn(
                "w-full relative overflow-hidden transition-all duration-300",
                added
                  ? "bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 text-white hover:from-green-600 hover:to-emerald-500 scale-[1.02] shadow-md"
                  : "bg-primary hover:bg-primary/90 text-white shadow-md"
              )}
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/product/${bike.id}`;
              }}
            >
              <Search className="mr-2 h-4 w-4" /> Подробнее
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      data-testid="bike-card"
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card transition-all hover:shadow-lg cursor-pointer flex flex-col h-full",
        isShippingAvailable ? "border-emerald-500/30 hover:shadow-emerald-500/10" : "",
        isGuaranteedPickup ? "border-blue-500/30 hover:shadow-blue-500/10 animate-pulse-glow shadow-blue-400/20" : "",
        isLocalLot ? "border-orange-500/30 hover:shadow-orange-500/10" : "border-border"
      )}
      onClick={() => {
        trackEvent('click', Number(bike.id), analyticsData);
        window.location.href = `/product/${bike.id}`;
      }}
      onMouseEnter={() => {
        // Only on desktop
        if (window.matchMedia('(min-width: 768px)').matches) {
          startAuto();
          trackEvent('hover', Number(bike.id), analyticsData);
        }
      }}
      onMouseLeave={stopAuto}
    >
      {/* Fixed 9:10 aspect ratio for consistent card heights */}
      <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: '9 / 10' }}>
        {imageSrc ? (
          <img
            src={getThumbnailUrl(imageSrc)}
            alt={title}
            onError={handleImgError}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Нет фотографий
          </div>
        )}
        {/* Quality Badge */}
        {bike.initial_quality_class && (
          <div className="absolute top-3 left-3 z-20">
            <Badge className={cn("text-white font-bold px-2 py-1 shadow-md", qualityColor(bike.initial_quality_class))}>
              Класс {bike.initial_quality_class}
            </Badge>
          </div>
        )}

        {/* Reservation Overlay */}
        {bike.isReserviert && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
            <span className="text-white text-xl font-bold text-center px-4">
              {isQualityChecking ? "Идет проверка качества" : "Зарезервирован"}
            </span>
          </div>
        )}

        {/* Hot Badge (hidden if quality badge exists to avoid clutter) */}
        {isHot && !bike.initial_quality_class && (
          <div className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 z-10 rounded-full shadow-sm">
            Горячее предложение
          </div>
        )}
        {Number(bike.savings) > 0 && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 z-10 rounded-full shadow-sm">
            Скидка
          </div>
        )}
        {user?.role === 'admin' && (
          <button
            onClick={toggleHot}
            className={cn(
              "absolute left-3 top-8 z-20 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm transition-colors border",
              isHot ? "bg-red-600 text-white border-red-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
            )}
          >
            {isHot ? "HOT" : "Make Hot"}
          </button>
        )}
        <img src="/minilogo11.png" alt="" className="absolute right-2 top-2 h-8 w-8 opacity-70 pointer-events-none select-none" />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/60 p-2 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/60 p-2 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            onClick={toggleFavorite}
            className={cn(
              "h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-sm border border-transparent",
              isFavorite ? "text-red-500 bg-red-50 border-red-100" : "text-gray-400 hover:text-red-500 hover:border-red-100"
            )}
          >
            <Heart className={cn("h-4 w-4 transition-all", isFavorite && "fill-current scale-110")} />
          </button>

          {/* Hotness Indicator */}
          {isSuperHot && (
            <div className="h-8 w-8 rounded-full bg-orange-500/90 backdrop-blur-sm flex items-center justify-center shadow-sm animate-pulse">
              <Flame className="h-4 w-4 text-white fill-current" />
            </div>
          )}
        </div>
        <Badge className={cn("absolute left-3 top-3 border", statusColors[bike.status])}>
          {statusLabels[bike.status]}
        </Badge>

        <Button
          size="sm"
          className="absolute left-1/2 bottom-3 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          onClick={(e) => { e.stopPropagation(); setQuickViewOpen(true); }}
        >
          Быстрый просмотр
        </Button>
      </div>

      <div className="flex h-full flex-col p-4">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 min-h-[20px]">
          {renderLogisticsBadge()}

          {/* Existing Badges */}
          {badgeChips.slice(0, 3).map((chip) => (
            <Badge
              key={chip}
              variant="secondary"
              className="bg-muted/50 text-muted-foreground hover:bg-muted text-[10px] px-1.5 h-5 font-normal"
            >
              {chip}
            </Badge>
          ))}
        </div>
        <div>
          {bike.brand && (
            <div className="flex justify-between items-center mb-0.5">
              <p className="text-xs text-muted-foreground">{bike.brand}</p>
              <p className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded-full">
                Добавлен {Math.max(1, (Number(bike.id) * 7) % 5)} дн. назад
              </p>
            </div>
          )}
          <h3 className="text-lg font-semibold">
            {title}
          </h3>
        </div>

        {(() => {
          const hasDiscount = Number(bike.savings) > 0;
          const originalBasePrice = hasDiscount ? (bike.priceEU + bike.savings) : 0;
          const originalPriceRub = hasDiscount ? Math.round(calculatePriceBreakdown(originalBasePrice, 'Cargo', false).totalRub) : null;
          const discountPercent = originalBasePrice ? Math.max(0, Math.round((1 - (bike.priceEU / originalBasePrice)) * 100)) : 0;

          if (isLocalLot) {
            return (
              <div className="mt-1.5">
                <div className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <TrendingDown className="w-3 h-3" />
                  Эксклюзив (-25%)
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-900 font-extrabold text-[26px]">{Math.round(priceRub).toLocaleString()} ₽</span>
                  <span className="text-xs text-muted-foreground">(через переговоры)</span>
                </div>
              </div>
            );
          }

          if (isGuaranteedPickup) {
            return (
              <div className="mt-1.5">
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <ShieldCheck className="w-3 h-3" />
                  Личный выкуп
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-900 font-extrabold text-[26px]">{Math.round(priceRub).toLocaleString()} ₽</span>
                  <span className="text-xs text-muted-foreground">(+ выезд)</span>
                </div>
              </div>
            );
          }

          return (
            <div className="mt-1.5">
              <div className="flex items-baseline gap-2">
                <span className={(bestPrice || hasDiscount || isHot ? "text-red-600 " : "text-black ") + "font-extrabold text-[26px]"}>от {Math.round(priceRub).toLocaleString('ru-RU')} ₽</span>
                {originalPriceRub ? (
                  <span className="text-xs text-muted-foreground line-through opacity-70">{originalPriceRub.toLocaleString()} ₽</span>
                ) : null}
              </div>
              {hasDiscount ? (
                <div className="mt-1">
                  <Badge className="border bg-red-500/10 text-red-600 border-red-500/20">скидка {discountPercent}%</Badge>
                </div>
              ) : null}
            </div>
          );
        })()}

        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => { e.stopPropagation(); window.location.href = `/product/${bike.id}`; }}
          >
            Подробнее
          </Button>
          <Button
            size="sm"
            className={cn(
              "flex-1 relative overflow-hidden transition-all duration-300",
              added
                ? "bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 text-white hover:from-green-600 hover:to-emerald-500 scale-[1.03] shadow-lg"
                : "bg-primary hover:bg-primary/90 text-white shadow-md"
            )}
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `/product/${bike.id}`;
            }}
          >
            <Search className="mr-2 h-4 w-4" /> Подробнее
          </Button>
        </div>

        {bike.condition_grade && bike.condition_score && (
          <div className="mt-2 p-2 bg-muted/30 rounded-lg text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-foreground">Состояние {bike.condition_grade}</span>
              <span className={cn(
                "font-bold",
                bike.condition_score >= 80 ? "text-green-600" :
                  bike.condition_score >= 60 ? "text-yellow-600" : "text-red-600"
              )}>{bike.condition_score}/100</span>
            </div>
            {bike.condition_reason && (
              <p className="text-muted-foreground line-clamp-2 leading-tight">
                {bike.condition_reason}
              </p>
            )}
          </div>
        )}

        {bike.seller_name && (
          <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold">{bike.seller_name}</span>
              <span>{bike.seller_type}</span>
            </div>
            {bike.seller_member_since && <div className="text-[10px] opacity-70">На сайте с {bike.seller_member_since}</div>}
            {bike.seller_badges && bike.seller_badges.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {bike.seller_badges.slice(0, 3).map((b, i) => (
                  <span key={i} className="bg-blue-50 text-blue-600 px-1 rounded-[2px] text-[9px] border border-blue-100">{b}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">{bike.description}</p>

        <div className="flex flex-wrap gap-2">
          {bike.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <div>
              <div className="relative overflow-hidden rounded-md border">
                <img src={imageSrc} alt={altText} onError={handleImgError} className="aspect-square w-full object-cover" />
                {bike.isReserviert && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
                    <span className="text-white text-2xl font-bold">Зарезервирован</span>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button size="icon" variant="outline" onClick={(e) => { e.stopPropagation(); prev(); }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentIndex + 1} / {images.length}
                  </span>
                  <Button size="icon" variant="outline" onClick={(e) => { e.stopPropagation(); next(); }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">{bike.year} · {bike.brand} {bike.model}</div>
                <div className="flex items-end gap-3">
                  <div className={(bestPrice || isHot ? "text-red-600 " : "text-black ") + "text-2xl font-extrabold"}>{bike.priceRUB.toLocaleString()} ₽</div>
                </div>
              </div>

              <div className="rounded-md border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Базовая цена (Германия)</span>
                  <span className="font-medium">{bike.priceEU} €</span>
                </div>
                <div className="mt-2 flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Экономия</span>
                  <span className="flex items-center gap-1 font-bold text-green-600">
                    <TrendingDown className="h-4 w-4" /> {Math.round(bike.savings).toLocaleString()} ₽
                  </span>
                </div>
              </div>

              <p className="line-clamp-4 text-sm text-muted-foreground">{bike.description}</p>

              <div className="flex gap-2">
                <Button
                  className={cn(
                    "flex-1 relative overflow-hidden transition-all duration-300",
                    added
                      ? "bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 text-white hover:from-green-600 hover:to-emerald-500 scale-[1.03] shadow-lg"
                      : ""
                  )}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user?.id) { setOrderOverlayOpen(true); return; }
                    if (added) { window.location.href = '/cart'; return; }
                    try {
                      const calcPrice = Math.round(Number(bike.priceWithDelivery || bike.priceEU));
                      const res = await apiPost('/cart', { bikeId: Number(bike.id), quantity: 1, calculatedPrice: calcPrice });
                      if (res?.success) {
                        setAdded(true);
                        setRipple(true);
                        window.setTimeout(() => setRipple(false), 700);
                        try { await metricsApi.sendEvents([{ type: 'add_to_cart', bikeId: Number(bike.id) }]); } catch { void 0 }
                        showNotification(imageSrc);
                        setQuickViewOpen(false);
                      } else if (res?.status === 401 || res?.error === 'Access token required') {
                        setOrderOverlayOpen(true);
                      } else {
                        console.warn('Add to cart failed', res);
                      }
                    } catch (err) {
                      console.warn('Failed to add to cart', err);
                    }
                  }}
                >
                  {ripple && (
                    <>
                      <span className="pointer-events-none absolute inset-0 rounded-md animate-ping bg-green-400/20" style={{ animationDuration: '600ms' }} />
                      <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3/4 w-3/4 rounded-md animate-ping bg-emerald-400/20" style={{ animationDuration: '700ms' }} />
                      <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2/4 w-2/4 rounded-md animate-ping bg-green-300/25" style={{ animationDuration: '800ms' }} />
                    </>
                  )}
                  <ShoppingCart className="mr-2 h-4 w-4" /> {added ? 'В корзине | Перейти в корзину' : 'В корзину'}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => { e.stopPropagation(); window.location.href = `/product/${bike.id}`; }}
                >
                  Подробнее
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default BikeCard;
