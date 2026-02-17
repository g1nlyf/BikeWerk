"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Star, Heart, CheckCircle, Truck, ChevronLeft, ChevronRight, ChevronDown, X, ShieldCheck, BadgeCheck, Lock, HelpCircle, Share2, MapPin, Info, Languages, AlertCircle, Ruler, Calendar, CircleDashed, MessageCircle, FileText, AlertTriangle, User, Users, Store, Pencil, Save, ExternalLink, Bell, Target, Clock, Video, Camera, Sparkles, Flame, PackageCheck, Zap, Eye } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { useAuth } from "@/lib/auth";
import { apiGet, adminApi, metricsApi, apiPost, apiPut, resolveImageUrl, crmApi } from "@/api";
import { getFullSizeUrl, getThumbnailUrl } from "@/utils/imagekit";
import { useCartUI } from "@/lib/cart-ui";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { calculatePriceBreakdown, formatRUB } from "@/lib/pricing";
import { RATES, calculateMarketingBreakdown, refreshRates } from "@/lib/pricing";
import { formatDeposit } from "@/lib/utils";
import { ValueStack, AIInsightTooltip } from "@/components/product/ValueStack";
import { WaitlistForm } from "@/components/WaitlistForm";

import MiniCatalogBikeflip from "@/components/landing/MiniCatalogBikeflip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import { SniperAnalysis } from "@/components/catalog/SniperAnalysis";
import { SEOHead } from "@/components/SEO/SEOHead";

type Product = {
  id: string;
  sku: string;
  brand: string;
  model: string;
  title: string;
  rating: number; // 0-5
  reviewsCount: number;
  price: number; // EUR
  market_price?: number; // FMV
  technicalSummary?: string; // AI Reasoning
  discountPrice?: number; // EUR
  originalPrice?: number;
  watchersCount?: number;
  priceRUB: number; // RUB (approx)
  images: string[];
  description: string;
  characteristics: Record<string, string | number>;
  sellerName?: string;
  sellerType?: string;
  sellerMemberSince?: string;
  sellerBadges?: string[];
  location?: string;
  frameSize?: string;
  wheelDiameter?: string;
  condition?: string;
  isReserviert?: boolean;
  is_hot?: boolean;
  ranking_score?: number;
  savings?: number;
  initial_quality_class?: 'A' | 'B' | 'C';
  final_quality_class?: 'A' | 'B' | 'C';
  condition_score?: number;
  condition_reason?: string;
  technical_score?: number;
  condition_class?: string;
  components_json?: any;
  ai_specs?: Record<string, string>;
  description_ru?: string;
  active_order_status?: string;
  external_link?: string;
  hotness_score?: number;
  shipping_option?: string;
  guaranteed_pickup?: boolean;
  triad_id?: number;

  // Seller extended
  sellerRating?: number | null;
  sellerVerified?: boolean;
  sellerLastActive?: string;
  sellerLocation?: string;
  sellerCountry?: string;

  // Condition extended
  visualRating?: number;
  functionalRating?: number;
  wearIndicators?: Record<string, string>;
  conditionIssues?: string[];

  // Specs extended
  suspensionType?: string;
  travelFront?: number;
  travelRear?: number;
  shock?: string;
  drivetrain?: string;
  brakesType?: string;
  tires?: string;
  color?: string;
  year?: number;

  // Features
  highlights?: string[];
  upgrades?: string[];
};

const FAQ_DATA = [
  {
    id: 'delivery',
    question: 'Как происходит доставка?',
    answer: 'Мы тщательно упаковываем велосипед в специальную коробку и страхуем отправку на полную стоимость. Доставка по РФ занимает 10-14 дней.',
    tags: ['general']
  },
  {
    id: 'deposit',
    question: 'Почему нужен задаток?',
    answer: 'Задаток подтверждает серьезность намерений. Он входит в стоимость и возвращается в полном объеме, если состояние велосипеда не соответствует заявленному классу.',
    tags: ['general']
  },
  {
    id: 'return',
    question: 'Можно ли вернуть велосипед?',
    answer: 'После того как байк уехал из Германии — вернуть его продавцу нельзя (европейские законы о б/у товарах). Но если байк пришел не в том состоянии, что мы заявляли — мы компенсируем разницу или выкупим его у вас.',
    tags: ['general']
  },
  {
    id: 'battery',
    question: 'В каком состоянии аккумулятор?',
    answer: 'Для электровелосипедов мы запрашиваем диагностическую карту батареи и количество циклов заряда. Если емкость ниже 80%, мы обязательно вас предупредим.',
    tags: ['ebike']
  },
  {
    id: 'carbon',
    question: 'Проверяется ли карбон на трещины?',
    answer: 'Рамы из карбона проходят визуальную дефектовку. При подозрениях мы запрашиваем ультразвуковое сканирование у продавца.',
    tags: ['carbon']
  },
  {
    id: 'locallot',
    question: 'Что такое "Локальный лот"?',
    answer: 'Это велосипед, продавец которого рассматривает только самовывоз и находится далеко от наших хабов. Из-за оптимизации логистики мы не всегда можем выехать за ним. Однако, наши эксперты постараются договориться с продавцом об отправке (мы оплатим коробку и бонус за хлопоты). Бронь таких лотов бесплатна, так как есть риск отказа продавца.',
    tags: ['locallot', 'general']
  }
];

function getFilteredFAQ(product: Product) {
  const category = String(product.characteristics?.['Категория'] || product.characteristics?.['Тип'] || '').toLowerCase();
  const frameMaterial = String(product.characteristics?.['Рама'] || product.characteristics?.['Материал рамы'] || '').toLowerCase();

  // Check if it is a local lot (Triad ID 3 or implied)
  let isLocalLot = false;
  if (product.triad_id) {
    isLocalLot = Number(product.triad_id) === 3;
  } else {
    const isShippingAvailable = !product.shipping_option || product.shipping_option === 'available' || product.shipping_option === 'unknown';
    const isGuaranteedPickup = !isShippingAvailable && !!product.guaranteed_pickup;
    isLocalLot = !isShippingAvailable && !isGuaranteedPickup;
  }

  return FAQ_DATA.filter(item => {
    if (item.tags.includes('locallot') && isLocalLot) return true;
    if (item.tags.includes('locallot') && !isLocalLot) return false;
    if (item.tags.includes('general')) return true;
    if (item.tags.includes('ebike') && (category.includes('ebike') || category.includes('электро') || product.title.toLowerCase().includes('e-bike'))) return true;
    if (item.tags.includes('carbon') && (frameMaterial.includes('carbon') || frameMaterial.includes('карбон'))) return true;
    return false;
  });
}

// Mock catalog (synced with CatalogPage bikes visually)
const catalog: Product[] = [
  {
    id: "1",
    sku: "BIKE-TR-FUEL-98",
    brand: "Trek",
    model: "Fuel EX 9.8",
    title: "Trek Fuel EX 9.8 (2024)",
    rating: 4.8,
    reviewsCount: 124,
    price: 3960,
    discountPrice: 3720,
    priceRUB: 374220,
    images: [
      "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=1200&q=80",
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=1200&q=80",
      "https://images.unsplash.com/photo-1511994298241-608e28f14fde?w=1200&q=80",
    ],
    description:
      "Полноподвесный трейловый велосипед с карбоновой рамой, современной геометрией и продуманной подвеской для агрессивного катания.",
    characteristics: {
      Рама: "Carbon OCLV",
      Ход: "140мм/150мм",
      Колеса: "29",
      Вес: "13.6 кг",
      Год: 2024,
      Гарантия: "2 года",
    },
  },
  {
    id: "2",
    sku: "BIKE-SP-TARMAC-SL7",
    brand: "Specialized",
    model: "Tarmac SL7",
    title: "Specialized Tarmac SL7 (2024)",
    rating: 4.9,
    reviewsCount: 207,
    price: 5400,
    discountPrice: 4990,
    priceRUB: 510300,
    images: [
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=1200&q=80",
      "https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=1200&q=80",
      "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=1200&q=80",
    ],
    description:
      "Профессиональный шоссейный велосипед с аэродинамической рамой и гоночной посадкой.",
    characteristics: {
      Рама: "Carbon FACT",
      Группа: "Shimano Ultegra Di2",
      Колеса: "700c",
      Вес: "7.2 кг",
      Год: 2024,
      Гарантия: "2 года",
    },
  },
  {
    id: "3",
    sku: "BIKE-CN-GRAIL-8",
    brand: "Canyon",
    model: "Grail CF SL 8",
    title: "Canyon Grail CF SL 8 (2023)",
    rating: 4.7,
    reviewsCount: 89,
    price: 3360,
    discountPrice: 3190,
    priceRUB: 317520,
    images: [
      "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=1200&q=80",
      "https://images.unsplash.com/photo-1511994298241-608e28f14fde?w=1200&q=80",
      "https://images.unsplash.com/photo-1559348349-86f1f65817fe?w=1200&q=80",
    ],
    description: "Гравийный велосипед для приключений и дальних поездок по смешанным покрытиям.",
    characteristics: {
      Рама: "Carbon CF SL",
      Группа: "SRAM Rival",
      Колеса: "700c",
      Вес: "8.8 кг",
      Год: 2023,
      Гарантия: "2 года",
    },
  },
];

