"use client";

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { apiGet } from "@/api";
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { Footer } from "@/components/layout/Footer";
import type { BikeData } from "@/components/catalog/BikeCard";
import { CatalogBikeCard } from "@/components/catalog/CatalogBikeCard";
import { EmptyCatalogState } from "@/components/catalog/EmptyCatalogState";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { calculateMarketingBreakdown, refreshRates } from "@/lib/pricing";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

type SortKey =
  | "rank"
  | "recent"
  | "price_asc"
  | "price_desc"
  | "discount"
  | "year"
  | "hotness";

type FacetsResponse = {
  success?: boolean;
  facets?: {
    brands?: string[];
    sub_categories?: string[];
    sizes?: string[];
    wheels?: string[];
    frame_materials?: string[];
    brakes_types?: string[];
    shifting_types?: string[];
    seller_types?: string[];
    shipping_options?: string[];
    delivery_options?: string[];
    years?: { min?: number | null; max?: number | null };
  };
};

type BikesResponse = {
  success?: boolean;
  bikes?: unknown[];
  total?: number;
  count?: number;
  limit?: number;
  offset?: number;
  error?: string;
};

const PAGE_SIZE = 24;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "rank", label: "Рекомендованные" },
  { key: "recent", label: "Свежее" },
  { key: "price_asc", label: "Цена: ниже" },
  { key: "price_desc", label: "Цена: выше" },
  { key: "discount", label: "Скидка" },
  { key: "year", label: "Год: новый" },
  { key: "hotness", label: "Популярные" },
];

type CategoryNode = {
  key: string;
  label: string;
  value?: string;
  children?: CategoryNode[];
};

const CATEGORY_TREE: CategoryNode[] = [
  {
    key: "bikes",
    label: "Велосипеды",
    children: [
      {
        key: "mtb",
        label: "MTB",
        value: "mtb",
        children: [
          { key: "xc", label: "Cross country", value: "xc" },
          { key: "trail", label: "Trail", value: "trail" },
          { key: "enduro", label: "Enduro", value: "enduro" },
          { key: "dh", label: "Downhill", value: "dh" },
        ],
      },
      {
        key: "emtb",
        label: "eMTB",
        value: "emtb",
        children: [
          { key: "e_xc", label: "XC", value: "xc" },
          { key: "e_trail", label: "Trail", value: "trail" },
          { key: "e_enduro", label: "Enduro", value: "enduro" },
        ],
      },
      {
        key: "road",
        label: "Шоссе",
        value: "road",
        children: [
          { key: "aero", label: "Aero", value: "aero" },
          { key: "endurance", label: "Endurance", value: "endurance" },
          { key: "race", label: "Race", value: "race" },
          { key: "tt", label: "TT/Triathlon", value: "tt_triathlon" },
        ],
      },
      {
        key: "gravel",
        label: "Грэвел",
        value: "gravel",
        children: [
          { key: "g_race", label: "Race", value: "race" },
          { key: "adventure", label: "Adventure", value: "adventure" },
          { key: "bikepacking", label: "Bikepacking", value: "bikepacking" },
        ],
      },
      {
        key: "kids",
        label: "Детские",
        value: "kids",
      },
    ],
  },
];

function uniq(values: string[]) {
  return Array.from(new Set(values.map((v) => String(v).trim()).filter(Boolean)));
}

function formatFacetValue(kind: string, raw: string) {
  const v = String(raw || "").trim();
  const l = v.toLowerCase();

  if (kind === "brand") {
    if (l === "unknown") return "Не указано";
  }
  if (kind === "frame_material") {
    if (l === "carbon") return "Карбон";
    if (l === "aluminum" || l === "aluminium") return "Алюминий";
    if (l === "steel") return "Сталь";
    if (l === "titanium") return "Титан";
    if (l === "unknown") return "Не указано";
  }
  if (kind === "brakes_type") {
    if (l === "disc") return "Дисковые";
    if (l.includes("disc")) return "Дисковые (гидр.)";
    if (l === "rim") return "Ободные";
  }
  if (kind === "seller_type") {
    if (l === "private") return "Частник";
    if (l === "pro" || l === "shop" || l === "dealer") return "Магазин";
  }
  if (kind === "shipping_option") {
    if (l === "available") return "Доставка";
    if (l === "pickup") return "Самовывоз";
    if (l === "unknown") return "Не указано";
  }
  if (kind === "size") {
    const m = l.match(/^(\d{2})\s?cm$/i);
    if (m) return `${m[1]} cm`;
  }
  if (kind === "wheel") {
    const m = l.match(/^(27\.5|29|26|28|24|20)$/);
    if (m) return m[1];
  }

  return v;
}

function buildSortParams(sortKey: SortKey) {
  if (sortKey === "rank") return { sort: "rank", sortOrder: "DESC" as const };
  if (sortKey === "recent") return { sort: "recent", sortOrder: "DESC" as const };
  if (sortKey === "price_asc") return { sort: "price", sortOrder: "ASC" as const };
  if (sortKey === "price_desc") return { sort: "price", sortOrder: "DESC" as const };
  if (sortKey === "discount") return { sort: "discount", sortOrder: "DESC" as const };
  if (sortKey === "year") return { sort: "year", sortOrder: "DESC" as const };
  if (sortKey === "hotness") return { sort: "hotness", sortOrder: "DESC" as const };
  return { sort: "rank", sortOrder: "DESC" as const };
}

type MultiSelectOption = { value: string; label: string };

