"use client";

import * as React from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

import { apiGet, apiPost, resolveImageUrl } from "@/api";
import type { BikeData } from "@/components/catalog/BikeCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function resolveImgForCatalog(path: unknown): string | null {
  if (path == null) return null;
  const p = String(path || "").trim();
  if (!p) return null;

  // If an upstream URL was already wrapped by our backend proxy, unwrap it for <img>.
  // The proxy may hit marketplace hotlink protection and return 403.
  try {
    const u = new URL(p, "http://_");
    if (u.pathname.endsWith("/api/image-proxy")) {
      const raw = u.searchParams.get("url");
      if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/^http:/i, "https:");
    }
  } catch {
    // ignore
  }

  // For <img>, prefer direct external URLs. The backend proxy often gets 403 from marketplaces.
  if (p.startsWith("//")) return `https:${p}`;
  if (/^https?:\/\//i.test(p)) return p.replace(/^http:/i, "https:");

  return resolveImageUrl(p);
}

function pickImage(bike: BikeData): string | null {
  const candidates = [bike.image, ...(Array.isArray((bike as any).images) ? (bike as any).images : [])];
  for (const c of candidates) {
    const u = resolveImgForCatalog(c);
    if (u) return u;
  }
  return null;
}

function shortTitle(bike: BikeData) {
  const base = (bike.name || "").trim();
  if (base) return base;
  return [bike.brand, bike.model].filter(Boolean).join(" ").trim();
}

function chip(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^(unknown|не указано|not specified)$/i.test(s)) return null;
  return s;
}

export function CatalogBikeCard({ bike, className }: { bike: BikeData; className?: string }) {
  const [imgSrc, setImgSrc] = React.useState<string>(() => pickImage(bike) || "/placeholder-bike.svg");
  const [fav, setFav] = React.useState(false);
  const favKey = "guestFavorites";

  React.useEffect(() => {
    setImgSrc(pickImage(bike) || "/placeholder-bike.svg");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bike.id, bike.image]);

  React.useEffect(() => {
    let cancelled = false;
    const init = async () => {
      // If user is not logged in, avoid calling protected endpoints.
      let hasToken = false;
      try {
        hasToken = Boolean(localStorage.getItem("authToken"));
      } catch {
        hasToken = false;
      }
      if (!hasToken) {
        try {
          const arr = JSON.parse(localStorage.getItem(favKey) || "[]");
          const idNum = Number(bike.id);
          if (!cancelled) setFav(Array.isArray(arr) && arr.map(Number).includes(idNum));
        } catch {
          if (!cancelled) setFav(false);
        }
        return;
      }

      try {
        const r = await apiGet(`/favorites/check/${Number(bike.id)}`);
        if (!cancelled && typeof r?.isInFavorites === "boolean") setFav(Boolean(r.isInFavorites));
      } catch {
        try {
          const arr = JSON.parse(localStorage.getItem(favKey) || "[]");
          const idNum = Number(bike.id);
          if (!cancelled) setFav(Array.isArray(arr) && arr.map(Number).includes(idNum));
        } catch {
          if (!cancelled) setFav(false);
        }
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [bike.id]);

  const onToggleFav: React.MouseEventHandler = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !fav;
    setFav(next);

    let hasToken = false;
    try {
      hasToken = Boolean(localStorage.getItem("authToken"));
    } catch {
      hasToken = false;
    }

    if (!hasToken) {
      try {
        const idNum = Number(bike.id);
        const arr = JSON.parse(localStorage.getItem(favKey) || "[]");
        const uniq = Array.from(new Set(Array.isArray(arr) ? arr.map((x: any) => Number(x)) : []));
        const nextArr = next ? (uniq.includes(idNum) ? uniq : [idNum, ...uniq]) : uniq.filter((x) => x !== idNum);
        localStorage.setItem(favKey, JSON.stringify(nextArr));
      } catch {
        void 0;
      }
      return;
    }

    try {
      await apiPost("/favorites/toggle", { bikeId: Number(bike.id) });
    } catch {
      try {
        const idNum = Number(bike.id);
        const arr = JSON.parse(localStorage.getItem(favKey) || "[]");
        const uniq = Array.from(new Set(Array.isArray(arr) ? arr.map((x: any) => Number(x)) : []));
        const nextArr = next ? (uniq.includes(idNum) ? uniq : [idNum, ...uniq]) : uniq.filter((x) => x !== idNum);
        localStorage.setItem(favKey, JSON.stringify(nextArr));
      } catch {
        void 0;
      }
    }
  };

  const title = shortTitle(bike);
  const year = bike.year ? String(bike.year) : null;
  const size = chip(bike.size);
  const wheel = chip(bike.wheelDiameter);

  const priceEur = Number(bike.priceEU || 0);
  const priceRub = Number((bike as any).priceRUB || 0);
  const savings = Number(bike.savings || 0);

  const metaChips = [year, size, wheel].filter(Boolean).slice(0, 3) as string[];

  return (
    <Link
      to={`/product/${bike.id}`}
      data-testid="bike-card"
      className={cn(
        "group flex flex-col overflow-hidden rounded-[16px] border border-zinc-200 bg-white shadow-sm transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md",
        className
      )}
    >
      {/* Fixed media box to prevent portrait sources from stretching card height */}
      <div className="relative aspect-[9/10] min-h-[260px] w-full overflow-hidden bg-[#f4f4f5]">
        <img
          src={imgSrc}
          alt={title}
          className="h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget;
            if (el.dataset.fallbackApplied === "1") return;
            el.dataset.fallbackApplied = "1";
            el.src = "/placeholder-bike.svg";
          }}
        />

        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          {bike.is_hot && (
            <Badge className="rounded-full bg-[#18181b] px-3 py-1 text-[11px] text-white">
              Горячее
            </Badge>
          )}
          {bike.shipping_option === "available" && (
            <Badge className="rounded-full bg-white/90 px-3 py-1 text-[11px] text-[#18181b] backdrop-blur">
              Доставка доступна
            </Badge>
          )}
        </div>

        <div className="absolute right-3 top-3">
          <Button
            type="button"
            variant="ghost"
            data-testid="favorite-btn"
            className="h-10 w-10 rounded-full bg-white/90 p-0 text-zinc-700 backdrop-blur hover:bg-white transition-transform active:scale-95"
            onClick={onToggleFav}
            aria-label={fav ? "Убрать из избранного" : "Добавить в избранное"}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                fav ? "fill-red-500 text-red-500" : "text-zinc-700"
              )}
            />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {(bike.brand || "").trim() && !/^unknown$/i.test(String(bike.brand)) ? bike.brand : "BikeWerk"}
        </div>
        <div className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-[#18181b]">
          {title}
        </div>

        {metaChips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {metaChips.map((c) => (
              <span
                key={c}
                data-testid="chip"
                className="rounded-full bg-[#f4f4f5] px-3 py-1 text-xs text-zinc-700"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[18px] font-semibold text-[#18181b]">
                {priceRub > 0 ? `${priceRub.toLocaleString()} ₽` : `${Math.round(priceEur).toLocaleString()} €`}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {priceEur > 0 ? `${Math.round(priceEur).toLocaleString()} €` : "Цена уточняется"}
                {savings > 0 ? ` · скидка ${Math.round(savings).toLocaleString()} €` : ""}
              </div>
            </div>

            <Button
              type="button"
              className="h-11 rounded-full bg-[#18181b] px-6 text-sm font-semibold text-white hover:bg-black transition-transform active:scale-[0.98]"
            >
              Подробнее
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