function useProductFromPath() {
  const [product, setProduct] = React.useState<Product | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const id = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : undefined;
    if (!id) return;
    try {
      const data = await apiGet(`/bikes/${id}`);
      const b = data?.bike || data; // Now returns Unified Format

      if (!b || (!b.id && !b.meta?.id)) {
        // Fallback to local mock catalog if API unavailable
        const fallback = catalog.find((p) => String(p.id) === String(id));
        if (fallback) { setProduct(fallback); return; }
        setProduct(null); return;
      }

      // Handle Unified Format (b.media.gallery) vs Legacy (b.images)
      let images: string[] = [];
      if (b.media && Array.isArray(b.media.gallery)) {
        images = b.media.gallery.map((img: any) => resolveImageUrl(img));
      } else if (Array.isArray(b.images)) {
        images = b.images.map((img: any) => resolveImageUrl(img.image_url || img));
      }
      // Ensure main image is first if not present
      const mainImg = resolveImageUrl(b.media?.main_image || b.main_image);
      if (mainImg && !images.includes(mainImg)) {
        images.unshift(mainImg);
      }
      if (images.length === 0 && mainImg) images.push(mainImg);

      // Specs Mapping
      const specs: Record<string, string | number> = {};
      if (b.specs) {
        if (b.specs.frame_size) specs['Размер рамы'] = b.specs.frame_size;
        if (b.specs.wheel_size) specs['Колеса'] = b.specs.wheel_size;
        if (b.specs.frame_material) specs['Материал'] = b.specs.frame_material;
        if (b.specs.weight) specs['Вес'] = typeof b.specs.weight === 'number' ? `${b.specs.weight} кг` : b.specs.weight;
        if (b.specs.groupset) specs['Групсет'] = b.specs.groupset;
        if (b.specs.brakes) specs['Тормоза'] = b.specs.brakes;
        if (b.specs.fork) specs['Вилка'] = b.specs.fork;
        if (b.basic_info?.year || b.year) specs['Год'] = b.basic_info?.year || b.year;
        // Extended specs
        if (b.specs.shock) specs['Задний амортизатор'] = b.specs.shock;
        if (b.specs.suspension_type) specs['Подвеска'] = b.specs.suspension_type === 'full' ? 'Двухподвес' : (b.specs.suspension_type === 'hardtail' ? 'Хардтейл' : b.specs.suspension_type);
        if (b.specs.travel_front) specs['Ход вилки'] = `${b.specs.travel_front} мм`;
        if (b.specs.travel_rear) specs['Ход задней подвески'] = `${b.specs.travel_rear} мм`;
        if (b.specs.drivetrain) specs['Трансмиссия'] = b.specs.drivetrain;
        if (b.specs.brakes_type) specs['Тип тормозов'] = b.specs.brakes_type === 'hydraulic disc' ? 'Гидравлика' : b.specs.brakes_type;
        if (b.specs.color) specs['Цвет'] = b.specs.color;
        if (b.specs.tires) specs['Покрышки'] = b.specs.tires;
      }

      // Legacy specs fallback
      if (Array.isArray(b.specs)) { // If it's an array (legacy)
        b.specs.forEach((s: any) => {
          specs[String(s.spec_label || s.label || '')] = s.spec_value || s.value || '';
        });
      }

      const prod: Product = {
        id: String(b.meta?.id || b.id),
        sku: String(b.meta?.source_ad_id || b.sku || b.id || ''),
        brand: b.basic_info?.brand || b.brand || 'Unknown',
        model: b.basic_info?.model || b.model || '',
        title: b.basic_info?.name || b.name || `${b.basic_info?.brand || b.brand || ''} ${b.basic_info?.model || b.model || ''}`.trim(),
        rating: Number(b.seller?.rating || b.rating || 0),
        reviewsCount: Number(b.reviews || b.review_count || 0),
        price: Number(b.pricing?.price || b.price || 0),
        discountPrice: (b.pricing?.original_price || b.original_price) > (b.pricing?.price || b.price) ? Number(b.pricing?.price || b.price) : undefined,
        originalPrice: b.pricing?.original_price || b.original_price ? Number(b.pricing?.original_price || b.original_price) : undefined,
        watchersCount: Number(b.ranking?.views || b.favorites_count || 0),
        priceRUB: Number(b.pricing?.price || b.price || 0) * (RATES.eur_to_rub || 105),
        images,
        description: b.basic_info?.description || b.description || '',
        characteristics: specs,
        sellerName: (function () {
          const raw = b.seller?.name || b.seller_name;
          if (!raw || String(raw).toLowerCase().includes('unknown') || String(raw).toLowerCase().includes('private') || String(raw).toLowerCase() === 'privat') {
            return 'Частный продавец';
          }
          return raw;
        })(),
        sellerType: b.seller?.type || b.seller_type,
        sellerMemberSince: b.seller?.member_since || b.seller_member_since,
        sellerBadges: b.seller?.badges || [],
        location: b.seller?.location || b.location || b.city,
        frameSize: String(b.specs?.frame_size || b.size || specs['Размер рамы'] || '').trim(),
        wheelDiameter: String(b.specs?.wheel_size || b.wheel_diameter || specs['Колеса'] || '').trim(),
        condition: (function () {
          // 1. Try explicit Russian status if mapped
          const status = b.condition?.status || b.condition_status;
          if (status && ['Идеальное', 'Хорошее', 'Среднее', 'Новое'].includes(status)) return status;

          // 2. Map from grade/raw status
          const grade = String(b.condition?.grade || b.condition_grade || b.initial_quality_class || '').toLowerCase();

          if (grade === 'a' || grade === 'perfect' || grade === 'new' || grade === 'neu' || grade.includes('excellent')) return 'Идеальное';
          if (grade === 'b' || grade === 'very_good' || grade === 'very good' || grade === 'sehr gut' || grade.includes('a/b')) return 'Хорошее';
          if (grade === 'c' || grade === 'good' || grade === 'gut' || grade === 'ok') return 'Среднее';

          return status || 'Б/у';
        })(),
        isReserviert: !!(b.meta?.is_reserviert || b.is_reserviert),
        is_hot: !!(b.ranking?.is_hot_offer || b.is_hot),
        ranking_score: Number(b.ranking?.ranking_score || b.ranking_score || 0),
        savings: Number(b.pricing?.savings || b.savings || 0),
        initial_quality_class: (function () {
          const g = String(b.condition?.grade || b.initial_quality_class || b.condition_grade || 'B').toLowerCase();
          if (g === 'a' || g.includes('perfect') || g.includes('new') || g.includes('excellent')) return 'A';
          if (g === 'b' || g.includes('very') || g.includes('sehr') || g.includes('a/b')) return 'B';
          if (g === 'c' || g.includes('ok') || g.includes('fair') || g === 'good' || g === 'gut') return 'C';
          if (g.includes('good')) return 'B'; // Catch-all for "good condition" if not strict "good"
          return 'B';
        })(),
        final_quality_class: b.condition?.grade || b.final_quality_class || 'B',
        market_price: b.pricing?.fmv ? Number(b.pricing.fmv) : undefined,
        technicalSummary: b.condition?.reason || b.condition?.rationale || b.condition_rationale || b.technical_summary || undefined,
        condition_reason: b.condition?.reason || b.condition?.rationale || b.condition_rationale || b.condition_reason,
        technical_score: b.condition?.score ? Number(b.condition.score) : undefined,
        condition_class: (function () {
          const g = String(b.condition?.grade || b.condition_class || b.condition_grade || 'B').toLowerCase();
          if (g === 'a' || g.includes('perfect') || g.includes('new') || g.includes('excellent')) return 'A';
          if (g === 'b' || g.includes('very') || g.includes('good')) return 'B';
          if (g === 'c' || g.includes('ok') || g.includes('fair')) return 'C';
          return 'B';
        })(),
        components_json: b.features?.raw_specs || b.components_json,
        ai_specs: b.ai_specs,
        description_ru: b.description_ru,
        external_link: b.meta?.source_url || b.url,
        triad_id: b.triad_id,
        shipping_option: b.logistics?.delivery_option || b.shipping_option,
        guaranteed_pickup: !!(b.logistics?.is_pickup_available || b.guaranteed_pickup),

        // Seller extended
        sellerRating: b.seller?.rating ?? null,
        sellerVerified: !!b.seller?.verified,
        sellerLastActive: b.seller?.last_active || b.seller_last_active,
        sellerLocation: b.seller?.location || b.location,
        sellerCountry: b.logistics?.country || b.country || 'Germany',

        // Condition extended
        visualRating: b.condition?.visual_rating ?? b.visual_rating,
        functionalRating: b.condition?.functional_rating ?? b.functional_rating,
        wearIndicators: b.condition?.wear_indicators,
        conditionIssues: b.condition?.issues || [],

        // Specs extended
        suspensionType: b.specs?.suspension_type || b.suspension_type,
        travelFront: b.specs?.travel_front ?? b.travel_front,
        travelRear: b.specs?.travel_rear ?? b.travel_rear,
        shock: b.specs?.shock || b.shock,
        drivetrain: b.specs?.drivetrain || b.drivetrain,
        brakesType: b.specs?.brakes_type || b.brakes_type,
        tires: b.specs?.tires || b.tires,
        color: b.specs?.color || b.color,
        year: b.basic_info?.year || b.year,

        // Features
        highlights: b.features?.highlights || [],
        upgrades: b.features?.upgrades || [],
      };
      setProduct(prod);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки товара');
      console.warn('Failed to load product', e);
      const fallback = catalog.find((p) => String(p.id) === String(id));
      if (fallback) setProduct(fallback);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return { product, error, mutate: load };
}

function QualityBlock({ product }: { product: Product }) {
  const [open, setOpen] = React.useState(false);

  if (!product?.initial_quality_class) {
    return (
      <div className="mb-8 p-4 rounded-2xl bg-gray-50/50 border border-gray-100 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-gray-200" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
        <div className="h-4 w-full bg-gray-200 rounded opacity-50" />
      </div>
    );
  }

  // Use AI fields if available, otherwise fallback
  const cls = product.condition_class || product.initial_quality_class || 'B';
  const rawScore = product.technical_score || product.condition_score;
  const score = rawScore || (cls === 'A' ? 95 : cls === 'B' ? 78 : 50);
  const normalizedScore = score <= 10 ? score * 10 : score;

  const reason = product.condition_reason || product.technicalSummary;
  const components = product.components_json ? (typeof product.components_json === 'string' ? JSON.parse(product.components_json) : product.components_json) : [];

  // Extended condition data
  const visualRating = product.visualRating;
  const functionalRating = product.functionalRating;
  const wearIndicators = product.wearIndicators || {};
  const conditionIssues = product.conditionIssues || [];

  // Translate wear indicator keys
  const wearKeyMap: Record<string, string> = {
    'frame': 'Рама',
    'drivetrain': 'Трансмиссия',
    'brakes': 'Тормоза',
    'tires': 'Покрышки',
    'suspension': 'Подвеска',
    'wheels': 'Колёса'
  };

  // Colors
  const colorMap: Record<string, string> = {
    'A': 'text-emerald-600',
    'B': 'text-blue-600',
    'C': 'text-red-600'
  };
  const bgMap: Record<string, string> = {
    'A': 'bg-emerald-50',
    'B': 'bg-blue-50',
    'C': 'bg-red-50'
  };
  const strokeMap: Record<string, string> = {
    'A': '#059669', // emerald-600
    'B': '#2563eb', // blue-600
    'C': '#dc2626'  // red-600
  };

  const accentColor = colorMap[cls] || 'text-gray-600';
  const bgColor = bgMap[cls] || 'bg-gray-50';
  const strokeColor = strokeMap[cls] || '#4b5563';

  const statusTextMap: Record<string, string> = {
    'A': 'Идеальное',
    'B': 'Хорошее',
    'C': 'Среднее',
    'Идеальное': 'Идеальное',
    'Хорошее': 'Хорошее',
    'Среднее': 'Среднее',
    'Б/у': 'Б/у',
    'Новый': 'Новое'
  };
  const statusText = statusTextMap[cls] || cls || 'Не определено';

  // Circle config
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = (normalizedScore / 100) * circumference;

  // Map full words back to letters for the circle if needed
  let displayGrade = cls;
  if (cls === 'Идеальное') displayGrade = 'A';
  if (cls === 'Хорошее') displayGrade = 'B';
  if (cls === 'Среднее') displayGrade = 'C';
  if (cls === 'Новый') displayGrade = 'A+';
  if (cls.length > 2 && !['A', 'B', 'C'].includes(cls)) displayGrade = cls.charAt(0).toUpperCase();

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="mb-6 group cursor-pointer transition-all hover:bg-gray-50 rounded-2xl p-3 border border-transparent hover:border-gray-100 w-full break-words"
      >
        {/* Header Row */}
        <div className="flex items-start gap-3">
          {/* Circular Indicator */}
          <div className="relative w-12 h-12 shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r={radius}
                stroke="#e5e7eb"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="24"
                cy="24"
                r={radius}
                stroke={strokeColor}
                strokeWidth="3"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                strokeLinecap="round"
              />
            </svg>
            <div className={cn("absolute inset-0 flex items-center justify-center font-bold text-lg", accentColor)}>
              {displayGrade}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1 min-w-0">
              <div className="font-bold text-sm sm:text-base text-gray-900 leading-snug break-words min-w-0">
                Техническое состояние: {statusText}
              </div>
              <HelpCircle className="w-4 h-4 text-gray-400 opacity-50 shrink-0 mt-0.5" />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Класс {displayGrade} • Рейтинг {normalizedScore}/100
            </div>
          </div>
        </div>

        {/* Justification Text - only show if we have real AI text */}
        <div className="mt-2 pl-0 sm:pl-[3.75rem]">
          {reason ? (
            <p className="text-gray-500 italic leading-relaxed text-xs font-light break-words whitespace-normal">
              "{reason}"
            </p>
          ) : (
            <p className="text-gray-400 text-xs">
              Оценка на основе данных объявления
            </p>
          )}

          {/* Visual & Functional Ratings */}
          {(visualRating || functionalRating) && (
            <div className="mt-3 flex gap-4">
              {visualRating && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Внешний вид:</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div key={s} className={cn(
                        "w-2 h-2 rounded-full",
                        s <= visualRating ? "bg-blue-400" : "bg-gray-200"
                      )} />
                    ))}
                  </div>
                </div>
              )}
              {functionalRating && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Функционал:</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div key={s} className={cn(
                        "w-2 h-2 rounded-full",
                        s <= functionalRating ? "bg-emerald-400" : "bg-gray-200"
                      )} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Condition Issues */}
          {conditionIssues.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {conditionIssues.slice(0, 3).map((issue: string, i: number) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                  {issue.length > 40 ? issue.slice(0, 40) + '...' : issue}
                </span>
              ))}
            </div>
          )}

          {components && components.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {components.map((comp: string, i: number) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                  ✨ {comp}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <div className="space-y-4 relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-0 top-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="h-6 w-6 text-gray-400" />
            </button>
            <div className="flex items-center gap-4">
              <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold", bgColor, accentColor)}>
                {cls}
              </div>
              <div>
                <DialogTitle className="text-xl">Класс качества {cls}</DialogTitle>
                <DialogDescription>
                  {statusText} состояние • {normalizedScore}/100
                </DialogDescription>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {/* AI Verdict */}
              <div className="p-4 bg-gray-50 rounded-2xl text-sm leading-relaxed text-gray-700">
                <span className="font-semibold text-gray-900 block mb-1">Вердикт нейросети (Gemini Vision):</span>
                {reason ? (
                  <span className="break-words whitespace-normal">"{reason}"</span>
                ) : (
                  <span className="text-gray-500 italic">Детальная оценка недоступна. Класс определен на основе данных объявления.</span>
                )}

                {/* Visual & Functional Ratings in Dialog */}
                {(visualRating || functionalRating) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex gap-6">
                    {visualRating && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Внешний вид</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={cn(
                              "w-4 h-4",
                              s <= visualRating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"
                            )} />
                          ))}
                          <span className="ml-1 text-sm font-medium">{visualRating}/5</span>
                        </div>
                      </div>
                    )}
                    {functionalRating && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Функциональность</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={cn(
                              "w-4 h-4",
                              s <= functionalRating ? "text-emerald-400 fill-emerald-400" : "text-gray-200"
                            )} />
                          ))}
                          <span className="ml-1 text-sm font-medium">{functionalRating}/5</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {components && components.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <span className="font-semibold text-gray-900 block mb-2 text-xs uppercase tracking-wider">Интересные компоненты:</span>
                    <ul className="space-y-1">
                      {components.map((comp: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {comp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Wear Indicators */}
              {Object.keys(wearIndicators).length > 0 && (
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                  <span className="font-semibold text-blue-900 block mb-3 text-xs uppercase tracking-wider">Состояние компонентов</span>
                  <div className="space-y-2">
                    {Object.entries(wearIndicators).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium text-blue-800">{wearKeyMap[key] || key}:</span>
                        <span className="text-blue-700 ml-1">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Condition Issues */}
              {conditionIssues.length > 0 && (
                <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100">
                  <span className="font-semibold text-red-900 block mb-2 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Выявленные проблемы
                  </span>
                  <ul className="space-y-1">
                    {conditionIssues.map((issue: string, i: number) => (
                      <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border rounded-2xl p-4 max-h-[240px] overflow-y-auto bg-white shadow-inner">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 bg-white pb-2 border-b z-10">
                  AI Check-list (21 пункт)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    "Геометрия рамы", "Лакокрасочное покрытие", "Сварные швы / Карбон", "Рулевой стакан",
                    "Вилка (ноги/штаны)", "Задний амортизатор", "Люфты подвески",
                    "Трансмиссия (износ)", "Цепь (растяжение)", "Кассета (зубья)", "Переключатели",
                    "Тормозные ручки", "Калиперы", "Роторы", "Гидролинии",
                    "Обода (биения)", "Спицы", "Втулки", "Покрышки",
                    "Седло/Подседел", "Кокпит (Руль/Вынос)"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button className="w-full h-12 rounded-full" onClick={() => setOpen(false)}>
              Понятно
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AdditionalServicesDialog({ open, onOpenChange, priceRub }: { open: boolean; onOpenChange: (open: boolean) => void; priceRub: number }) {
  const customsPrice = Math.round(priceRub * 0.04);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-3xl p-0 overflow-hidden bg-white max-h-[90vh] overflow-y-auto">
        <div className="bg-white p-5 border-b border-gray-100 relative">
          <DialogTitle className="text-3xl font-bold mb-2 pr-8">Дополнительные услуги</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground leading-relaxed">
            Услуги можно будет добавить <b>при оформлении заказа</b>.
          </DialogDescription>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-6 text-foreground">

          {/* Section: Included Free */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">
                <CheckCircle className="w-4 h-4" />
              </span>
              Включено в стоимость (Бесплатно)
            </h3>
            <ul className="space-y-2 pl-2">
              <li className="flex items-center gap-3 text-sm text-gray-700">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>Удаление инвойсов</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-700">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>Фото со склада</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-700">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>Заполнение таможенной декларации</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-700">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>Ускоренная доставка по Германии</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-700">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>Страховка при доставке по Германии</span>
              </li>
            </ul>
          </section>

          <div className="h-px bg-gray-100 w-full" />

          {/* Section: Paid Services Article */}
          <section className="space-y-6">
            <h3 className="text-2xl font-bold">Платные опции</h3>

            {/* 1. Personal Inspection */}
            <article className="space-y-1">
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-bold">1. Личная проверка экспертом</h4>
                <span className="text-lg font-bold whitespace-nowrap">80 €</span>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                Байк сначала будет доставлен нашему эксперту — он его разберет, детально изучит, зафиксирует все недостатки, если таковые есть, проверит комплектность и создаст интерактивную карту лично вашего велосипеда.
              </p>
              <div className="mt-2">
                <a href="#" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                  <FileText className="w-4 h-4" />
                  Пример полного отчета - Фото
                </a>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-4 border-l-2 border-gray-100 mt-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Увеличит сроки доставки на 2-3 дня</span>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="w-3.5 h-3.5" />
                  <span>Включает видеозвонок до 10 мин</span>
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Включает до 10 доп. фото</span>
                </div>
              </div>
            </article>

            {/* 2. Extra Packaging */}
            <article className="space-y-1">
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-bold">2. Дополнительная упаковка</h4>
                <span className="text-lg font-bold whitespace-nowrap">10 €</span>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                Дополнительно улучшим стандартную упаковку: набьем коробку мягкими амортизирующими материалами, проложим уязвимые места или обмотаем защитной пленкой для максимальной сохранности в пути.
              </p>
            </article>

            {/* 3. Video Call */}
            <article className="space-y-1">
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-bold">3. Видеозвонок с демонстрацией</h4>
                <span className="text-lg font-bold whitespace-nowrap">10 €</span>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                При отправке через склад имеется возможность созвониться с работником по видеосвязи и вживую увидеть содержимое коробки перед финальной отправкой.
              </p>
              <p className="text-xs text-emerald-600 font-medium">
                * При оформлении услуги «Личная проверка» — входит в стоимость (докупать не нужно).
              </p>
            </article>

            {/* 4. Extra Photos */}
            <article className="space-y-1">
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-bold">4. Дополнительные фотографии</h4>
                <span className="text-lg font-bold whitespace-nowrap">+2 € / шт</span>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                При отправке через склад работник может сделать любые дополнительные фотографии по вашему запросу.
              </p>
              <p className="text-xs text-muted-foreground">
                (1 обзорное фото на складе всегда входит в любой заказ бесплатно).
              </p>
            </article>

            {/* 5. Detailed Check */}
            <article className="space-y-1">
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-bold">5. Детальная проверка (Склад)</h4>
                <span className="text-lg font-bold whitespace-nowrap">10 €</span>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                Полное раскрытие содержимого коробки на складе, подробные фотографии всего содержимого (комплектации) и обратная тщательная упаковка.
              </p>
            </article>

            {/* 6. Extra Insurance */}
            <article className="space-y-1">
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-bold">6. Дополнительное страхование</h4>
                <span className="text-lg font-bold whitespace-nowrap">8% от цены</span>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                Расширенная страховка груза на полную стоимость велосипеда на всём пути следования. Покрывает риски повреждения или утраты.
              </p>
            </article>

            {/* 7. Customs Guarantee */}
            <article className="space-y-1">
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-bold">7. Таможенная гарантия</h4>
                <span className="text-lg font-bold whitespace-nowrap">4% (~{customsPrice.toLocaleString()} ₽)</span>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                Мы гарантируем возврат 100% сервисного сбора в случае задержек на таможне. Включает приоритетную поддержку менеджера 24/7 на этапе прохождения границы.
              </p>
            </article>

            <div className="rounded-xl bg-gray-50 p-4 text-sm text-muted-foreground">
              Часть услуг предоставляется складским сервисом (партнером), и на их стоимость мы повлиять не можем. Цены указаны справочно и могут быть уточнены при оформлении.
            </div>
          </section>

        </div>
        <div className="p-4 border-t border-gray-100 bg-white">
          <Button className="w-full h-12 rounded-full font-bold text-base bg-black hover:bg-black/90 text-white" onClick={() => onOpenChange(false)}>
            Понятно
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductDetailPage() {
  const { product, mutate } = useProductFromPath();
  const [bestPrice, setBestPrice] = React.useState(false);
  const [isHotLoading, setIsHotLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [direction, setDirection] = React.useState(0);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    if (!product?.images) return;
    setActiveIndex((prev) => (prev + newDirection + product.images.length) % product.images.length);
  };

  const setIndex = (index: number) => {
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  };
  const { openCart, showNotification } = useCartUI();
  const [addedToCart, setAddedToCart] = React.useState(false);
  const [ctaRipple, setCtaRipple] = React.useState(false);
  const [orderOverlayOpen, setOrderOverlayOpen] = React.useState(false);
  const [orderDetailsOpen, setOrderDetailsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const galleryRef = React.useRef<HTMLDivElement>(null);
  const leftParentRef = React.useRef<HTMLDivElement>(null);
  const rightParentRef = React.useRef<HTMLDivElement>(null);
  const rightEndRef = React.useRef<HTMLDivElement>(null);
  const suggestedRef = React.useRef<HTMLDivElement>(null);
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const [offerOpen, setOfferOpen] = React.useState(false);
  const [messageOpen, setMessageOpen] = React.useState(false);
  const [contactMessage, setContactMessage] = React.useState('');
  const [contactMethod, setContactMethod] = React.useState('');
  const [protectionOpen, setProtectionOpen] = React.useState(false);
  const [lessInfoOpen, setLessInfoOpen] = React.useState(false);
  const [autoInfoOpen, setAutoInfoOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [servicesOpen, setServicesOpen] = React.useState(false);
  const ctaRef = React.useRef<HTMLDivElement>(null);
  const deliveryRef = React.useRef<HTMLDivElement>(null);
  const [isDesktopInitial, setIsDesktopInitial] = React.useState<boolean>(false);
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [descExpanded, setDescExpanded] = React.useState(false);
  const [translatedDescription, setTranslatedDescription] = React.useState<string | null>(null);
  const [translating, setTranslating] = React.useState(false);
  const [reportText, setReportText] = React.useState<string>('');
  const [waitlistOpen, setWaitlistOpen] = React.useState(false);

  const [localLotOpen, setLocalLotOpen] = React.useState(false);
  const [directMessageRestrictedOpen, setDirectMessageRestrictedOpen] = React.useState(false);

  const openBuyoutConditions = React.useCallback(() => {
    if (!product?.id) return;
    window.location.href = `/booking-checkout/${product.id}`;
  }, [product?.id]);


  function GuaranteeDialog({
    open,
    onOpenChange,
    type
  }: {
    open: boolean,
    onOpenChange: (v: boolean) => void,
    type: 'protection' | 'check' | 'secure' | 'insurance' | null
  }) {
    if (!type) return null;

    const content = {
      protection: {
        title: "Защита покупателя",
        icon: <ShieldCheck className="h-6 w-6 text-emerald-600" />,
        color: "bg-gray-50 text-emerald-600",
        description: "Мы гарантируем безопасность вашей покупки на всех этапах.",
        details: [
          "Полный возврат средств, если товар не соответствует описанию",
          "Заморозка оплаты до подтверждения получения (Safe Deal)",
          "Арбитраж споров с продавцом (PayPal / BikeWerk)",
          "Строгая фильтрация: отсеиваем 38% небезопасных предложений"
        ],
        btnText: "Подробнее про защиту покупателя",
        link: "/buyer-protection"
      },
      check: {
        title: "Проверка байка (21 пункт)",
        icon: <CheckCircle className="h-6 w-6 text-blue-600" />,
        color: "bg-gray-50 text-blue-600",
        description: "Каждый велосипед проходит обязательную проверку по стандарту Euphoria.",
        details: [
          "Рама: Трещины, вмятины, геометрия",
          "Вилка: Люфт, работа демпфера, покрытие ног",
          "Рулевая: Плавность, люфт",
          "Вынос: Момент затяжки, трещины",
          "Руль: Геометрия, следы падений",
          "Грипсы: Износ, фиксация",
          "Манетки: Четкость переключения",
          "Тормозные ручки: Ход, утечки",
          "Тормоза: Работа поршней, колодки",
          "Роторы: Износ, биение",
          "Каретка: Люфт, плавность",
          "Система: Резьбы, износ звезд",
          "Педали: Люфт, вращение",
          "Цепь: Растяжение (калибр)",
          "Кассета: Износ зубьев",
          "Передний переключатель: Настройка",
          "Задний переключатель: Люфт лапки, ролики",
          "Обода: Биение, вмятины",
          "Втулки: Накат, люфт",
          "Покрышки: Износ, порезы, давление",
          "Подседельный штырь: Работа, люфт"
        ],
        extraText: "Доступна ли углубленная личная проверка? Да. Мы можем запросить видео-звонок с экспертом.",
        btnText: "Подробнее про проверку",
        link: "/bike-inspection"
      },
      secure: {
        title: "Безопасная сделка",
        icon: <Lock className="h-6 w-6 text-purple-600" />,
        color: "bg-gray-50 text-purple-600",
        description: "Ваши деньги защищены системой эскроу.",
        details: [
          "Деньги хранятся на транзитном счете",
          "Продавец получает оплату только после отправки",
          "Безопасные платежные шлюзы"
        ],
        btnText: "Подробнее про оплату",
        link: "/secure-payment"
      },
      insurance: {
        title: "Страховка груза",
        icon: <Truck className="h-6 w-6 text-blue-600" />,
        color: "bg-gray-50 text-blue-600",
        description: "Полная страховка на время транспортировки.",
        details: [
          "Страхование на полную стоимость байка",
          "Ответственность за повреждения в пути",
          "Отслеживание груза 24/7"
        ],
        btnText: "Подробнее про страховку",
        link: "/shipping-insurance"
      }
    }[type];

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <div className="space-y-4 relative">
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-0 top-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="h-6 w-6 text-gray-400" />
            </button>
            <div className="flex items-center gap-4">
              <div className={cn("h-12 w-12 rounded-full flex items-center justify-center", content.color)}>
                {content.icon}
              </div>
              <div>
                <DialogTitle className="text-xl">{content.title}</DialogTitle>
                <DialogDescription className="mt-1">{content.description}</DialogDescription>
              </div>
            </div>

            <div className={cn("p-4 bg-muted/30 rounded-2xl", type === 'check' ? "grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 max-h-[60vh] overflow-y-auto" : "space-y-2")}>
              {content.details.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {content.extraText && (
              <div className="text-sm font-medium text-foreground px-1">
                {content.extraText}
              </div>
            )}

            <Button
              className="w-full rounded-full"
              variant="outline"
              onClick={() => window.open(content.link, '_blank')}
            >
              {content.btnText}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const [guaranteeType, setGuaranteeType] = React.useState<'protection' | 'check' | 'secure' | 'insurance' | null>(null);

  // Admin editing state
  const [edits, setEdits] = React.useState<Record<string, any>>({});
  const handleEditChange = (field: string, value: any) => {
    setEdits(prev => ({ ...prev, [field]: value }));
  };

  const saveChanges = async () => {
    if (!product?.id) return;
    try {
      const currentCharacteristics = { ...product.characteristics };
      const payload: any = {};
      const specEdits: Record<string, any> = {};

      Object.entries(edits).forEach(([key, value]) => {
        if (key.startsWith('spec_')) {
          const specName = key.replace('spec_', '');
          specEdits[specName] = value;
          currentCharacteristics[specName] = value;
        } else {
          payload[key] = value;
        }
      });

      if (Object.keys(specEdits).length > 0) {
        payload.specs = Object.entries(currentCharacteristics).map(([label, value]) => ({ label, value }));
      }

      await apiPut(`/admin/bikes/${product.id}`, payload);
      setEdits({});
      await mutate();
    } catch (e) {
      console.error('Failed to save bike', e);
    }
  };

  const AdminEditable = ({
    field,
    value,
    className,
    renderDisplay,
    multiline = false
  }: {
    field: string,
    value: any,
    className?: string,
    renderDisplay?: (val: any) => React.ReactNode,
    multiline?: boolean
  }) => {
    const isEditing = field in edits;
    const currentValue = isEditing ? edits[field] : value;

    if (user?.role !== 'admin') {
      return renderDisplay ? <>{renderDisplay(value)}</> : <span className={className}>{value}</span>;
    }

    if (isEditing) {
      return (
        <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
          {multiline ? (
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={currentValue}
              onChange={(e) => handleEditChange(field, e.target.value)}
            />
          ) : (
            <Input
              value={currentValue}
              onChange={(e) => handleEditChange(field, e.target.value)}
              className="h-8 min-w-[100px]"
            />
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 shrink-0" onClick={(e) => {
            e.stopPropagation();
            const newEdits = { ...edits };
            delete newEdits[field];
            setEdits(newEdits);
          }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div className={cn("group relative flex items-center gap-2", className)} onClick={(e) => e.stopPropagation()}>
        {renderDisplay ? renderDisplay(value) : <span className={className}>{value}</span>}
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded-full text-muted-foreground shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleEditChange(field, value);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };



  const toggleHot = async () => {
    if (!product?.id) return;
    try {
      setIsHotLoading(true);
      await apiPost(`/admin/bikes/${product.id}/toggle-hot`, { hot: !product.is_hot });
      if (product) product.is_hot = !product.is_hot;
      await mutate();
    } catch (e) {
      console.error('Failed to toggle hot status', e);
    } finally {
      setIsHotLoading(false);
    }
  };

  const favKey = 'guestFavorites';

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);
  const [lightboxDirection, setLightboxDirection] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);

  const paginateLightbox = (newDirection: number) => {
    setLightboxDirection(newDirection);
    if (!product?.images) return;
    setLightboxIndex((prev) => (prev + newDirection + product.images.length) % product.images.length);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const panStart = React.useRef<{ x: number; y: number } | null>(null);
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);
  const thumbsRef = React.useRef<HTMLDivElement>(null);
  const GALLERY_WIDTH = 736;
  const GALLERY_HEIGHT = 550;
  const THUMBS_HEIGHT_DEFAULT = 64;
  const [adaptiveWidth, setAdaptiveWidth] = React.useState<number>(GALLERY_WIDTH);
  const [adaptiveHeight, setAdaptiveHeight] = React.useState<number>(GALLERY_HEIGHT);
  const TARGET_WIDTH = GALLERY_WIDTH;
  const TARGET_HEIGHT = GALLERY_HEIGHT;
  const pinchRef = React.useRef<number | null>(null);

  const [eurRate, setEurRate] = React.useState<number>(RATES.eur_to_rub);
  React.useEffect(() => { (async () => { const v = await refreshRates(); setEurRate(v); })(); }, []);

  // Delivery state
  const [deliveryMethod, setDeliveryMethod] = React.useState<'standard' | 'fast' | 'premium'>('standard');
  const [premiumSubType, setPremiumSubType] = React.useState<'group' | 'individual'>('group');
  const [deliveryProtection, setDeliveryProtection] = React.useState<'basic' | 'protected'>('basic');
  const [compareOpen, setCompareOpen] = React.useState(false);

  // Calculate final shipping option for pricing.ts
  const finalShippingOption = React.useMemo(() => {
    if (deliveryMethod === 'premium') {
      return premiumSubType === 'individual' ? 'Premium' : 'PremiumGroup';
    }
    if (deliveryMethod === 'fast') {
      return deliveryProtection === 'protected' ? 'EMSProtected' : 'EMS';
    }
    return deliveryProtection === 'protected' ? 'CargoProtected' : 'Cargo';
  }, [deliveryMethod, premiumSubType, deliveryProtection]);

  // Calculate insurance flag
  const insuranceIncluded = React.useMemo(() => {
    // If protected, insurance is included (4%)
    if (deliveryProtection === 'protected') return true;
    // Premium always has it
    if (deliveryMethod === 'premium') return true;
    // Fast always has basic insurance included (4%) even if not "Customs Protected"
    if (deliveryMethod === 'fast') return true;
    return false;
  }, [deliveryMethod, deliveryProtection]);

  const DELIVERY_OPTIONS = {
    Cargo: {
      id: 'Cargo',
      title: 'Карго',
      price: 170,
      days: '20-24 дня',
      features: ['Технический отчет', 'Страховка груза', 'Отчет о байке', 'Фотоотчет', 'Таможенная поддержка'],
      dutyIncluded: false
    },
    CargoProtected: {
      id: 'CargoProtected',
      title: 'Карго (С защитой)',
      price: 250,
      days: '20-24 дня',
      features: ['Технический отчет', 'Страховка груза', 'Гарантия таможни', 'Фиксированная цена'],
      dutyIncluded: true
    },
    EMS: {
      id: 'EMS',
      title: 'Курьером',
      price: 220,
      days: '14-18 дней',
      features: ['Технический отчет', 'Страховка груза', 'Отчет о байке', 'Фотоотчет', 'Таможенная поддержка', 'Доставка до двери'],
      dutyIncluded: false
    },
    Premium: {
      id: 'Premium',
      title: 'Премиум',
      price: 650,
      days: '22-24 дня',
      features: ['Технический отчет', 'Страховка груза', 'Отчет о байке', 'Фотоотчет', 'Гарантия таможни', 'Пошлина включена', 'Обрешетка'],
      dutyIncluded: true
    },
    PremiumGroup: {
      id: 'PremiumGroup',
      title: 'Премиум (Сборный)',
      price: 450,
      days: '25-30 дней',
      features: ['Технический отчет', 'Страховка груза', 'Гарантия таможни', 'Пошлина включена', 'Экономия 200€'],
      dutyIncluded: true
    }
  };

  // NEW PRICING: Simplified to EMS default, no cargo insurance
  const calc = React.useMemo(() => {
    const price = product?.discountPrice ?? product?.price ?? 0;
    return calculatePriceBreakdown(price, 'EMS', false); // EMS €220, no cargo insurance
  }, [product]);

  React.useEffect(() => {
    setIsDesktopInitial(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = Number(product?.id);
        if (!id) return;
        if (user?.id) {
          const res = await apiGet(`/favorites/check/${id}`);
          if (!cancelled && typeof res?.isInFavorites === 'boolean') setIsFavorite(Boolean(res.isInFavorites));
        } else {
          try {
            const arr = JSON.parse(localStorage.getItem(favKey) || '[]');
            if (!cancelled) setIsFavorite(Array.isArray(arr) && arr.map((x: unknown) => Number(x as number)).includes(id));
          } catch { void 0 }
        }
      } catch { void 0 }
    })();
    return () => { cancelled = true };
  }, [user, product?.id]);

  const toggleFavorite = async () => {
    const id = Number(product?.id);
    if (!id) return;
    const next = !isFavorite;
    setIsFavorite(next);
    if (user?.id) {
      try { await apiPost('/favorites/toggle', { bikeId: id }); } catch { void 0 }
    } else {
      try {
        const arr = JSON.parse(localStorage.getItem(favKey) || '[]');
        const uniq = Array.from(new Set(Array.isArray(arr) ? arr.map((x: unknown) => Number(x as number)) : []));
        const nextArr = next ? (uniq.includes(id) ? uniq : [id, ...uniq]) : uniq.filter((x) => x !== id);
        localStorage.setItem(favKey, JSON.stringify(nextArr));
      } catch { void 0 }
    }
    try { if (next) metricsApi.sendEvents([{ type: 'favorite', bikeId: id }]); } catch { void 0 }
  };

  React.useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        paginateLightbox(-1);
      } else if (e.key === 'ArrowRight') {
        paginateLightbox(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [lightboxOpen, product?.images.length]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!product?.id) return;
        if (!(user?.role === 'admin' || user?.role === 'manager')) {
          if (!cancelled) setBestPrice(false);
          return;
        }
        const r = await adminApi.getEvaluation(Number(product.id));
        const score = r?.evaluation?.price_value_score ?? null;
        if (!cancelled) setBestPrice(Number(score) === 10);
      } catch (err) { console.warn('getEvaluation failed', err); }
    })();
    return () => { cancelled = true };
  }, [product?.id, user?.role]);



  const computeSizes = React.useCallback(() => {
    const left = leftParentRef.current;
    if (!left) return;
    const leftRect = left.getBoundingClientRect();
    const w = Math.min(TARGET_WIDTH, Math.max(320, Math.round(leftRect.width)));
    const hCandidate = (window.innerWidth >= 1024)
      ? TARGET_HEIGHT
      : Math.min(600, Math.max(300, Math.round(window.innerHeight * 0.5)));
    const h = Math.min(hCandidate, w);
    setAdaptiveWidth(w);
    setAdaptiveHeight(h);
  }, [TARGET_HEIGHT, TARGET_WIDTH]);

  React.useEffect(() => {
    const handler = () => computeSizes();
    handler();
    const raf = requestAnimationFrame(handler);
    const t = setTimeout(handler, 60);
    if (document.readyState !== 'complete') {
      window.addEventListener('load', handler, { once: true } as AddEventListenerOptions);
    }
    window.addEventListener('resize', computeSizes);
    return () => {
      window.removeEventListener('load', handler);
      window.removeEventListener('resize', computeSizes);
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [computeSizes]);

  React.useEffect(() => {
    if (!product) return;
    computeSizes();
  }, [product, computeSizes]);

  React.useEffect(() => {
    const el = leftParentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => computeSizes());
    ro.observe(el);
    return () => { try { ro.disconnect(); } catch { void 0 } };
  }, [computeSizes]);

  const [views, setViews] = React.useState<number>(0);

  // Tracking: View & Dwell Time
  React.useEffect(() => {
    let cancelled = false;
    const id = product?.id;
    if (!id) return;
    const bikeId = Number(id);

    (async () => {
      try {
        // Send 'view' event (and keep detail_open for backward compatibility if needed, or just use view)
        await metricsApi.sendEvents([{ type: 'view', bikeId }]);
      } catch { void 0 }
      try {
        const m = await adminApi.getMetrics(bikeId);
        const d = m?.metrics || null;
        const count = Number(d?.detail_clicks || d?.impressions || 0);
        if (!cancelled) setViews(count);
      } catch { void 0 }
    })();

    // Dwell time heartbeat (every 10s)
    const dwellInterval = setInterval(() => {
      metricsApi.sendEvents([{ type: 'dwell', bikeId, ms: 10000 }]).catch(() => { });
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(dwellInterval);
    };
  }, [product?.id]);

  // Tracking: Scroll (debounced)
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!product?.id) return;
    const bikeId = Number(product.id);

    const handler = setTimeout(() => {
      metricsApi.sendEvents([{ type: 'scroll', bikeId }]).catch(() => { });
    }, 2000);

    return () => clearTimeout(handler);
  }, [activeIndex, product?.id]);



  const isCyrillic = React.useCallback((s: string) => /[А-Яа-яЁё]/.test(s), []);
  const translateDescription = React.useCallback(async () => {
    try {
      const txt = String(product?.description || '').trim();
      if (!txt) return;
      setTranslating(true);
      const isGerman = (s: string) => /[äöüß]/i.test(s) || /(und|mit|nicht|ein|eine|verkauf|zustand|rahmen|fahrwerk|größe|modell|jahr)/i.test(s);
      const source = isGerman(txt) ? 'de' : 'auto';
      const res = await apiPost('/translate', { q: txt, source, target: 'ru' });
      const t = typeof res?.translatedText === 'string' ? res.translatedText : '';
      setTranslatedDescription(t || txt);
    } finally {
      setTranslating(false);
    }
  }, [product?.description]);


  const totalEurRounded = Math.round(calc.details.finalPriceEur || 0);
  const totalRubRounded = Math.round(calc.totalRub || 0);
  const depositAmount = calc.bookingRub;
  const infoYear = product?.characteristics?.['Год'] ?? (product?.year ?? '—');
  const infoFrame = product?.characteristics?.['Размер рамы'] ?? (product?.frameSize || '—');
  const infoWheel = product?.characteristics?.['Колеса'] ?? (product?.wheelDiameter || '—');
  const currentPrice = product?.discountPrice ?? product?.price ?? 0;
  const oldPriceBase = product?.originalPrice;
  const discountPercent = oldPriceBase && oldPriceBase > currentPrice ? Math.round(100 - (currentPrice / oldPriceBase) * 100) : 0;
  const oldPriceRub = React.useMemo(() => {
    if (!oldPriceBase) return null;
    return Math.round(calculateMarketingBreakdown(oldPriceBase).totalRub);
  }, [oldPriceBase, eurRate]);
  const savingsRub = oldPriceRub && totalRubRounded ? Math.round(oldPriceRub - totalRubRounded) : 0;

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20">
        <h1 className="text-2xl font-semibold">Товар не найден</h1>
        <p className="text-muted-foreground mt-2">Проверьте ссылку или вернитесь в каталог.</p>
        <div className="mt-6">
          <Button variant="outline" onClick={() => (window.location.href = "/catalog")}>Вернуться в каталог</Button>
        </div>
      </div>
    );
  }

  // Logistics Logic (Triad Status)
  let isShippingAvailable: boolean, isGuaranteedPickup: boolean, isLocalLot: boolean;

  if (product.triad_id) {
    const tid = Number(product.triad_id);
    isShippingAvailable = tid === 1;
    isGuaranteedPickup = tid === 2;
    isLocalLot = tid === 3;
  } else {
    isShippingAvailable = !product.shipping_option || product.shipping_option === 'available' || product.shipping_option === 'unknown';
    isGuaranteedPickup = !isShippingAvailable && !!product.guaranteed_pickup;
    isLocalLot = !isShippingAvailable && !isGuaranteedPickup;
  }

  // Generate SEO data
  const seoTitle = product
    ? `${product.brand} ${product.model} ${product.year || ''} - BikeWerk`.trim()
    : 'BikeWerk - Велосипеды из Европы!';

  const seoDescription = product
    ? `${product.brand} ${product.model} ${product.year || ''}, класс ${product.final_quality_class || product.condition_class || 'B'}. Цена ${product.priceRUB ? Math.round(product.priceRUB).toLocaleString('ru-RU') : 'по запросу'}₽. ${product.drivetrain || product.groupset || ''}. Проверка + гарантия. Доставка по России.`
    : 'Купить проверенные б/у велосипеды в Москве. MTB, Road, Gravel от Canyon, Specialized, Trek.';

  return (
    <div className="min-h-screen bg-background font-dm-sans overflow-x-hidden">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        url={`https://bikewerk.ru/product/${product?.id || ''}`}
        type="product"
        image={product?.images?.[0] || product?.main_image || 'https://bikewerk.ru/og-image.jpg'}
        product={product ? {
          name: `${product.brand} ${product.model} ${product.year || ''}`.trim(),
          price: product.priceRUB || 0,
          currency: 'RUB',
          condition: product.final_quality_class || product.condition_class || 'used',
          brand: product.brand,
          image: product.images?.[0] || product.main_image,
          availability: product.isReserviert ? 'OutOfStock' : 'InStock'
        } : undefined}
      />
      <BikeflipHeaderPX />

      {/* Product card layout */}
      <main className="container mx-auto px-4 py-4 md:py-10 overflow-x-hidden">
        {/* H1 для SEO */}
        <h1 className="sr-only">{product ? `${product.brand} ${product.model} ${product.year || ''} - Купить б/у` : 'BikeWerk - Б/у велосипеды'}</h1>
        {/* Breadcrumbs */}
        <nav className="flex items-center text-sm text-muted-foreground mb-4 md:mb-6 overflow-hidden">
          <a href="/" className="hover:text-foreground transition-colors whitespace-nowrap">Главная</a>
          <ChevronRight className="h-4 w-4 mx-2 shrink-0" />
          <a href="/catalog" className="hover:text-foreground transition-colors whitespace-nowrap">Каталог</a>
          <ChevronRight className="h-4 w-4 mx-2 shrink-0" />
          <span className="text-foreground font-medium truncate max-w-[200px] md:max-w-[400px]">{product.title}</span>
        </nav>

        {/* Mobile Back Button - Hidden as breadcrumbs are now visible */}
        <div className="hidden mb-2">
          <button
            onClick={() => window.location.href = '/catalog'}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            Назад к каталогу
          </button>
        </div>

        <div ref={containerRef} className={cn("grid gap-3 md:gap-5", isDesktopInitial ? "grid-cols-12" : "grid-cols-1")}>
          {/* Gallery */}
          <div className={isDesktopInitial ? "col-span-7" : "col-span-1"} ref={leftParentRef}>
            <div ref={galleryRef} data-testid="product-gallery" className={cn(
              "pointer-events-auto",
              "flex flex-col",
              "items-start",
              "select-none"
            )} style={{ position: 'relative' }}>
              <div className="relative group rounded-lg bg-white shadow-sm border overflow-hidden w-full aspect-[16/10] md:aspect-auto" data-testid="product-gallery-card" style={isDesktopInitial ? { width: adaptiveWidth, height: adaptiveHeight } : {}}>
                <div className="absolute inset-0">
                  {product.images.length > 0 ? (
                    <div className="h-full w-full relative overflow-hidden">
                      <AnimatePresence initial={false} custom={direction} mode="popLayout">
                        <motion.img
                          key={activeIndex}
                          src={getFullSizeUrl((product.images[activeIndex] || product.images[0]) || "/placeholder-bike.svg")}
                          alt={`${product.brand} ${product.model} ${product.year || ''} б/у - ${product.title}`.trim()}
                          className="absolute inset-0 h-full w-full object-contain bg-gray-50 md:object-cover rounded-[18px] cursor-zoom-in md:scale-100 scale-[1.15]"
                          custom={direction}
                          variants={{
                            enter: (direction: number) => ({
                              x: direction > 0 ? '100%' : '-100%',
                              opacity: 0,
                              zIndex: 0
                            }),
                            center: {
                              x: 0,
                              opacity: 1,
                              zIndex: 1
                            },
                            exit: (direction: number) => ({
                              x: direction < 0 ? '100%' : '-100%',
                              opacity: 0,
                              zIndex: 0
                            })
                          }}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                          }}
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={1}
                          style={{ touchAction: "pan-y" }}
                          onDragEnd={(e, { offset, velocity }) => {
                            const swipe = Math.abs(offset.x) * velocity.x;

                            if (swipe < -100 || offset.x < -100) {
                              paginate(1);
                            } else if (swipe > 100 || offset.x > 100) {
                              paginate(-1);
                            }
                          }}
                          onClick={() => {
                            setLightboxIndex(activeIndex);
                            setLightboxOpen(true);
                          }}
                        />
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground bg-gray-50 rounded-[18px]">
                      Нет фотографий
                    </div>
                  )}
                  {product?.is_hot && (
                    <div className="absolute top-0 left-0 bg-red-600 text-white text-sm font-bold px-3 py-1 z-10 rounded-br-lg shadow-sm">
                      Горячее предложение!
                    </div>
                  )}
                  {Number(product.savings) > 0 && (
                    <div className="absolute top-0 right-14 bg-red-600 text-white text-sm font-bold px-3 py-1 z-10 rounded-bl-lg rounded-br-lg shadow-sm">
                      СКИДКА
                    </div>
                  )}
                  {user?.role === 'admin' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleHot(); }}
                      disabled={isHotLoading}
                      className={cn(
                        "absolute left-3 top-12 z-20 rounded-full px-3 py-1 text-xs font-bold shadow-sm transition-colors border",
                        product.is_hot ? "bg-red-600 text-white border-red-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                      )}
                    >
                      {isHotLoading ? "..." : (product.is_hot ? "HOT" : "Make Hot")}
                    </button>
                  )}

                  {product?.isReserviert && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
                      <span className="text-white text-2xl font-bold">Зарезервирован</span>
                    </div>
                  )}
                  <button
                    data-testid="favorite-btn"
                    aria-pressed={isFavorite}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
                    className="absolute right-3 top-3 rounded-full bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-background"
                  >
                    <Heart
                      className={cn(
                        "h-5 w-5 transition-colors",
                        isFavorite ? "fill-red-500 text-red-500" : "text-white"
                      )}
                    />
                  </button>
                </div>
                <button
                  aria-label="prev"
                  className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  onClick={() => paginate(-1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  aria-label="next"
                  className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  onClick={() => paginate(1)}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                {/* Клик по большой фотографии уже открывает полноэкранный просмотр */}
              </div>
              <div className="relative group mt-2" style={{ width: adaptiveWidth }}>
                <div
                  ref={thumbsRef}
                  className="flex items-center gap-2 md:gap-3 h-[60px] md:h-[72px] flex-nowrap overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {product.images.map((src, idx) => (
                    <button
                      key={idx}
                      className={cn(
                        "relative h-[56px] w-[18vw] md:h-[76px] md:w-[120px] shrink-0 rounded-lg overflow-hidden",
                        idx === activeIndex ? "ring-2 ring-black" : "ring-0"
                      )}
                      onClick={() => { setIndex(idx); }}
                    >
                      <img src={getThumbnailUrl(src)} alt={`${product.brand} ${product.model} ${product.year || ''} б/у - фото ${idx + 1}`.trim()} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                {/* Навигация списка мини‑фото: видна только на ховере (desktop) */}
                <button
                  aria-label="prev-thumbs"
                  className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  onClick={() => { const el = thumbsRef.current; if (el) el.scrollBy({ left: -200, behavior: 'smooth' }); }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  aria-label="next-thumbs"
                  className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  onClick={() => { const el = thumbsRef.current; if (el) el.scrollBy({ left: 200, behavior: 'smooth' }); }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Sniper Analysis Block - Value Layer */}
            <div className="mt-8">
              <SniperAnalysis product={product} />
            </div>
          </div>

          {/* Info & purchase column */}
          <aside className={isDesktopInitial ? "col-span-5" : "col-span-1"} ref={rightParentRef}>
            <div className="block">
              <div className="mb-2 hidden md:block">
                <button
                  onClick={() => window.history.back()}
                  className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Назад к каталогу
                </button>
              </div>
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="p-4 pb-0">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px] px-2 py-0.5 h-5">Hot Offer</Badge>
                      <CardTitle className="text-xl md:text-2xl font-bold leading-tight tracking-tight mt-1">
                        <AdminEditable field="name" value={product.title} />
                      </CardTitle>
                      <div className="text-xs text-muted-foreground pt-1">
                        {(function () {
                          const size = String(product.frameSize || product.characteristics?.['Размер рамы'] || '').trim();
                          const wheels = String(product.wheelDiameter || product.characteristics?.['Колеса'] || '').trim();
                          const cond = String(product.condition || '').trim();
                          const parts: string[] = [];
                          if (size) parts.push(`Размер ${size}`);
                          if (cond) parts.push(cond);
                          if (wheels) parts.push(`Колёса ${wheels}`);
                          return parts.join(' • ');
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded-full p-2 text-muted-foreground transition hover:text-primary"
                        aria-label="share"
                        onClick={() => navigator.share ? navigator.share({ title: product.title, url: window.location.href }) : void 0}
                      >
                        <Share2 className="h-5 w-5" />
                      </button>
                      <button
                        className="rounded-full p-2 text-muted-foreground transition hover:text-red-500"
                        aria-label="like"
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
                      >
                        <Heart className={cn("h-5 w-5 transition-colors", isFavorite ? "fill-red-500 text-red-500" : "")} />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-3">
                  <div className="space-y-2 relative pb-2">
                    {/* Logistics Status Badges (Triad) */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      {isShippingAvailable && (
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 hover:bg-emerald-100 px-2.5 py-1 h-auto whitespace-normal text-left transition-colors">
                          <PackageCheck className="w-4 h-4 mr-1.5 shrink-0" />
                          Доставка доступна
                        </Badge>
                      )}
                      {isGuaranteedPickup && (
                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Badge className="bg-blue-500/10 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-help px-2.5 py-1 h-auto whitespace-normal text-left transition-colors">
                                <ShieldCheck className="w-4 h-4 mr-1.5 shrink-0" />
                                Гарантированный самовывоз
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-3 bg-slate-900 text-white border-slate-800">
                              <p className="font-bold mb-1 text-sm">Мы заберем этот байк лично</p>
                              <p className="text-xs opacity-90 leading-relaxed">Лот находится в нашей зоне досягаемости (до 100км). Мы приедем, проверим и заберем его.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {isLocalLot && (
                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Badge className="bg-blue-500/10 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-help px-2.5 py-1 h-auto whitespace-normal text-left transition-colors">
                                <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                                <span className="flex flex-col">
                                  <span className="font-bold">Локальный лот</span>
                                  <a href="#faq-section" onClick={(e) => {
                                    e.stopPropagation();
                                    const el = document.getElementById('faq-section');
                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                  }} className="text-[10px] underline opacity-80 hover:opacity-100">
                                    Подробнее...
                                  </a>
                                </span>
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-3 bg-slate-900 text-white border-slate-800">
                              <p className="font-bold mb-1 text-sm">Требуется согласование</p>
                              <p className="text-xs opacity-90 leading-relaxed">Продавец не отправляет байк. Мы попробуем договориться с ним (оплатим коробку и бонус за хлопоты).</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    {/* Hotness Indicator */}
                    {(product.hotness_score || 0) > 1000 && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1 rounded-full border border-red-100 animate-pulse">
                          <Flame className="h-3.5 w-3.5 fill-current" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Высокий спрос</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {Math.round((product.hotness_score || 0) / 100)} чел. смотрят сейчас
                        </span>
                      </div>
                    )}

                    <div className="flex items-end gap-3 relative">
                      <AdminEditable
                        field="price"
                        value={product.price}
                        renderDisplay={() => (
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className={((bestPrice || product.is_hot || discountPercent > 0) ? "text-red-600 " : "text-black ") + "text-3xl md:text-4xl font-bold border-b border-dotted border-gray-300 hover:border-gray-800 transition-colors cursor-help"}>
                                  {Math.round(totalRubRounded).toLocaleString()} ₽
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="bg-black text-white p-3 rounded-xl text-xs z-50">
                                <div className="font-bold mb-1">Расчетный курс евро</div>
                                <div className="opacity-80">Обновлено: Сегодня</div>
                                <div className="opacity-80">1 EUR = {eurRate.toFixed(2)} RUB</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      />
                      {/* Delivery included text */}
                      <div className="absolute -bottom-4 left-0 max-w-full text-[10px] text-muted-foreground font-medium whitespace-normal break-words">
                        Цена включает доставку и сервис
                      </div>
                      <button
                        type="button"
                        aria-expanded={breakdownOpen}
                        onClick={() => setBreakdownOpen(v => !v)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-muted"
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", breakdownOpen ? "rotate-180" : "rotate-0")} />
                      </button>
                      {oldPriceRub && discountPercent > 0 ? (
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <AdminEditable
                              field="original_price"
                              value={product.originalPrice}
                              renderDisplay={() => <div className="text-sm text-muted-foreground line-through opacity-70">{oldPriceRub!.toLocaleString()} ₽</div>}
                            />
                            <Badge className="border bg-red-500/10 text-red-600 border-red-500/20">-{discountPercent}%</Badge>
                          </div>
                          {savingsRub > 0 && (
                            <div className="text-xs font-medium text-red-600">
                              Вы экономите {savingsRub.toLocaleString()} ₽
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {breakdownOpen && (
                    <div className="mt-3 rounded-2xl bg-gray-50/50 p-4 text-sm space-y-2">
                      <div className="flex items-center justify-between"><span>Цена велосипеда</span><span className="font-medium">{currentPrice.toLocaleString()} €</span></div>
                      <div className="flex items-center justify-between"><span>Сервис</span><span className="font-medium">{Math.round(calc.details.serviceFeeEur).toLocaleString()} €</span></div>
                      <div className="flex items-center justify-between"><span>Доставка (EMS)</span><span className="font-medium">{Math.round(calc.details.shippingCostEur).toLocaleString()} €</span></div>
                      <div className="flex items-center justify-between"><span>Платежные сборы</span><span className="font-medium">{Math.round(calc.details.insuranceFeesEur).toLocaleString()} €</span></div>
                      {calc.details.cargoInsuranceEur > 0 && (
                        <div className="flex items-center justify-between"><span>Страховка груза</span><span className="font-medium">{Math.round(calc.details.cargoInsuranceEur).toLocaleString()} €</span></div>
                      )}
                      <div className="border-t pt-1.5 flex items-center justify-between text-xs text-muted-foreground"><span>Промежуточная сумма</span><span>{Math.round(calc.details.subtotalEur).toLocaleString()} €</span></div>
                      <div className="flex items-center justify-between"><span>Комиссия за перевод (7%)</span><span className="font-medium">{Math.round(calc.details.paymentCommissionEur).toLocaleString()} €</span></div>
                      <div className="mt-2 pt-2 border-t flex items-center justify-between font-bold text-base"><span>Итого</span><span>{totalEurRounded.toLocaleString()} € • {totalRubRounded.toLocaleString()} ₽</span></div>
                    </div>
                  )}

                  <div className="mt-2">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <button
                        onClick={() => setServicesOpen(true)}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground border-b border-dashed border-muted-foreground/50 hover:border-foreground transition-colors outline-none"
                      >
                        Доп услуги
                      </button>
                      {/* Compact Guarantees - Horizontal Scrollable */}
                      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap px-1.5 py-0.5 bg-gray-50 rounded">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Защита</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap px-1.5 py-0.5 bg-gray-50 rounded">
                          <CheckCircle className="w-3 h-3 text-blue-600" />
                          <span>Проверка</span>
                        </div>
                      </div>
                    </div>
                    <AdditionalServicesDialog open={servicesOpen} onOpenChange={setServicesOpen} priceRub={totalRubRounded} />
                  </div>

                  <div className="mt-2 space-y-3 pt-2" ref={deliveryRef}>
                    {/* Simplified Delivery Display - EMS Default */}
                    <div className="rounded-xl border-2 border-gray-200 bg-gray-50/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-5 h-5 text-gray-600" />
                          <span className="font-bold text-sm">Доставка включена</span>
                        </div>
                        <span className="font-bold text-lg">220 €</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">EMS Курьер • 14-18 дней</div>
                        <button
                          onClick={() => window.location.href = `/booking-checkout/${product.id}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 border-b border-dashed border-blue-600/50 hover:border-blue-700 transition-colors"
                        >
                          Изменить
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                        Вы сможете выбрать другой способ доставки при оформлении заказа (Карго €170, Премиум €450+)
                      </p>
                    </div>

                    {/* Customs Note */}
                    <div className="px-1">
                      <p className="text-[10px] leading-relaxed text-gray-400 text-center">
                        Таможенное оформление включено бесплатно. <a href="/customs" onClick={(e) => { e.preventDefault(); }} className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600 transition-colors">Подробнее</a>
                      </p>
                    </div>
                  </div>

                  {/* Spacing before technical condition */}
                  <div className="mt-8 grid gap-1.5">
                    <QualityBlock product={product} />

                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">


                      <Button
                        className="w-full h-12 rounded-xl text-base font-bold bg-black text-white hover:bg-black/90 shadow-md"
                        onClick={() => {
                          openBuyoutConditions();
                        }}
                      >
                        Показать условия выкупа
                      </Button>

                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider text-center mb-2">После бесплатной брони вы получите:</div>
                        <div className="flex items-center gap-2 text-xs text-gray-700">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Отчет о соответствии (28 доп. пунктов)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-700">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Дополнительные видео и фотографии</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-700">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>48 часов на принятие решения</span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="w-full flex items-center justify-center gap-2 py-2 mt-6 text-xs font-bold text-muted-foreground/70 hover:text-foreground transition-colors"
                      onClick={() => window.location.href = '/how-it-works'}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>У меня есть вопросы по процессу работы</span>
                    </button>
                  </div>

                  <div className="mt-4" ref={ctaRef} />

                  <div className="mt-6">
                    {/* Seller Card - Buycycle Style - Larger */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      {/* Seller Info */}
                      <div className="flex items-center gap-4 mb-5">
                        {/* Avatar - Gray circle, larger */}
                        <div className="h-14 w-14 rounded-full bg-gray-500 flex items-center justify-center text-base font-bold text-white shrink-0">
                          {(function () {
                            const name = product?.sellerName || 'Seller';
                            const parts = name.split(' ');
                            if (parts.length >= 2) {
                              return (parts[0][0] + parts[1][0]).toUpperCase();
                            }
                            return name.substring(0, 2).toUpperCase();
                          })()}
                        </div>

                        {/* Info Column */}
                        <div className="flex-1 min-w-0">
                          {/* Name - Bold like Buycycle */}
                          <div className="text-base font-bold text-gray-900 mb-1">
                            Продаёт: {product?.sellerName || 'Продавец'}
                          </div>

                          {/* Location */}
                          {(product?.sellerCountry || product?.sellerLocation) && (
                            <div className="text-sm text-gray-500 mb-0.5">
                              {product.sellerCountry === 'Germany' ? 'Германия' : product.sellerCountry}
                              {product.sellerLocation && product.sellerLocation !== product.sellerCountry && `, ${product.sellerLocation}`}
                            </div>
                          )}

                          {/* Last Active */}
                          {product?.sellerLastActive && (function () {
                            const lastActive = new Date(product.sellerLastActive);
                            const now = new Date();
                            const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
                            if (diffDays > 365) return null;

                            let activeText = '';
                            if (diffDays === 0) activeText = 'сегодня';
                            else if (diffDays === 1) activeText = 'вчера';
                            else if (diffDays < 7) activeText = `${diffDays} дн. назад`;
                            else if (diffDays < 30) activeText = `${Math.floor(diffDays / 7)} нед. назад`;
                            else activeText = `${Math.floor(diffDays / 30)} мес. назад`;

                            return (
                              <div className="text-sm text-emerald-600">
                                Был в сети: {activeText}
                              </div>
                            );
                          })()}

                          {/* Rating Stars */}
                          {product?.sellerRating && product.sellerRating > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={cn(
                                    "h-4 w-4",
                                    star <= Math.round(product.sellerRating!)
                                      ? "text-yellow-400 fill-yellow-400"
                                      : "text-gray-200"
                                  )}
                                />
                              ))}
                              <span className="ml-1 text-sm text-gray-600">{product.sellerRating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Contact Button - Buycycle style with arrow */}
                      <button
                        className="w-full h-12 rounded-xl border-2 border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 transition-colors"
                        onClick={() => setMessageOpen(true)}
                      >
                        <ChevronRight className="h-4 w-4 rotate-0" />
                        <span>Связаться с продавцом</span>
                      </button>

                      {/* Buyer Protection Info */}
                      <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-emerald-800">Защита покупателя: </span>
                            <span className="text-sm text-emerald-700">
                              Ваши деньги защищены (Safe Deal). Продавец получит оплату только после того, как вы подтвердите получение байка.
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                        <button
                          onClick={() => window.location.href = '/faq'}
                          className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors inline-flex items-center gap-1.5"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Остались вопросы? Посмотрите FAQ</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Views & Publish Date - only show if meaningful */}
                  {(views > 0 || product.watchersCount) && (
                    <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-[10px] font-medium text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {((product.watchersCount || 0) + views).toLocaleString()} просмотров
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
        {/* Блоки правой колонки: доверие, аккордеоны, «как работает покупка» */}
        <div className={cn("mt-8 grid gap-6", isDesktopInitial ? "grid-cols-12" : "grid-cols-1")}>
          <div className={isDesktopInitial ? "col-span-7" : "col-span-1"} />
          <div className={cn(isDesktopInitial ? "col-span-5" : "col-span-1", "space-y-4")}>

            {/* Highlights Block - Modern Minimal */}
            {Array.isArray(product.highlights) && product.highlights.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">Особенности</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {product.highlights.map((highlight: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Accordion type="single" collapsible className="rounded-2xl border bg-background">
              <AccordionItem value="overview" className="border-b-0">
                <AccordionTrigger className="px-4 py-4 hover:no-underline">
                  <span className="text-lg font-semibold">Обзор характеристик</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-6">
                    {/* Описание и перевод */}
                    <div className="relative">
                      <h4 className="text-sm font-semibold mb-2">Описание от продавца</h4>
                      <div className={cn(
                        "text-base leading-relaxed text-muted-foreground transition-all duration-300",
                        descExpanded ? "whitespace-pre-line" : "max-h-[140px] overflow-hidden whitespace-pre-line relative"
                      )}>
                        <AdminEditable
                          field="description"
                          value={product.description}
                          multiline
                          className="items-start"
                          renderDisplay={() => translatedDescription || product.description || "Описание отсутствует."}
                        />
                        {!descExpanded && (product.description?.length || 0) > 150 && (
                          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {(product.description?.length || 0) > 150 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full h-9 px-5 border-muted-foreground/30 hover:bg-muted/50 font-medium"
                            onClick={() => setDescExpanded(v => !v)}
                          >
                            {descExpanded ? 'Свернуть' : 'Читать полностью'}
                          </Button>
                        )}

                        {!isCyrillic(product.description || '') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full h-9 px-4 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            disabled={translating}
                            onClick={() => translatedDescription ? setTranslatedDescription(null) : translateDescription()}
                          >
                            <Languages className="mr-2 h-4 w-4" />
                            {translating ? 'Переводим...' : (translatedDescription ? 'Показать оригинал' : 'Перевести')}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Ключевые характеристики - карточки */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-muted/30 p-3 flex flex-col items-center justify-center text-center gap-1.5 border border-transparent hover:border-muted-foreground/20 transition-colors">
                        <Ruler className="h-5 w-5 text-muted-foreground/70" />
                        <div className="text-xs text-muted-foreground font-medium">Размер</div>
                        <AdminEditable
                          field="spec_Размер рамы"
                          value={product.characteristics?.['Размер рамы'] || product.frameSize || ''}
                          className="justify-center font-bold w-full"
                          renderDisplay={() => <div className="text-sm font-bold text-foreground">{infoFrame}</div>}
                        />
                      </div>
                      <div className="rounded-xl bg-muted/30 p-3 flex flex-col items-center justify-center text-center gap-1.5 border border-transparent hover:border-muted-foreground/20 transition-colors">
                        <CircleDashed className="h-5 w-5 text-muted-foreground/70" />
                        <div className="text-xs text-muted-foreground font-medium">Колёса</div>
                        <AdminEditable
                          field="spec_Колеса"
                          value={product.characteristics?.['Колеса'] || product.wheelDiameter || ''}
                          className="justify-center font-bold w-full"
                          renderDisplay={() => <div className="text-sm font-bold text-foreground">{infoWheel}</div>}
                        />
                      </div>
                      <div className="rounded-xl bg-muted/30 p-3 flex flex-col items-center justify-center text-center gap-1.5 border border-transparent hover:border-muted-foreground/20 transition-colors">
                        <Calendar className="h-5 w-5 text-muted-foreground/70" />
                        <div className="text-xs text-muted-foreground font-medium">Год</div>
                        <AdminEditable
                          field="spec_Год"
                          value={product.characteristics?.['Год'] || product.year || ''}
                          className="justify-center font-bold w-full"
                          renderDisplay={() => <div className="text-sm font-bold text-foreground">{String(infoYear)}</div>}
                        />
                      </div>
                    </div>

                    {/* Полный список характеристик */}
                    <div className="space-y-0 border-t">
                      {Object.entries(product.characteristics || {})
                        .filter(([_, v]) => v !== null && v !== undefined && String(v).trim() !== '')
                        .map(([k, v]) => (
                          <div key={String(k)} className="flex items-center justify-between py-3 border-b text-sm group hover:bg-muted/20 px-2 rounded-lg transition-colors -mx-2">
                            <span className="text-muted-foreground">{String(k)}</span>
                            <span className="font-medium text-right w-full flex justify-end">
                              <AdminEditable field={`spec_${k}`} value={v} className="justify-end" />
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* AI Detected Specs */}
                    {product.ai_specs && Object.keys(product.ai_specs).length > 0 && (
                      <div className="space-y-3 pt-4 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                            AI Анализ компонентов
                          </h4>
                        </div>
                        <div className="grid gap-3">
                          {Object.entries(product.ai_specs).map(([key, value]) => {
                            const isUnknown = value.toLowerCase().includes('неизвестно') || value.toLowerCase().includes('unknown');
                            return (
                              <div key={key} className="bg-purple-50/50 dark:bg-purple-900/10 rounded-lg p-3 text-sm border border-purple-100/50 dark:border-purple-800/30">
                                <div className="text-muted-foreground text-xs mb-1">{key}</div>
                                <div className={cn("font-medium leading-snug", isUnknown ? "text-muted-foreground italic" : "text-foreground")}>
                                  {value}
                                  {isUnknown && (
                                    <span className="block text-[10px] text-gray-500 dark:text-gray-400 mt-1.5 not-italic font-medium flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" /> Уточним при проверке
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}


                    {/* Футер с дисклеймером и кнопками помощи */}
                    <div className="rounded-2xl space-y-2 pt-2">
                      <div className="flex justify-end pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-full text-xs border-muted-foreground/30 bg-transparent hover:bg-background"
                          onClick={() => setReportOpen(true)}
                        >
                          <AlertTriangle className="mr-1.5 h-3 w-3" />
                          Нашли ошибку
                        </Button>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="single" collapsible className="rounded-2xl border bg-background">
              <AccordionItem value="faq" className="border-b-0">
                <AccordionTrigger className="px-4 py-4 hover:no-underline">
                  <span className="text-lg font-semibold">Частые вопросы</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-2">
                    {getFilteredFAQ(product).map((item) => (
                      <div key={item.id} className="rounded-xl bg-white border border-gray-100 p-4 transition-colors hover:bg-gray-50">
                        <div className="font-medium mb-1 text-base">{item.question}</div>
                        <div className="text-sm text-muted-foreground leading-relaxed">
                          {item.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <Button variant="outline" className="rounded-full" onClick={() => setMessageOpen(true)}>
                      Задать свой вопрос
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-4">
              <button
                className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition-all group"
                onClick={() => setProtectionOpen(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-foreground">Защита покупателя</div>
                    <div className="text-xs text-muted-foreground">Гарантия возврата средств</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              </button>
            </div>



            {/* Как проходит покупка */}
            <div className="rounded-2xl border p-6 space-y-4" id="faq-section">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Как проходит покупка?</h3>
                <BadgeCheck className="h-5 w-5 text-green-500" />
              </div>

              <div className="relative pl-2 space-y-4 before:absolute before:left-[19px] before:top-3 before:bottom-3 before:w-[2px] before:bg-muted">
                <div className="relative pl-12">
                  <div className="absolute left-0 top-0 h-10 w-10 rounded-full border bg-background flex items-center justify-center z-10 shadow-sm">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="font-medium mb-1 pt-1">Оформление заявки</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Вам понравился байк? Оставляйте заявку в один клик. Менеджер свяжется, уточнит детали и запросит свежие фото у продавца.
                  </div>
                </div>

                <div className="relative pl-12">
                  <div className="absolute left-0 top-0 h-10 w-10 rounded-full border bg-background flex items-center justify-center z-10 shadow-sm">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="font-medium mb-1 pt-1">Оплата (Эскроу)</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Вы оплачиваете байк, но деньги хранятся на защищенном счете. Продавец получит их только когда велосипед будет у нас.
                  </div>
                </div>

                <div className="relative pl-12">
                  <div className="absolute left-0 top-0 h-10 w-10 rounded-full border bg-background flex items-center justify-center z-10 shadow-sm">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="font-medium mb-1 pt-1">Доставка к двери</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Мы привозим велосипед на наш склад в Европе, проверяем, переупаковываем и отправляем курьером прямо к вам домой.
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button className="w-full rounded-full h-11 font-medium border-muted-foreground/20 hover:bg-muted/50" variant="outline" onClick={() => (window.location.href = '/about')}>
                  Подробнее о процессе
                </Button>
              </div>
            </div>

            {/* Waitlist Banner */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Bell className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Не нашли нужный байк?</h3>
                  <p className="text-sm text-muted-foreground">Мы найдем его для вас!</p>
                </div>
              </div>
              <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setWaitlistOpen(true)}>
                Оставить заявку на поиск
              </Button>
            </div>

            <div ref={rightEndRef} />
          </div>
        </div>
        {/* Убран фиксированный островок */}

        {/* Dialogs */}
        <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Варианты покупки</DialogTitle>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Оплата картой</div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Покупка с защитой сервиса</div>
              <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Доставка и страховка</div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Redesigned Dialogs */}

        <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6">
            <div className="space-y-4 relative">
              <button
                onClick={() => setOfferOpen(false)}
                className="absolute right-0 top-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
              <div className="space-y-2 text-center">
                <DialogTitle className="text-xl">Сделать предложение</DialogTitle>
                <DialogDescription>Предложите свою цену продавцу</DialogDescription>
              </div>
              <div className="space-y-4 pt-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <Input type="number" placeholder="Ваша цена" className="pl-8 h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary/20" />
                </div>
                <Button className="w-full h-12 rounded-full font-medium" onClick={() => setOfferOpen(false)}>Отправить предложение</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
          <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden">
            <div className="bg-muted/30 p-6 pb-8 text-center space-y-3 relative">
              <button
                onClick={() => setMessageOpen(false)}
                className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-200/50 transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
              <div className="mx-auto h-12 w-12 rounded-full bg-background flex items-center justify-center mb-2 shadow-sm text-primary">
                <MessageCircle className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl">Задать вопрос продавцу</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Чтобы вы получили точный ответ, наш менеджер сам свяжется с продавцом, уточнит детали и вернётся к вам с проверенной информацией.
              </DialogDescription>
            </div>

            <div className="p-6 pt-2 space-y-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium ml-1 text-muted-foreground">Ваш вопрос</label>
                  <textarea
                    className="w-full h-28 rounded-2xl border-0 bg-muted/30 p-4 text-sm resize-none focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/50"
                    placeholder="Например: Есть ли царапины на вилке? Когда было последнее ТО?"
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium ml-1 text-muted-foreground">Как с вами связаться?</label>
                  <Input
                    className="h-12 rounded-xl border-0 bg-muted/30 px-4 focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/50"
                    placeholder="Telegram / WhatsApp / Телефон"
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="flex-1 h-12 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setMessageOpen(false)}>
                  Назад
                </Button>
                <Button
                  className="flex-[2] h-12 rounded-full font-medium shadow-lg shadow-primary/20"
                  disabled={!contactMessage.trim() || !contactMethod.trim()}
                  onClick={async () => {
                    try {
                      await crmApi.createMessage({
                        subject: `Вопрос по байку ID: ${product.id} - ${product.title}`,
                        body: contactMessage,
                        bike_id: product.id,
                        contact_method: 'contact_form',
                        contact_value: contactMethod,
                        name: user?.name || 'Guest'
                      });
                      await metricsApi.sendEvents([{ type: 'contact_request', bikeId: Number(product.id), message: contactMessage, contact: contactMethod }]);
                    } catch (e) { console.warn('Failed to send message', e); }
                    setMessageOpen(false);
                    setContactMessage('');
                    setContactMethod('');
                  }}
                >
                  Отправить заявку
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={protectionOpen} onOpenChange={setProtectionOpen}>
          <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden">
            <div className="bg-muted/30 p-6 pb-8 text-center space-y-2 relative">
              <button
                onClick={() => setProtectionOpen(false)}
                className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-200/50 transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
              <div className="mx-auto h-12 w-12 rounded-full bg-background flex items-center justify-center mb-4 shadow-sm text-green-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl">Защита покупателя</DialogTitle>
              <DialogDescription>Ваша покупка полностью защищена</DialogDescription>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-4">
                <div className="shrink-0 h-10 w-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">Безопасная оплата</div>
                  <div className="text-sm text-muted-foreground mt-1">Мы удерживаем деньги до тех пор, пока вы не получите велосипед и не подтвердите его состояние.</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="shrink-0 h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">Страховка доставки</div>
                  <div className="text-sm text-muted-foreground mt-1">Каждая отправка застрахована на полную стоимость велосипеда.</div>
                </div>
              </div>
              <div className="pt-2">
                <Button className="w-full h-12 rounded-full bg-muted text-foreground hover:bg-muted/80" variant="ghost" onClick={() => setProtectionOpen(false)}>Понятно</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={lessInfoOpen} onOpenChange={setLessInfoOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6">
            <div className="space-y-4 relative">
              <button
                onClick={() => setLessInfoOpen(false)}
                className="absolute right-0 top-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
              <div className="flex items-start gap-4">
                <div className="shrink-0 h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-lg">Почему мало информации?</DialogTitle>
                  <div className="text-sm text-muted-foreground">
                    Некоторые продавцы указывают минимум деталей. Но это не проблема.
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/30 p-5 text-sm leading-relaxed text-muted-foreground">
                К сожалению, частные продавцы часто указывают минимум деталей. Не переживайте — мы выясним всё за вас.
                <br /><br />
                Просто оставьте заявку на уточнение. Наш менеджер свяжется с продавцом, запросит свежие фото, видео, узнает про состояние расходников и вернется к вам с полным отчетом в мессенджер.
              </div>

              <div className="pt-2">
                <Button onClick={() => { setLessInfoOpen(false); openBuyoutConditions(); }} className="w-full h-12 rounded-full font-medium">
                  Оставить заявку на уточнение
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={autoInfoOpen} onOpenChange={setAutoInfoOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6">
            <div className="space-y-4 relative">
              <button
                onClick={() => setAutoInfoOpen(false)}
                className="absolute right-0 top-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
              <div className="space-y-2 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-2">
                  <Info className="h-6 w-6" />
                </div>
                <DialogTitle className="text-xl">Автоматическое добавление</DialogTitle>
              </div>
              <div className="text-sm text-muted-foreground text-center leading-relaxed px-4">
                Мы используем алгоритмы для сбора объявлений с крупнейших площадок Европы. Характеристики заполняются автоматически, поэтому иногда возможны неточности.
              </div>
              <Button className="w-full h-12 rounded-full" variant="outline" onClick={() => setAutoInfoOpen(false)}>Понятно</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6">
            <div className="space-y-4 relative">
              <button
                onClick={() => setReportOpen(false)}
                className="absolute right-0 top-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <DialogTitle className="text-lg">Сообщить об ошибке</DialogTitle>
              </div>

              <textarea
                className="w-full h-32 rounded-xl border-0 bg-muted/30 p-4 text-sm resize-none focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Что не так с этим объявлением?"
                value={reportText}
                onChange={(e) => setReportText(e.currentTarget.value)}
              />

              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="flex-1 h-12 rounded-full" onClick={() => setReportOpen(false)}>Отмена</Button>
                <Button
                  className="flex-1 h-12 rounded-full font-medium"
                  disabled={!reportText.trim()}
                  onClick={async () => {
                    try { await metricsApi.sendEvents([{ type: 'report_error', bikeId: Number(product.id), message: reportText }]); } catch { void 0 }
                    setReportOpen(false);
                    setReportText('');
                  }}
                >
                  Отправить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Конверсионный оверлей для гостя — поверх мини‑корзины */}
        <Dialog open={orderOverlayOpen} onOpenChange={setOrderOverlayOpen}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl rounded-3xl p-6 md:p-7">
            <button
              onClick={() => setOrderOverlayOpen(false)}
              className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
            >
              <X className="h-6 w-6 text-gray-400" />
            </button>
            <DialogTitle className="text-2xl md:text-3xl font-semibold">Заказываем?</DialogTitle>
            <DialogDescription className="sr-only">Быстрый переход к заявке на выкуп</DialogDescription>
            <div className="mt-3 space-y-4">
              <div className="text-base md:text-lg font-medium">Как насчёт перейти к заявке на выкуп напрямую?</div>
              <div className="text-sm md:text-base text-muted-foreground">
                Для корзины нужно будет войти в аккаунт — но это не обязательно. Аккаунт откроет возможность сохранять велосипеды в избранное, следить за ценами, пользоваться корзиной и удобнее отслеживать будущие заказы.
              </div>
              <div className="text-sm md:text-base">Мы сразу примем вашу заявку в обработку и будем держать вас в курсе!</div>
              <div className="grid gap-2 mt-2">
                <Button
                  data-testid="cta-order-now"
                  className="h-12 rounded-full bg-black text-white hover:bg-black/90"
                  onClick={() => {
                    setOrderOverlayOpen(false);
                    openBuyoutConditions();
                  }}
                >
                  Давайте заказывать!
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-full"
                  onClick={() => { window.location.href = '/login?return=' + encodeURIComponent('/cart?checkout=1'); }}
                >
                  Войти
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Что дальше?</div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setOrderDetailsOpen((v) => !v)}>Что дальше?</Button>
              </div>
              {orderDetailsOpen && (
                <div className="rounded-2xl border p-4 space-y-3 text-sm">
                  <div className="font-medium">1. Заявка принята</div>
                  <div className="text-muted-foreground">Мы свяжемся, уточним детали и начнём оценку — быстро и без лишних вопросов.</div>
                  <div className="font-medium">2. Короткая оценка</div>
                  <div className="text-muted-foreground">Пара уточнений и фото. Всё прозрачно: цена, доставка, сроки — без сюрпризов.</div>
                  <div className="font-medium">3. Оформление заказа</div>
                  <div className="text-muted-foreground">Подтверждаем, оформляем документы и держим вас в курсе на каждом шаге.</div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
          <DialogContent className="p-0 bg-transparent border-0 shadow-none max-w-md">
            <div className="relative">
              <button
                onClick={() => setWaitlistOpen(false)}
                className="absolute right-0 top-0 p-2 rounded-full hover:bg-gray-100/50 transition-colors z-10"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
              <WaitlistForm
                initialBrand={product.brand}
                initialModel={product.model}
                onClose={() => setWaitlistOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>



        {/* Direct Message Restricted Overlay */}
        <Dialog open={directMessageRestrictedOpen} onOpenChange={setDirectMessageRestrictedOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6">
            <div className="space-y-4 text-center relative">
              <button
                onClick={() => setDirectMessageRestrictedOpen(false)}
                className="absolute right-0 top-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
              <div className="mx-auto h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-600">
                <MessageCircle className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl">Напрямую написать не получится</DialogTitle>
              <div className="text-sm text-muted-foreground leading-relaxed text-left bg-gray-50 p-4 rounded-2xl">
                Но после бронирования мы будем общаться с продавцом и узнавать детали. Если вы хотите добавить какие-то особенные вопросы, не входящие в наш обязательный перечень, вы можете сделать это в интерфейсе бронирования.
              </div>
              <Button
                className="w-full h-12 rounded-full font-bold bg-black text-white hover:bg-black/90"
                onClick={() => {
                  setDirectMessageRestrictedOpen(false);
                  openBuyoutConditions();
                }}
              >
                Бронируем!
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        <Dialog open={localLotOpen} onOpenChange={setLocalLotOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6">
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
              <DialogTitle className="text-xl">Локальный лот</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed text-left">
                Продавец этого велосипеда указал, что рассматривает <b>только самовывоз</b> и не готов отправлять велосипед транспортной компанией.
                <br /><br />
                Это означает, что нам придется вести переговоры: предлагать продавцу бонусы за хлопоты и оплату упаковочных материалов.
                <br /><br />
                <b>Бронь таких лотов бесплатна</b>, так как есть вероятность, что продавец откажется от отправки. В этом случае мы предложим вам похожие варианты.
              </DialogDescription>
              <Button className="w-full h-12 rounded-full" onClick={() => setLocalLotOpen(false)}>Всё понятно</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-[100vw] w-screen h-screen p-0 bg-black border-none" aria-describedby={undefined}>
            <DialogTitle className="sr-only">{product.title}</DialogTitle>
            <div className="absolute inset-0 flex items-center justify-center select-none"
              onClick={(e) => {
                if (e.target === e.currentTarget) setLightboxOpen(false);
              }}
              onWheel={(e) => {
                e.preventDefault();
                // Smooth zoom
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                const next = Math.min(3, Math.max(1, zoom + delta));
                setZoom(next);
                if (next === 1) setOffset({ x: 0, y: 0 });
              }}
              onTouchStart={(e) => {
                if (e.touches.length === 2) {
                  const d = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                  );
                  pinchRef.current = d;
                } else if (e.touches.length === 1 && zoom > 1) {
                  panStart.current = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y };
                  setIsPanning(true);
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 2) {
                  const d = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                  );
                  const prev = pinchRef.current ?? d;
                  const delta = (d - prev) / 200;
                  const next = Math.min(3, Math.max(1, zoom + delta));
                  setZoom(next);
                  if (next === 1) setOffset({ x: 0, y: 0 });
                  pinchRef.current = d;
                } else if (e.touches.length === 1 && isPanning && zoom > 1) {
                  setOffset({ x: e.touches[0].clientX - (panStart.current?.x || 0), y: e.touches[0].clientY - (panStart.current?.y || 0) });
                }
              }}
              onTouchEnd={() => { setIsPanning(false); pinchRef.current = null; }}
            >
              <div className="w-full h-full flex items-center justify-center overflow-hidden">
                <AnimatePresence initial={false} custom={lightboxDirection} mode="popLayout">
                  <motion.img
                    key={lightboxIndex}
                    src={product.images[lightboxIndex] || product.images[0]}
                    alt={`${product.brand} ${product.model} ${product.year || ''} б/у - ${product.title}`.trim()}
                    className="max-h-[100vh] max-w-[100vw] object-contain"
                    style={{
                      transform: zoom > 1 ? `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` : `scale(${zoom})`,
                      cursor: zoom > 1 ? 'grab' : 'default',
                      position: 'absolute'
                    }}
                    custom={lightboxDirection}
                    variants={{
                      enter: (direction: number) => ({
                        x: direction > 0 ? '100vw' : '-100vw',
                        opacity: 0,
                      }),
                      center: {
                        x: 0,
                        opacity: 1,
                      },
                      exit: (direction: number) => ({
                        x: direction < 0 ? '100vw' : '-100vw',
                        opacity: 0,
                      })
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 }
                    }}
                    drag={zoom === 1 ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={1}
                    onDragEnd={(e, { offset, velocity }) => {
                      if (zoom > 1) return;
                      const swipe = Math.abs(offset.x) * velocity.x;

                      if (swipe < -100 || offset.x < -100) {
                        paginateLightbox(1);
                      } else if (swipe > 100 || offset.x > 100) {
                        paginateLightbox(-1);
                      }
                    }}
                    onClick={(e) => {
                      if (zoom === 1) e.stopPropagation(); // Allow closing on click only if not zoomed
                    }}
                  />
                </AnimatePresence>
              </div>
            </div>

            {/* Navigation */}
            <button
              aria-label="prev"
              className="fixed left-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm z-50"
              onClick={(e) => { e.stopPropagation(); paginateLightbox(-1); }}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              aria-label="next"
              className="fixed right-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm z-50"
              onClick={(e) => { e.stopPropagation(); paginateLightbox(1); }}
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            <Button variant="ghost" size="icon" className="fixed top-4 right-4 text-white hover:bg-white/10 rounded-full z-50" onClick={() => setLightboxOpen(false)}>
              <X className="h-6 w-6" />
            </Button>
          </DialogContent>
        </Dialog>

        {/* Удалён нижний мини‑островок CTA */}
        <div className="mt-12" ref={suggestedRef}>
          <MiniCatalogBikeflip personalized={true} />
        </div>
      </main>

      {/* Admin Save Button */}
      {user?.role === 'admin' && Object.keys(edits).length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex gap-2 animate-in slide-in-from-bottom-4 fade-in">
          <Button onClick={() => setEdits({})} variant="outline" className="shadow-lg bg-background">
            Отмена
          </Button>
          <Button onClick={saveChanges} className="shadow-lg">
            <Save className="mr-2 h-4 w-4" />
            Сохранить изменения ({Object.keys(edits).length})
          </Button>
        </div>
      )}
    </div>
  );
}