function formatSubCategoryLabel(raw: string) {
  const v = String(raw || "").trim();
  const l = v.toLowerCase();
  if (l === "xc") return "XC";
  if (l === "dh") return "Downhill";
  if (l === "tt_triathlon") return "TT/Triathlon";
  if (!v) return v;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function MultiSelectDropdown(props: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const selectedSet = React.useMemo(() => new Set(props.selected), [props.selected]);
  const summary = props.selected.length
    ? `${props.label}: ${props.selected.length}`
    : props.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-12 rounded-[12px] border-zinc-200 bg-white px-4 text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5]",
            props.className
          )}
        >
          {summary}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[260px] rounded-[16px] border-zinc-200 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-[#18181b]">{props.label}</div>
          {props.selected.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-[8px] px-2 text-xs"
              onClick={() => props.onChange([])}
            >
              Сбросить
            </Button>
          )}
        </div>
        <Separator className="my-2" />
        <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
          {props.options.length === 0 && (
            <div className="text-sm text-zinc-500">Нет вариантов</div>
          )}
          {props.options.map((opt) => {
            const checked = selectedSet.has(opt.value);
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-1.5 hover:bg-[#f4f4f5]"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = new Set(props.selected);
                    if (v) next.add(opt.value);
                    else next.delete(opt.value);
                    props.onChange(Array.from(next));
                  }}
                />
                <span className="text-sm text-[#18181b]">{opt.label}</span>
              </label>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ratesReady, setRatesReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshRates();
      } catch {
        // ignore
      } finally {
        if (!cancelled) setRatesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Normalize legacy query params to keep old links working.
  React.useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;

    const legacyQ = next.get("search");
    if (legacyQ && !next.get("q")) {
      next.set("q", legacyQ);
      next.delete("search");
      changed = true;
    }

    const legacyShipping = next.get("shipping");
    if (legacyShipping && next.getAll("shipping_option").length === 0) {
      next.append("shipping_option", legacyShipping);
      next.delete("shipping");
      changed = true;
    }

    if (changed) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hash deep-links from header (legacy: /catalog#q=... and /catalog#hot).
  React.useEffect(() => {
    const hash = String(window.location.hash || "");
    if (!hash) return;

    const next = new URLSearchParams(searchParams);

    if (hash.startsWith("#q=")) {
      const q = decodeURIComponent(hash.slice(3));
      if (q && !next.get("q")) {
        next.set("q", q);
        next.set("page", "1");
        setSearchParams(next, { replace: true });
      }
      return;
    }

    if (hash === "#hot" && next.get("hot") !== "true") {
      next.set("hot", "true");
      next.set("page", "1");
      setSearchParams(next, { replace: true });
      return;
    }

    const hashCategory = hash.replace(/^#/, "").trim().toLowerCase();
    const categoryAliases: Record<string, string> = {
      mtb: "mtb",
      emtb: "emtb",
      road: "road",
      gravel: "gravel",
      kids: "kids",
    };
    const normalizedCategory = categoryAliases[hashCategory];
    if (!normalizedCategory) return;
    if (!next.get("category")) {
      next.set("category", normalizedCategory);
      next.delete("sub_category");
      if (normalizedCategory === "mtb") {
        for (const sub of ["xc", "trail", "enduro", "dh"]) next.append("sub_category", sub);
      }
      next.set("page", "1");
      setSearchParams(next, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const category = searchParams.get("category") || "all";
  const subs = searchParams.getAll("sub_category");
  const brands = searchParams.getAll("brand");
  const sizes = searchParams.getAll("size");
  const wheels = searchParams.getAll("wheel");
  const frameMaterials = searchParams.getAll("frame_material");
  const brakesTypes = searchParams.getAll("brakes_type");
  const sellerTypes = searchParams.getAll("seller_type");
  const shippingOptions = searchParams.getAll("shipping_option");
  const status = searchParams.get("status") || "all";
  const hot = searchParams.get("hot") === "true";

  const hashCategoryPreset = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    const value = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (["mtb", "emtb", "road", "gravel", "kids"].includes(value)) return value;
    return null;
  }, [searchParams]);

  const effectiveCategory = category !== "all" ? category : (hashCategoryPreset || "all");
  const effectiveSubs =
    subs.length > 0
      ? subs
      : (category === "all" && hashCategoryPreset === "mtb" ? ["xc", "trail", "enduro", "dh"] : subs);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const sortKey = ((): SortKey => {
    const v = searchParams.get("sort_key");
    if (
      v === "rank" ||
      v === "recent" ||
      v === "price_asc" ||
      v === "price_desc" ||
      v === "discount" ||
      v === "year" ||
      v === "hotness"
    )
      return v;
    return "rank";
  })();

  const qFromUrl = searchParams.get("q") || "";
  const [qDraft, setQDraft] = React.useState(qFromUrl);
  React.useEffect(() => setQDraft(qFromUrl), [qFromUrl]);
  const qDebounced = useDebouncedValue(qDraft, 250);

  const minPriceFromUrl = searchParams.get("minPrice") || "";
  const maxPriceFromUrl = searchParams.get("maxPrice") || "";
  const [minPriceDraft, setMinPriceDraft] = React.useState(minPriceFromUrl);
  const [maxPriceDraft, setMaxPriceDraft] = React.useState(maxPriceFromUrl);
  React.useEffect(() => setMinPriceDraft(minPriceFromUrl), [minPriceFromUrl]);
  React.useEffect(() => setMaxPriceDraft(maxPriceFromUrl), [maxPriceFromUrl]);
  const minPriceDebounced = useDebouncedValue(minPriceDraft, 350);
  const maxPriceDebounced = useDebouncedValue(maxPriceDraft, 350);

  const yearMin = searchParams.get("yearMin") || "";
  const yearMax = searchParams.get("yearMax") || "";

  const [bikes, setBikes] = React.useState<BikeData[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [facets, setFacets] = React.useState<Required<NonNullable<FacetsResponse["facets"]>>>(
    {
      brands: [],
      sub_categories: [],
      sizes: [],
      wheels: [],
      frame_materials: [],
      brakes_types: [],
      shifting_types: [],
      seller_types: [],
      shipping_options: [],
      delivery_options: [],
      years: { min: null, max: null },
    }
  );
  const [facetsLoading, setFacetsLoading] = React.useState(false);

  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [mobileSortOpen, setMobileSortOpen] = React.useState(false);

  const num = React.useCallback((obj: Record<string, unknown>, key: string) => {
    const v = obj[key];
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, []);
  const str = React.useCallback((obj: Record<string, unknown>, key: string) => String(obj[key] ?? ""), []);

  const mapOne = React.useCallback(
    (b: Record<string, unknown>): BikeData => ({
      id: ((): string => {
        const id1 = str(b, "id");
        const id2 = str(b, "sourceAdId") || str(b, "source_ad_id");
        const id3 = str(b, "originalUrl") || str(b, "original_url");
        if (id1) return id1;
        if (id2) return id2;
        if (id3) return id3;
        const combo = [str(b, "brand"), str(b, "model"), String(Math.round(num(b, "price")))]
          .filter(Boolean)
          .join("|");
        return combo || String(Math.round(num(b, "internal_id")) || str(b, "name"));
      })(),
      name: str(b, "name"),
      brand: str(b, "brand"),
      model: str(b, "model") || str(b, "name"),
      year: num(b, "year"),
      type: str(b, "category") || "other",
      status: Boolean((b as any)["is_new"]) ? "new" : (str(b, "condition_status") === "used" ? "used" : "available"),
      priceEU: Math.round(num(b, "price")),
      ...(function () {
        const p = num(b, "price");
        const { totalEur, totalRub } = calculateMarketingBreakdown(p);
        return { priceWithDelivery: Math.round(totalEur), priceRUB: Math.round(totalRub) };
      })(),
      savings: Math.max(0, num(b, "original_price") - num(b, "price")),
      image: ((): string => {
        const main = (b as any)["main_image"];
        if (typeof main === "string" && main) return main;
        const imgs = (b as any)["images"];
        if (Array.isArray(imgs)) {
          const first = imgs[0] as unknown;
          if (typeof first === "string") return first;
          const rec = first as Record<string, unknown> | undefined;
          const url = rec?.["image_url"];
          if (typeof url === "string") return url;
        }
        const mediaMain = (b as any)?.media?.main_image;
        if (typeof mediaMain === "string" && mediaMain) return mediaMain;
        return "";
      })(),
      description: str(b, "description"),
      tags: ((): string[] => {
        const base = Array.isArray((b as any)["features"]) ? ((b as any)["features"] as string[]) : [];
        const more: string[] = [];
        const d = str(b, "discipline");
        const sub = str(b, "sub_category");
        if (d) more.push(d);
        if (sub) more.push(sub);
        return [...base, ...more].map((x) => String(x).toLowerCase());
      })(),
      size: ((): string | undefined => {
        const sizeDirect = (b as any)["size"] as string | undefined;
        if (sizeDirect) return String(sizeDirect);
        const fs = (b as any)["frame_size"] as string | undefined;
        if (fs) return String(fs);
        return undefined;
      })(),
      wheelDiameter: ((): string | undefined => {
        const direct = (b as any)["wheel_diameter"] as string | undefined;
        if (direct) return String(direct);
        const ws = (b as any)["wheel_size"] as string | undefined;
        if (ws) return String(ws);
        return undefined;
      })(),
      favoritesCount: typeof (b as any)["favorites_count"] === "number" ? ((b as any)["favorites_count"] as number) : undefined,
      isReserviert: Boolean((b as any)["is_reserviert"]),
      is_hot: Boolean((b as any)["is_hot"] || (b as any)["is_hot_offer"]),
      ranking_score: typeof (b as any)["ranking_score"] === "number" ? ((b as any)["ranking_score"] as number) : undefined,
      seller: str(b, "seller_name"),
      sellerType: str(b, "seller_type"),
      sub_category: str(b, "sub_category"),
      discipline: str(b, "discipline"),
      ...(str(b, "shipping_option") ? { shipping_option: str(b, "shipping_option") } : {}),
    }),
    [num, str]
  );

  const setParams = React.useCallback(
    (mutator: (next: URLSearchParams) => void) => {
      // Always mutate the latest URL params to avoid stale-closure overwrites
      // when debounced effects run right after hash/category deep links.
      const next = new URLSearchParams(window.location.search);
      mutator(next);
      if (!next.get("page")) next.set("page", "1");
      setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );

  const setMulti = React.useCallback(
    (key: string, values: string[]) => {
      setParams((next) => {
        next.delete(key);
        for (const v of uniq(values)) next.append(key, v);
        next.set("page", "1");
      });
    },
    [setParams]
  );

  const clearAll = React.useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const setListingStatus = React.useCallback(
    (nextStatus: "all" | "new" | "used") => {
      setParams((next) => {
        if (nextStatus === "all") next.delete("status");
        else next.set("status", nextStatus);
        next.set("page", "1");
      });
    },
    [setParams]
  );

  React.useEffect(() => {
    setParams((next) => {
      const v = String(qDebounced || "").trim();
      if (v) next.set("q", v);
      else next.delete("q");
      next.set("page", "1");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced]);

  React.useEffect(() => {
    setParams((next) => {
      const v1 = String(minPriceDebounced || "").trim();
      const v2 = String(maxPriceDebounced || "").trim();
      if (v1) next.set("minPrice", v1);
      else next.delete("minPrice");
      if (v2) next.set("maxPrice", v2);
      else next.delete("maxPrice");
      next.set("page", "1");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPriceDebounced, maxPriceDebounced]);

  const fetchFacetsKey = React.useMemo(() => {
    const k = new URLSearchParams();
    if (effectiveCategory !== "all") k.set("category", effectiveCategory);
    for (const s of effectiveSubs) k.append("sub_category", s);
    if (status !== "all") k.set("status", status);
    if (hot) k.set("hot", "true");
    return k.toString();
  }, [effectiveCategory, effectiveSubs.join("|"), status, hot]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setFacetsLoading(true);
      try {
        const data = (await apiGet(`/catalog/facets?${fetchFacetsKey}`)) as FacetsResponse;
        if (cancelled) return;
        const f = data?.facets || {};
        setFacets({
          brands: Array.isArray(f.brands) ? f.brands : [],
          sub_categories: Array.isArray(f.sub_categories) ? f.sub_categories : [],
          sizes: Array.isArray(f.sizes) ? f.sizes : [],
          wheels: Array.isArray(f.wheels) ? f.wheels : [],
          frame_materials: Array.isArray(f.frame_materials) ? f.frame_materials : [],
          brakes_types: Array.isArray(f.brakes_types) ? f.brakes_types : [],
          shifting_types: Array.isArray(f.shifting_types) ? f.shifting_types : [],
          seller_types: Array.isArray(f.seller_types) ? f.seller_types : [],
          shipping_options: Array.isArray(f.shipping_options) ? f.shipping_options : [],
          delivery_options: Array.isArray(f.delivery_options) ? f.delivery_options : [],
          years: {
            min: typeof f.years?.min === "number" ? f.years.min : null,
            max: typeof f.years?.max === "number" ? f.years.max : null,
          },
        });
      } catch {
        if (!cancelled) setFacets((prev) => prev);
      } finally {
        if (!cancelled) setFacetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchFacetsKey]);

  const bikesQueryKey = React.useMemo(() => {
    const p = new URLSearchParams();

    if (effectiveCategory !== "all") p.set("category", effectiveCategory);
    effectiveSubs.forEach((s) => p.append("sub_category", s));

    brands.forEach((b) => p.append("brand", b));
    sizes.forEach((s) => p.append("size", s));
    wheels.forEach((w) => p.append("wheel", w));
    frameMaterials.forEach((m) => p.append("frame_material", m));
    brakesTypes.forEach((b) => p.append("brakes_type", b));
    sellerTypes.forEach((t) => p.append("seller_type", t));
    shippingOptions.forEach((o) => p.append("shipping_option", o));

    if (status !== "all") p.set("status", status);
    if (hot) p.set("hot", "true");

    if (qFromUrl) p.set("q", qFromUrl);

    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);

    if (yearMin) p.set("yearMin", yearMin);
    if (yearMax) p.set("yearMax", yearMax);

    const sortParams = buildSortParams(sortKey);
    p.set("sort", sortParams.sort);
    p.set("sortOrder", sortParams.sortOrder);

    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String((page - 1) * PAGE_SIZE));

    return p.toString();
  }, [
    effectiveCategory,
    effectiveSubs.join("|"),
    brands.join("|"),
    sizes.join("|"),
    wheels.join("|"),
    frameMaterials.join("|"),
    brakesTypes.join("|"),
    sellerTypes.join("|"),
    shippingOptions.join("|"),
    status,
    hot,
    qFromUrl,
    searchParams,
    yearMin,
    yearMax,
    sortKey,
    page,
  ]);

  React.useEffect(() => {
    if (!ratesReady) {
      setLoading(true);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = (await apiGet(`/catalog/bikes?${bikesQueryKey}`)) as BikesResponse;
        if (cancelled) return;
        if (!data?.success) {
          setBikes([]);
          setTotal(0);
          setError(data?.error || "Не удалось загрузить каталог");
          return;
        }
        const raw = Array.isArray(data?.bikes) ? (data.bikes as unknown[]) : [];
        const mapped = raw.map((x) => mapOne((x || {}) as Record<string, unknown>));
        setBikes(mapped);
        setTotal(Number(data?.total || 0));
      } catch {
        if (cancelled) return;
        setBikes([]);
        setTotal(0);
        setError("Не удалось загрузить каталог");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bikesQueryKey, ratesReady]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = React.useCallback(
    (nextPage: number) => {
      const n = Math.max(1, Math.min(totalPages, nextPage));
      const next = new URLSearchParams(searchParams);
      next.set("page", String(n));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, totalPages]
  );

  const pageItems = React.useMemo(() => {
    if (totalPages <= 1) return [] as Array<number | "...">;
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let p = page - 2; p <= page + 2; p++) {
      if (p >= 2 && p <= totalPages - 1) pages.add(p);
    }
    const sorted = Array.from(pages).sort((a, b) => a - b);
    const out: Array<number | "..."> = [];
    for (let i = 0; i < sorted.length; i++) {
      const curr = sorted[i];
      const prev = sorted[i - 1];
      if (i > 0 && prev != null && curr - prev > 1) out.push("...");
      out.push(curr);
    }
    return out;
  }, [page, totalPages]);

  const sortLabel =
    SORT_OPTIONS.find((o) => o.key === sortKey)?.label || "Рекомендованные";

  const yearOptions = React.useMemo(() => {
    const min = facets.years.min;
    const max = facets.years.max;
    if (!min || !max) return [] as number[];
    const out: number[] = [];
    for (let y = max; y >= min; y--) out.push(y);
    return out;
  }, [facets.years.min, facets.years.max]);

  const subChips = React.useMemo(() => {
    const serverSubs = facets.sub_categories || [];
    if (serverSubs.length > 0) return serverSubs;

    const node = CATEGORY_TREE[0]?.children?.find((c) => c.value === effectiveCategory);
    return (node?.children || [])
      .map((x) => x.value || "")
      .filter(Boolean);
  }, [facets.sub_categories, effectiveCategory]);

  const facetOptions = React.useMemo(() => {
    const map = (kind: string, values: string[]): MultiSelectOption[] =>
      uniq(values)
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: formatFacetValue(kind, v) }));

    return {
      brands: map("brand", facets.brands),
      sizes: map("size", facets.sizes),
      wheels: map("wheel", facets.wheels),
      frame_materials: map("frame_material", facets.frame_materials),
      brakes_types: map("brakes_type", facets.brakes_types),
      seller_types: map("seller_type", facets.seller_types),
      shipping_options: map("shipping_option", facets.shipping_options),
    };
  }, [facets]);

  const Sidebar = (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-[#18181b]">Категории</div>
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-[8px] px-2 text-xs"
            onClick={clearAll}
          >
            Сброс
          </Button>
        </div>
        <Separator className="my-3" />

        <Accordion type="multiple" defaultValue={["bikes"]} className="w-full">
          {CATEGORY_TREE.map((group) => (
            <AccordionItem key={group.key} value={group.key} className="border-none">
              <AccordionTrigger className="py-2 text-sm font-medium text-[#18181b] hover:no-underline">
                {group.label}
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1">
                  {(group.children || []).map((cat) => {
                    const isSelected = effectiveCategory === (cat.value || "");
                    return (
                      <div key={cat.key} className="space-y-1">
                        <button
                          type="button"
                          data-testid={cat.value ? `sidebar-group-${cat.value}` : undefined}
                          className={cn(
                            "flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-sm transition-colors",
                            isSelected
                              ? "bg-[#18181b] text-white"
                              : "text-[#18181b] hover:bg-[#f4f4f5]"
                          )}
                          onClick={() =>
                            setParams((next) => {
                              if (cat.value) next.set("category", cat.value);
                              else next.delete("category");
                              next.delete("sub_category");
                              next.set("page", "1");
                            })
                          }
                        >
                          <span>{cat.label}</span>
                          {isSelected && (
                            <Badge className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white">
                              выбран
                            </Badge>
                          )}
                        </button>

                        {isSelected && (cat.children || []).length > 0 && (
                          <div className="ml-2 space-y-1 border-l border-zinc-200 pl-3">
                            {(cat.children || []).map((sub) => {
                              const active = effectiveSubs.includes(sub.value || "");
                              return (
                                <label
                                  key={sub.key}
                                  data-testid={
                                    cat.value && sub.value
                                      ? `sub-checkbox-${cat.value}-${sub.value}`
                                      : undefined
                                  }
                                  data-state={active ? "checked" : "unchecked"}
                                  aria-checked={active ? "true" : "false"}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm",
                                    active ? "bg-[#f4f4f5]" : "hover:bg-[#f4f4f5]"
                                  )}
                                >
                                  <Checkbox
                                    checked={active}
                                    onCheckedChange={(v) => {
                                      const next = new Set(effectiveSubs);
                                      if (v) next.add(sub.value || "");
                                      else next.delete(sub.value || "");
                                      setMulti(
                                        "sub_category",
                                        Array.from(next).filter(Boolean)
                                      );
                                    }}
                                  />
                                  <span className="text-[#18181b]">{sub.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Separator className="my-3" />

        <div className="space-y-3">
          <label
            data-testid="sidebar-hot-toggle"
            className="flex cursor-pointer items-center justify-between rounded-[12px] bg-[#f4f4f5] px-3 py-2"
          >
            <span className="text-sm font-medium text-[#18181b]">Горячие предложения</span>
            <Checkbox
              checked={hot}
              onCheckedChange={(v) =>
                setParams((next) => {
                  if (v) next.set("hot", "true");
                  else next.delete("hot");
                  next.set("page", "1");
                })
              }
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              className={cn(
                "h-11 rounded-[12px] px-4 text-sm",
                status === "all"
                  ? "bg-[#18181b] text-white"
                  : "bg-white text-[#18181b] border border-zinc-200 hover:bg-[#f4f4f5]"
              )}
              onClick={() => setListingStatus("all")}
              variant={status === "all" ? "default" : "outline"}
            >
              Все
            </Button>
            <Button
              type="button"
              className={cn(
                "h-11 rounded-[12px] px-4 text-sm",
                status === "new"
                  ? "bg-[#18181b] text-white"
                  : "bg-white text-[#18181b] border border-zinc-200 hover:bg-[#f4f4f5]"
              )}
              onClick={() => setListingStatus("new")}
              variant={status === "new" ? "default" : "outline"}
            >
              Новые
            </Button>
            <Button
              type="button"
              className={cn(
                "h-11 rounded-[12px] px-4 text-sm",
                status === "used"
                  ? "bg-[#18181b] text-white"
                  : "bg-white text-[#18181b] border border-zinc-200 hover:bg-[#f4f4f5]"
              )}
              onClick={() => setListingStatus("used")}
              variant={status === "used" ? "default" : "outline"}
            >
              Б/У
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-[#18181b]">
      <SEOHead
        title="Каталог | BikeWerk"
        description="Каталог велосипедов BikeWerk. Фильтры по брендам, цене, размеру и дисциплине."
        url="https://bikewerk.ru/catalog"
      />

      <BikeflipHeaderPX />

      <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-8 md:px-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Каталог</h1>
            <div className="mt-1 text-sm text-zinc-500">
              {loading ? "Загрузка..." : `${total.toLocaleString()} предложений`}
            </div>
          </div>


        </div>

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="hidden md:block">{Sidebar}</aside>

          <section className="min-w-0">
            <div className="rounded-[16px] border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      value={qDraft}
                      onChange={(e) => setQDraft(e.target.value)}
                      placeholder="Поиск по бренду, модели, описанию"
                      className="h-12 rounded-[12px] border-zinc-200 bg-white pl-11 pr-10 text-sm"
                    />
                    {qDraft && (
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[8px] p-2 text-zinc-500 hover:bg-white"
                        onClick={() => setQDraft("")}
                        aria-label="Очистить поиск"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="hidden gap-2 md:flex">
                    <Select
                      value={sortKey}
                      onValueChange={(v) => {
                        const nextKey = v as SortKey;
                        setParams((next) => {
                          next.set("sort_key", nextKey);
                          next.set("page", "1");
                        });
                      }}
                    >
                      <SelectTrigger className="h-12 w-full rounded-[12px] border-zinc-200 bg-white md:w-[220px]">
                        <SelectValue placeholder={sortLabel} />
                      </SelectTrigger>
                      <SelectContent className="rounded-[16px]">
                        {SORT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      className="hidden h-12 rounded-[12px] border-zinc-200 bg-white px-4 text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5] md:inline-flex"
                      onClick={clearAll}
                      disabled={loading}
                    >
                      Сбросить
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 md:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 flex-1 rounded-[12px] border-zinc-200 bg-white text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5]"
                    onClick={() => setMobileFiltersOpen(true)}
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Фильтр
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 flex-1 rounded-[12px] border-zinc-200 bg-white text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5]"
                    onClick={() => setMobileSortOpen(true)}
                  >
                    Сортировать
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="hidden flex-wrap gap-2 md:flex">
                  <div className="flex items-center gap-2 rounded-[12px] border border-zinc-200 bg-white p-2">
                    <Label className="px-2 text-xs text-zinc-500">Цена</Label>
                    <Input
                      value={minPriceDraft}
                      onChange={(e) =>
                        setMinPriceDraft(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="мин"
                      className="h-9 w-[92px] rounded-[10px] border-zinc-200 bg-white text-sm"
                    />
                    <span className="text-zinc-400">-</span>
                    <Input
                      value={maxPriceDraft}
                      onChange={(e) =>
                        setMaxPriceDraft(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="макс"
                      className="h-9 w-[92px] rounded-[10px] border-zinc-200 bg-white text-sm"
                    />
                  </div>

                  <MultiSelectDropdown
                    label="Бренды"
                    options={facetOptions.brands}
                    selected={brands}
                    onChange={(next) => setMulti("brand", next)}
                  />

                  <MultiSelectDropdown
                    label="Размеры"
                    options={facetOptions.sizes}
                    selected={sizes}
                    onChange={(next) => setMulti("size", next)}
                  />

                  <MultiSelectDropdown
                    label="Колеса"
                    options={facetOptions.wheels}
                    selected={wheels}
                    onChange={(next) => setMulti("wheel", next)}
                  />

                  <MultiSelectDropdown
                    label="Материал"
                    options={facetOptions.frame_materials}
                    selected={frameMaterials}
                    onChange={(next) => setMulti("frame_material", next)}
                  />

                  <MultiSelectDropdown
                    label="Тормоза"
                    options={facetOptions.brakes_types}
                    selected={brakesTypes}
                    onChange={(next) => setMulti("brakes_type", next)}
                  />

                  <MultiSelectDropdown
                    label="Продавец"
                    options={facetOptions.seller_types}
                    selected={sellerTypes}
                    onChange={(next) => setMulti("seller_type", next)}
                  />

                  <MultiSelectDropdown
                    label="Доставка"
                    options={facetOptions.shipping_options}
                    selected={shippingOptions}
                    onChange={(next) => setMulti("shipping_option", next)}
                  />

                  <div className="flex items-center gap-2 rounded-[12px] border border-zinc-200 bg-white p-2">
                    <Label className="px-2 text-xs text-zinc-500">Год</Label>
                    <Select
                      value={yearMin || "any"}
                      onValueChange={(v) =>
                        setParams((next) => {
                          if (v === "any") next.delete("yearMin");
                          else next.set("yearMin", v);
                          next.set("page", "1");
                        })
                      }
                    >
                    <SelectTrigger className="h-9 w-[120px] rounded-[10px] border-zinc-200 bg-white text-sm">
                      <SelectValue placeholder="от" />
                    </SelectTrigger>
                      <SelectContent className="rounded-[16px]">
                        <SelectItem value="any">Любой</SelectItem>
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={yearMax || "any"}
                      onValueChange={(v) =>
                        setParams((next) => {
                          if (v === "any") next.delete("yearMax");
                          else next.set("yearMax", v);
                          next.set("page", "1");
                        })
                      }
                    >
                    <SelectTrigger className="h-9 w-[120px] rounded-[10px] border-zinc-200 bg-white text-sm">
                      <SelectValue placeholder="до" />
                    </SelectTrigger>
                      <SelectContent className="rounded-[16px]">
                        <SelectItem value="any">Любой</SelectItem>
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {facetsLoading && (
                    <div className="flex items-center text-xs text-zinc-400">
                      Обновляем фильтры...
                    </div>
                  )}
                </div>

                {subChips.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-9 rounded-full px-4 text-sm",
                        effectiveSubs.length === 0
                          ? "bg-[#18181b] text-white hover:bg-[#18181b]"
                          : "border-zinc-200 bg-white text-[#18181b] hover:bg-[#f4f4f5]"
                      )}
                      onClick={() => setMulti("sub_category", [])}
                    >
                      Все
                    </Button>
                    {subChips.map((s) => {
                      const active = effectiveSubs.includes(s);
                      return (
                        <Button
                          key={s}
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-9 rounded-full px-4 text-sm",
                            active
                              ? "bg-[#18181b] text-white hover:bg-[#18181b]"
                              : "border-zinc-200 bg-white text-[#18181b] hover:bg-[#f4f4f5]"
                          )}
                          onClick={() => {
                            const next = new Set(effectiveSubs);
                            if (active) next.delete(s);
                            else next.add(s);
                            setMulti("sub_category", Array.from(next));
                          }}
                        >
                          {formatSubCategoryLabel(s)}
                        </Button>
                      );
                    })}
                  </div>
                )}

                <div
                  data-testid="listing-type-block"
                  className="grid grid-cols-3 gap-2 rounded-[12px] border border-zinc-200 bg-white p-1"
                >
                  <Button
                    type="button"
                    className={cn(
                      "h-9 rounded-[10px] px-3 text-sm",
                      status === "all"
                        ? "bg-[#18181b] text-white"
                        : "bg-white text-[#18181b] border border-zinc-200 hover:bg-[#f4f4f5]"
                    )}
                    onClick={() => setListingStatus("all")}
                    variant={status === "all" ? "default" : "outline"}
                  >
                    Все
                  </Button>
                  <Button
                    type="button"
                    className={cn(
                      "h-9 rounded-[10px] px-3 text-sm",
                      status === "new"
                        ? "bg-[#18181b] text-white"
                        : "bg-white text-[#18181b] border border-zinc-200 hover:bg-[#f4f4f5]"
                    )}
                    onClick={() => setListingStatus("new")}
                    variant={status === "new" ? "default" : "outline"}
                  >
                    Новые
                  </Button>
                  <Button
                    type="button"
                    className={cn(
                      "h-9 rounded-[10px] px-3 text-sm",
                      status === "used"
                        ? "bg-[#18181b] text-white"
                        : "bg-white text-[#18181b] border border-zinc-200 hover:bg-[#f4f4f5]"
                    )}
                    onClick={() => setListingStatus("used")}
                    variant={status === "used" ? "default" : "outline"}
                  >
                    Б/У
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6">
              {error && (
                <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {!error && !loading && bikes.length === 0 && (
                <EmptyCatalogState />
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {loading
                  ? Array.from({ length: 9 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="h-[420px] rounded-[12px] border border-zinc-200 bg-[#f4f4f5]"
                      />
                    ))
                  : bikes.map((bike) => <CatalogBikeCard key={bike.id} bike={bike} />)}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-[12px] border-zinc-200 bg-white px-4 hover:bg-[#f4f4f5]"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1 || loading}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Назад
                  </Button>

                  <div className="hidden items-center gap-1 md:flex">
                    {pageItems.map((it, idx) => {
                      if (it === "...") {
                        return (
                          <span
                            key={`dots-${idx}`}
                            className="px-2 text-sm text-zinc-400"
                          >
                            ...
                          </span>
                        );
                      }
                      const active = it === page;
                      return (
                        <Button
                          key={it}
                          type="button"
                          variant={active ? "default" : "outline"}
                          className={cn(
                            "h-11 min-w-11 rounded-[12px] px-3 text-sm",
                            active
                              ? "bg-[#18181b] text-white hover:bg-[#18181b]"
                              : "border-zinc-200 bg-white text-[#18181b] hover:bg-[#f4f4f5]"
                          )}
                          onClick={() => goToPage(it)}
                          disabled={loading}
                        >
                          {it}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="px-2 text-sm text-zinc-500 md:hidden">
                    {page} / {totalPages}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-[12px] border-zinc-200 bg-white px-4 hover:bg-[#f4f4f5]"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages || loading}
                  >
                    Вперёд
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <Footer />

      <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <DialogContent className="h-[100dvh] w-screen max-w-none rounded-none p-0 md:hidden">
          <div className="flex h-full flex-col bg-white">
            <DialogHeader className="border-b border-zinc-200 px-4 py-4">
              <DialogTitle className="flex items-center justify-between text-xl">
                <span>Фильтр</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-10 rounded-full p-0"
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-auto px-4 py-4">
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="categories" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Категории
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-3">
                      {CATEGORY_TREE.map((group) => (
                        <div key={group.key} className="rounded-[16px] border border-zinc-200 bg-white p-3">
                          <div className="text-sm font-semibold text-[#18181b]">{group.label}</div>
                          <div className="mt-2 space-y-1">
                            {(group.children || []).map((cat) => {
                              const isSelected = effectiveCategory === (cat.value || "");
                              return (
                                <div key={cat.key} className="space-y-1">
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-sm transition-colors",
                                      isSelected
                                        ? "bg-[#18181b] text-white"
                                        : "text-[#18181b] hover:bg-[#f4f4f5]"
                                    )}
                                    onClick={() =>
                                      setParams((next) => {
                                        if (cat.value) next.set("category", cat.value);
                                        else next.delete("category");
                                        next.delete("sub_category");
                                        next.set("page", "1");
                                      })
                                    }
                                  >
                                    <span>{cat.label}</span>
                                    {isSelected && (
                                      <Badge className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white">
                                        выбран
                                      </Badge>
                                    )}
                                  </button>

                                  {isSelected && (cat.children || []).length > 0 && (
                                    <div className="ml-2 space-y-1 border-l border-zinc-200 pl-3">
                                      {(cat.children || []).map((sub) => {
                                        const active = effectiveSubs.includes(sub.value || "");
                                        return (
                                          <label
                                            key={sub.key}
                                            data-testid={
                                              cat.value && sub.value
                                                ? `sub-checkbox-${cat.value}-${sub.value}`
                                                : undefined
                                            }
                                            data-state={active ? "checked" : "unchecked"}
                                            aria-checked={active ? "true" : "false"}
                                            className={cn(
                                              "flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm",
                                              active ? "bg-[#f4f4f5]" : "hover:bg-[#f4f4f5]"
                                            )}
                                          >
                                            <Checkbox
                                              checked={active}
                                              onCheckedChange={(v) => {
                                                const next = new Set(effectiveSubs);
                                                if (v) next.add(sub.value || "");
                                                else next.delete(sub.value || "");
                                                setMulti("sub_category", Array.from(next).filter(Boolean));
                                              }}
                                            />
                                            <span className="text-[#18181b]">{sub.label}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="price" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Цена
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="rounded-[16px] border border-zinc-200 bg-white p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={minPriceDraft}
                          onChange={(e) => setMinPriceDraft(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="мин"
                          className="h-12 rounded-[12px] border-zinc-200 bg-white text-sm"
                        />
                        <Input
                          value={maxPriceDraft}
                          onChange={(e) => setMaxPriceDraft(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="макс"
                          className="h-12 rounded-[12px] border-zinc-200 bg-white text-sm"
                        />
                      </div>
                      <div className="mt-2 text-xs text-zinc-500">
                        Значения в евро. Фильтры применятся автоматически.
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="brands" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Марки
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="rounded-[16px] border border-zinc-200 bg-white p-3">
                      <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                        {facetOptions.brands.length === 0 && (
                          <div className="text-sm text-zinc-500">Нет вариантов</div>
                        )}
                        {facetOptions.brands.map((opt) => {
                          const checked = brands.includes(opt.value);
                          return (
                            <label
                              key={opt.value}
                              className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-2 hover:bg-[#f4f4f5]"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const next = new Set(brands);
                                  if (v) next.add(opt.value);
                                  else next.delete(opt.value);
                                  setMulti("brand", Array.from(next));
                                }}
                              />
                              <span className="text-sm text-[#18181b]">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sizes" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Размер
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="rounded-[16px] border border-zinc-200 bg-white p-3">
                      <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                        {facetOptions.sizes.length === 0 && <div className="text-sm text-zinc-500">Нет вариантов</div>}
                        {facetOptions.sizes.map((opt) => {
                          const checked = sizes.includes(opt.value);
                          return (
                            <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-2 hover:bg-[#f4f4f5]">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const next = new Set(sizes);
                                  if (v) next.add(opt.value);
                                  else next.delete(opt.value);
                                  setMulti("size", Array.from(next));
                                }}
                              />
                              <span className="text-sm text-[#18181b]">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="wheels" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Колеса
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="rounded-[16px] border border-zinc-200 bg-white p-3">
                      <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                        {facetOptions.wheels.length === 0 && <div className="text-sm text-zinc-500">Нет вариантов</div>}
                        {facetOptions.wheels.map((opt) => {
                          const checked = wheels.includes(opt.value);
                          return (
                            <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-2 hover:bg-[#f4f4f5]">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const next = new Set(wheels);
                                  if (v) next.add(opt.value);
                                  else next.delete(opt.value);
                                  setMulti("wheel", Array.from(next));
                                }}
                              />
                              <span className="text-sm text-[#18181b]">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="material" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Материал
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="rounded-[16px] border border-zinc-200 bg-white p-3">
                      <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                        {facetOptions.frame_materials.length === 0 && <div className="text-sm text-zinc-500">Нет вариантов</div>}
                        {facetOptions.frame_materials.map((opt) => {
                          const checked = frameMaterials.includes(opt.value);
                          return (
                            <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-2 hover:bg-[#f4f4f5]">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const next = new Set(frameMaterials);
                                  if (v) next.add(opt.value);
                                  else next.delete(opt.value);
                                  setMulti("frame_material", Array.from(next));
                                }}
                              />
                              <span className="text-sm text-[#18181b]">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="brakes" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Тормоза
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="rounded-[16px] border border-zinc-200 bg-white p-3">
                      <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                        {facetOptions.brakes_types.length === 0 && <div className="text-sm text-zinc-500">Нет вариантов</div>}
                        {facetOptions.brakes_types.map((opt) => {
                          const checked = brakesTypes.includes(opt.value);
                          return (
                            <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-2 hover:bg-[#f4f4f5]">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const next = new Set(brakesTypes);
                                  if (v) next.add(opt.value);
                                  else next.delete(opt.value);
                                  setMulti("brakes_type", Array.from(next));
                                }}
                              />
                              <span className="text-sm text-[#18181b]">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="seller" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Продавец
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="rounded-[16px] border border-zinc-200 bg-white p-3">
                      <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                        {facetOptions.seller_types.length === 0 && <div className="text-sm text-zinc-500">Нет вариантов</div>}
                        {facetOptions.seller_types.map((opt) => {
                          const checked = sellerTypes.includes(opt.value);
                          return (
                            <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-2 hover:bg-[#f4f4f5]">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const next = new Set(sellerTypes);
                                  if (v) next.add(opt.value);
                                  else next.delete(opt.value);
                                  setMulti("seller_type", Array.from(next));
                                }}
                              />
                              <span className="text-sm text-[#18181b]">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="shipping" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Доставка
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="rounded-[16px] border border-zinc-200 bg-white p-3">
                      <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                        {facetOptions.shipping_options.length === 0 && <div className="text-sm text-zinc-500">Нет вариантов</div>}
                        {facetOptions.shipping_options.map((opt) => {
                          const checked = shippingOptions.includes(opt.value);
                          return (
                            <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-2 hover:bg-[#f4f4f5]">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const next = new Set(shippingOptions);
                                  if (v) next.add(opt.value);
                                  else next.delete(opt.value);
                                  setMulti("shipping_option", Array.from(next));
                                }}
                              />
                              <span className="text-sm text-[#18181b]">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="year" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Год
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="rounded-[16px] border border-zinc-200 bg-white p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={yearMin || "any"}
                          onValueChange={(v) =>
                            setParams((next) => {
                              if (v === "any") next.delete("yearMin");
                              else next.set("yearMin", v);
                              next.set("page", "1");
                            })
                          }
                        >
                          <SelectTrigger className="h-12 rounded-[12px] border-zinc-200 bg-white text-sm">
                            <SelectValue placeholder="от" />
                          </SelectTrigger>
                          <SelectContent className="rounded-[16px]">
                            <SelectItem value="any">Любой</SelectItem>
                            {yearOptions.map((y) => (
                              <SelectItem key={y} value={String(y)}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={yearMax || "any"}
                          onValueChange={(v) =>
                            setParams((next) => {
                              if (v === "any") next.delete("yearMax");
                              else next.set("yearMax", v);
                              next.set("page", "1");
                            })
                          }
                        >
                          <SelectTrigger className="h-12 rounded-[12px] border-zinc-200 bg-white text-sm">
                            <SelectValue placeholder="до" />
                          </SelectTrigger>
                          <SelectContent className="rounded-[16px]">
                            <SelectItem value="any">Любой</SelectItem>
                            {yearOptions.map((y) => (
                              <SelectItem key={y} value={String(y)}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="misc" className="border-none">
                  <AccordionTrigger className="py-4 text-base font-semibold text-[#18181b] hover:no-underline">
                    Дополнительно
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-3">
                      <label className="flex cursor-pointer items-center justify-between rounded-[16px] border border-zinc-200 bg-white px-4 py-3">
                        <span className="text-sm font-semibold text-[#18181b]">Горячие предложения</span>
                        <Checkbox
                          checked={hot}
                          onCheckedChange={(v) =>
                            setParams((next) => {
                              if (v) next.set("hot", "true");
                              else next.delete("hot");
                              next.set("page", "1");
                            })
                          }
                        />
                      </label>

                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          className={cn(
                            "h-12 rounded-[12px] px-4 text-sm",
                            status === "all"
                              ? "bg-[#18181b] text-white"
                              : "bg-white text-[#18181b] border border-zinc-200 hover:bg-[#f4f4f5]"
                          )}
                          onClick={() => setListingStatus("all")}
                          variant={status === "all" ? "default" : "outline"}
                        >
                          Все
                        </Button>
                        <Button
                          type="button"
                          className={cn(
                            "h-12 rounded-[12px] px-4 text-sm",
                            status === "new"
                              ? "bg-[#18181b] text-white"
                              : "bg-white text-[#18181b] border border-zinc-200 hover:bg-[#f4f4f5]"
                          )}
                          onClick={() => setListingStatus("new")}
                          variant={status === "new" ? "default" : "outline"}
                        >
                          Новые
                        </Button>
                        <Button
                          type="button"
                          className={cn(
                            "h-12 rounded-[12px] px-4 text-sm",
                            status === "used"
                              ? "bg-[#18181b] text-white"
                              : "bg-white text-[#18181b] border border-zinc-200 hover:bg-[#f4f4f5]"
                          )}
                          onClick={() => setListingStatus("used")}
                          variant={status === "used" ? "default" : "outline"}
                        >
                          Б/У
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="border-t border-zinc-200 bg-white px-4 py-4 [padding-bottom:calc(1rem+env(safe-area-inset-bottom))]">
              <div className="grid gap-3">
                <Button
                  type="button"
                  className="h-12 rounded-[12px] bg-[#18181b] text-white hover:bg-black"
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  Применить
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-[12px] border-zinc-200 bg-white hover:bg-[#f4f4f5]"
                  onClick={clearAll}
                >
                  Сбросить
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mobileSortOpen} onOpenChange={setMobileSortOpen}>
        <DialogContent className="h-[100dvh] w-screen max-w-none rounded-none p-0 md:hidden">
          <div className="flex h-full flex-col bg-white">
            <DialogHeader className="border-b border-zinc-200 px-4 py-4">
              <DialogTitle className="flex items-center justify-between text-xl">
                <span>Сортировка</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-10 rounded-full p-0"
                  onClick={() => setMobileSortOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-auto px-4 py-4">
              <div className="rounded-[16px] border border-zinc-200 bg-white p-2">
                {SORT_OPTIONS.map((opt) => {
                  const active = opt.key === sortKey;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-[12px] px-3 py-3 text-left text-sm transition-colors",
                        active ? "bg-[#18181b] text-white" : "hover:bg-[#f4f4f5] text-[#18181b]"
                      )}
                      onClick={() => {
                        setParams((next) => {
                          next.set("sort_key", opt.key);
                          next.set("page", "1");
                        });
                        setMobileSortOpen(false);
                      }}
                    >
                      <span className="font-medium">{opt.label}</span>
                      {active && <span className="text-xs opacity-90">выбрано</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
