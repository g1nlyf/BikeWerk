"use client";
import React from "react";
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { SEOHead } from "@/components/SEO/SEOHead";
import { refreshRates, RATES as PricingRates } from "@/lib/pricing";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { BookingOverlay } from "@/components/checkout/BookingOverlay";
import { cn } from "@/lib/utils";
import CountUp from "@/components/count-up";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle, Heart, Truck, Link as LinkIcon, Edit3, ArrowRight } from "lucide-react";

type ListingInfo = {
  title: string;
  brand?: string;
  model?: string;
  priceEUR?: number;
  location?: string;
  image?: string;
  characteristics?: Record<string, string | number>;
};

const SAMPLE_URL = "https://www.kleinanzeigen.de/s-anzeige/santa-cruz-v10-cc-mit-oehlins-dh38m2-notverkauf/3153135202-217-3772";

const RUSSIAN_KEYS: Record<string, string> = {
  "Zustand": "Состояние",
  "Rahmenhöhe": "Размер рамы",
  "Baujahr": "Год выпуска",
  "wheelDiameter": "Диаметр колес",
  "deliveryOption": "Доставка",
  "frameSize": "Размер рамы",
  "year": "Год выпуска",
  "brand": "Бренд",
  "model": "Модель",
};

function translateKey(key: string): string {
  return RUSSIAN_KEYS[key] || key;
}

function cleanTitle(title: string): string {
  // Remove messy suffixes often found in German listings
  return title
    .replace(/\|\s*kleinanzeigen\.de/gi, "")
    .replace(/\|\s*eBay/gi, "")
    .replace(/\|\s*Bikemarkt/gi, "")
    .replace(/\|\s*Herrenfahrrad gebraucht kaufen/gi, "")
    .replace(/in\s+[A-Z][a-z]+(\s*-\s*[A-Z][a-z]+)?/g, "") // Try to remove location like "in Bayern"
    .replace(/\s-\s.*$/, "") // Remove everything after the first dash if it looks like a separator
    .trim();
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s`]+/i);
  return match ? match[0] : null;
}

function normalizeUrl(input: string): string {
  let s = (input || '').trim();
  s = s.replace(/^(https?:\/\/)(https?:\/\/)/i, '$1');
  s = s.replace(/[\)\]\.,]+$/g, '');
  if (!/^https?:\/\//i.test(s)) {
    s = 'https://' + s;
  }
  return s;
}

function isValidBikeUrl(url: string) {
  try {
    const u = new URL(url);
    const protocol = u.protocol.toLowerCase();
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function stripMarkdownJson(text: string): string {
  let t = text || "";
  t = t.replace(/^```json\s*/i, "");
  t = t.replace(/^json\s*/i, "");
  t = t.replace(/```\s*$/i, "");
  return t.trim();
}

function extractDataFromUrl(url: string): ListingInfo | null {
  try {
    const u = new URL(url);
    const slug = u.pathname.split("/").filter(Boolean).join(" ");
    const title = decodeURIComponent(slug).replace(/-/g, " ");
    const tokens = title.split(/\s+/);
    const brand = tokens[0] ? tokens[0][0].toUpperCase() + tokens[0].slice(1) : undefined;
    const model = tokens.slice(1, 4).join(" ") || undefined;
    return {
      title,
      brand,
      model,
      priceEUR: undefined,
      location: "",
      image: undefined,
      characteristics: {},
    };
  } catch {
    return null;
  }
}

async function fetchListingInfo(url: string, progressUpdate?: (pct: number, stage: string) => void): Promise<ListingInfo | null> {
  try {
    const apiBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
    if (apiBase) {
      progressUpdate?.(10, "Отправили запрос на сервер…");
      const resp = await fetch(`${apiBase}/parse-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      if (resp.ok) {
        const j = await resp.json();
        progressUpdate?.(85, "Получили ответ и структурировали данные…");
        const characteristics: Record<string, string | number> = j.characteristics || {};
        if (!characteristics["deliveryOption"]) {
          let htmlProbe: string | null = null;
          try {
            progressUpdate?.(87, "Проверяем доставку по r.jina.ai…");
            const u = new URL(url);
            const readerUrl = `https://r.jina.ai/${u.protocol}//${u.hostname}${u.pathname}${u.search}`;
            const r = await fetch(readerUrl);
            if (r.ok) {
              htmlProbe = await r.text();
            }
          } catch {}
          if (!htmlProbe) {
            try {
              progressUpdate?.(88, "Проверяем доставку по corsproxy.io…");
              const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
              if (r.ok) htmlProbe = await r.text();
            } catch {}
          }
          if (htmlProbe) {
            const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
            const allowPickup = host.endsWith("kleinanzeigen.de") || host.endsWith("pinkbike.com");
            const pickupOnly = /(nur\s*-?\s*abholung|selbstabholung|selbstabholer|kein\s+versand|versand\s*:\s*nein|versand\s+nicht\s*möglich)/i.test(htmlProbe);
            const deliveryAvail = /(versand\s*möglich|versand\s*:\s*ja|lieferung\s*möglich|lieferung\s*verfügbar|shipping\s*available)/i.test(htmlProbe);
            if (allowPickup && pickupOnly) {
              characteristics["deliveryOption"] = "pickup-only";
            } else {
              characteristics["deliveryOption"] = "available";
            }
          }
        }
        return {
          title: j.title || "",
          brand: j.brand || undefined,
          model: j.model || undefined,
          priceEUR: typeof j.priceEUR === "number" ? j.priceEUR : undefined,
          location: "",
          image: undefined,
          characteristics,
        };
      }
      progressUpdate?.(15, "Сервер недоступен, пробуем напрямую…");
    }
    if (!isValidBikeUrl(url)) {
      progressUpdate?.(5, "Некорректный URL");
    }
    progressUpdate?.(8, "Старт загрузки HTML…");
    let html: string | null = null;
    try {
      progressUpdate?.(15, "Пробуем corsproxy.io…");
      const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
      if (r.ok) {
        html = await r.text();
        progressUpdate?.(40, "HTML получен (corsproxy.io)…");
      }
    } catch {}
    if (!html) {
      try {
        progressUpdate?.(20, "Пробуем cors-anywhere…");
        const r = await fetch(`https://cors-anywhere.herokuapp.com/${url}`);
        if (r.ok) {
          html = await r.text();
          progressUpdate?.(40, "HTML получен (cors-anywhere)…");
        }
      } catch {}
    }
    if (!html) {
      try {
        progressUpdate?.(25, "Пробуем r.jina.ai reader…");
        const u = new URL(url);
        const readerUrl = `https://r.jina.ai/${u.protocol}//${u.hostname}${u.pathname}${u.search}`;
        const r = await fetch(readerUrl);
        if (r.ok) {
          html = await r.text();
          progressUpdate?.(42, "HTML получен (r.jina.ai)…");
        }
      } catch {}
    }

    if (!html) {
      progressUpdate?.(30, "Proxy недоступны, извлекаем из URL…");
      const extracted = extractDataFromUrl(url);
      if (extracted) return extracted;
      throw new Error("Не удалось загрузить содержимое страницы. Все proxy сервисы недоступны.");
    }

    const hasPickupOnly = /(nur\s*-?\s*abholung|selbstabholung|selbstabholer|kein\s+versand|versand\s*:\s*nein|versand\s+nicht\s*möglich)/i.test(html);
    const hasDeliveryAvailable = /(versand\s*möglich|versand\s*:\s*ja|lieferung\s*möglich|lieferung\s*verfügbar|shipping\s*available)/i.test(html);
    const hasVB = /\bVB\b|Verhandlungsbasis/i.test(html);

    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
    const apiUrl = ((import.meta as any).env?.VITE_GEMINI_API_URL as string | undefined) ||
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

    if (apiKey) {
      progressUpdate?.(55, "Отправили запрос в Gemini…");
      const prompt = `Ты аналитик объявлений. Вот HTML страницы объявления:
\n---HTML START---\n${html}\n---HTML END---\n
Извлеки информацию и верни строго JSON без пояснений с полями:
{ "price": число(EUR), "year": число|null, "brand": строка|null, "model": строка|null, "frameSize": строка|null, "wheelDiameter": строка|null, "isNegotiable": boolean, "deliveryOption": "available"|"pickup-only", "description": "Название велосипеда на русском (или английском, если название бренда). Не включай слова 'купить', 'продам' и город." }
Если данных нет — ставь null/false.`;

      const resp = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") || "";
      const clean = stripMarkdownJson(text);
      const parsed = JSON.parse(clean);
      progressUpdate?.(85, "Получили ответ и структурировали данные…");
      const isNegotiable = (typeof parsed?.isNegotiable === 'boolean') ? parsed.isNegotiable : hasVB;
      const candidateDelivery = parsed?.deliveryOption || (hasPickupOnly ? "pickup-only" : (hasDeliveryAvailable ? "available" : "available"));
      const hostForGemini = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      const allowPickupForGemini = hostForGemini.endsWith("kleinanzeigen.de") || hostForGemini.endsWith("pinkbike.com");
      const deliveryOption = allowPickupForGemini ? candidateDelivery : "available";

      return {
        title: parsed?.description || "",
        brand: parsed?.brand || undefined,
        model: parsed?.model || undefined,
        priceEUR: Number(parsed?.price || 0) || undefined,
        location: "",
        image: undefined,
        characteristics: {
          Zustand: isNegotiable ? "VB" : "",
          Rahmenhöhe: parsed?.frameSize || "",
          Baujahr: parsed?.year || "",
          wheelDiameter: parsed?.wheelDiameter || "",
          deliveryOption,
        },
      };
    } else {
      progressUpdate?.(70, "Определяем данные из HTML без Gemini…");
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
        html.match(/<meta[^>]+name=["']title["'][^>]*content=["']([^"']+)["']/i)?.[1];
      const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
      const h1Title = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1];
      const combinedTitle = (ogTitle || pageTitle || h1Title || "").trim();

      const metaPrice = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta[^>]+property=["']og:price:amount["'][^>]*content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta[^>]+name=["']price["'][^>]*content=["']([^"']+)["']/i)?.[1];
      let priceEUR: number | undefined;
      const normalizeNum = (s: string) => {
        const cleaned = s.replace(/[^0-9.,]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(/,(?=\d{2}$)/, ".");
        const n = Number(cleaned);
        return isFinite(n) && n > 0 ? n : undefined;
      };
      if (metaPrice) {
        priceEUR = normalizeNum(metaPrice);
      }
      if (!priceEUR) {
        const m = html.match(/(?:Preis|Price|Цена)[^0-9]{0,10}([0-9]{2,6}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/i)
          || html.match(/([0-9]{2,6}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)\s*(?:€|eur)/i);
        if (m?.[1]) priceEUR = normalizeNum(m[1]);
      }

      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      const allowPickup = host.endsWith("kleinanzeigen.de") || host.endsWith("pinkbike.com");
      const isNegotiable = /\bVB\b|Verhandlungsbasis/i.test(html);
      const hasPickupOnly = /(nur\s*-?\s*abholung|selbstabholung|selbstabholer|kein\s+versand|versand\s*:\s*nein|versand\s+nicht\s*möglich)/i.test(html);
      const deliveryOption = (allowPickup && hasPickupOnly) ? "pickup-only" : "available";

      const titleTokens = combinedTitle.split(/\s+/).filter(Boolean);
      const brand = titleTokens[0] ? titleTokens[0][0].toUpperCase() + titleTokens[0].slice(1) : undefined;
      const model = titleTokens.slice(1, 4).join(" ") || undefined;

      return {
        title: cleanTitle(combinedTitle),
        brand: brand || undefined,
        model: model || undefined,
        priceEUR,
        location: "",
        image: undefined,
        characteristics: {
          Zustand: isNegotiable ? "VB" : "",
          Rahmenhöhe: "",
          Baujahr: "",
          wheelDiameter: "",
          deliveryOption,
        },
      };
    }
  } catch (err) {
    console.warn("Парсинг ссылки не удался:", (err as any)?.message || err);
    return null;
  }
}

export default function CalculatorPage() {
  const [rawText, setRawText] = React.useState("");
  const [detectedUrl, setDetectedUrl] = React.useState<string | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const [info, setInfo] = React.useState<ListingInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = React.useState(false);
  const [parseStage, setParseStage] = React.useState<string>("");
  const [parsePct, setParsePct] = React.useState<number>(0);
  const [mode, setMode] = React.useState<"link" | "manual">("link");
  const [priceInput, setPriceInput] = React.useState<string>("");
  const [showScanFx, setShowScanFx] = React.useState(false);
  const [showWaveReveal, setShowWaveReveal] = React.useState(false);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const debounceRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      if (mode === "link") {
        const url = extractUrl(rawText);
        if (url) {
          setDetectedUrl(normalizeUrl(url));
          setIsScanning(true);
          setShowScanFx(true);
        } else {
          setDetectedUrl(null);
          setInfo(null);
        }
      }
    }, 1000);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [rawText, mode]);

  React.useEffect(() => {
    const run = async () => {
      if (!detectedUrl || mode !== "link") return;
      setIsLoadingInfo(true);
      const data = await fetchListingInfo(detectedUrl, (pct, stage) => { setParsePct(pct); setParseStage(stage); });
      setInfo(data);
      setIsLoadingInfo(false);
      setIsScanning(false);
      setParsePct(100);
      if (data?.priceEUR) {
        setPriceInput(String(Math.round(data.priceEUR)));
      }
      setShowScanFx(false);
      setShowWaveReveal(true);
      window.setTimeout(() => setShowWaveReveal(false), 1200);
      
      const blob = [
        data?.title || "",
        data?.brand || "",
        data?.model || "",
        ...(data?.characteristics ? Object.values(data.characteristics).map(String) : [])
      ].join(" ");
      const char = (data?.characteristics || {}) as Record<string, any>;
      const vbFromChars = /vb/i.test(String(char.Zustand ?? ""));
      const pickupFromChars = String(char.deliveryOption ?? "").toLowerCase() === "pickup-only";
      const statuses = detectStatuses(blob);
      const vb = vbFromChars || statuses.vb;
      const pickup = pickupFromChars || statuses.pickup;
      setIsNegotiable(vb);
      setPickupOnly(pickup);
      setPickupDialogOpen(pickup);
      const frameFromChars = (data?.characteristics as any)?.Rahmenhöhe ?? (data?.characteristics as any)?.frameSize ?? "";
      const yearFromChars = (data?.characteristics as any)?.Baujahr ?? "";
      const frameParsed = parseFrameSize(blob) || (frameFromChars ? String(frameFromChars) : null);
      const yearParsed = parseYear(blob) || (yearFromChars ? String(yearFromChars) : null);
      setFrameSizeBadge(frameParsed || "-");
      setFrameYearBadge(yearParsed || "-");
    };
    run();
  }, [detectedUrl, mode]);

  const RATES = React.useMemo(() => ({
    eur_to_rub: 98.5,
    real_delivery: 220,
    marketing_service_rate: 0.08,
    markup_table: [
      { min: 500, max: 1500, markup: 320 },
      { min: 1500, max: 2500, markup: 400 },
      { min: 2500, max: 3500, markup: 500 },
      { min: 3500, max: 5000, markup: 650 },
      { min: 5000, max: 7000, markup: 800 },
      { min: 7000, max: Infinity, markup: 1000 },
    ],
  }), []);

  const [eurRate, setEurRate] = React.useState<number>(RATES.eur_to_rub);
  const [deliveryBase, setDeliveryBase] = React.useState<number>(0);
  const [serviceRate, setServiceRate] = React.useState<number>(RATES.marketing_service_rate);
  const [isNegotiable, setIsNegotiable] = React.useState(false);
  const [pickupOnly, setPickupOnly] = React.useState(false);
  const [pickupDialogOpen, setPickupDialogOpen] = React.useState(false);
  const [allowDeliveryPremium, setAllowDeliveryPremium] = React.useState(false);
  const [deliveryPremium, setDeliveryPremium] = React.useState(10);
  const [frameSizeBadge, setFrameSizeBadge] = React.useState("-");
  const [frameYearBadge, setFrameYearBadge] = React.useState("-");

  function parseFrameSize(text: string): string | null {
    if (!text) return null;
    const t = text;
    const combo = t.match(/\b(XXL|XL|L|M|S|XS)\s*[\/\-–]\s*(XXL|XL|L|M|S|XS)\b/i);
    if (combo) return `${combo[1].toUpperCase()}/${combo[2].toUpperCase()}`;
    const anchored = t.match(/\b(?:rh|rahmen(?:höhe|gr(?:ö|oe)ße|groesse)?|frame(?:\s*size)?|gr(?:ö|oe)ße|groesse|size)\s*[:\-]?\s*(XXL|XL|L|M|S|XS)\b/i);
    const anchoredSize = anchored ? anchored[1].toUpperCase() : null;
    const paren = t.match(/\((XXL|XL|L|M|S|XS)\)/i);
    const parenSize = paren ? paren[1].toUpperCase() : null;
    const cmMatch = t.match(/\b(\d{2,3}(?:[.,]\d)?)\s*(?:cm|см)\b/i);
    const inchMatch = t.match(/\b(\d{2}(?:[.,]\d)?)\s*(?:\"|”|′|inch|zoll)\b/i);
    const cm = cmMatch ? `${cmMatch[1].replace(',', '.')}cm` : null;
    const inch = inchMatch ? `${inchMatch[1].replace(',', '.')}"` : null;
    const hrMeters = t.match(/(?:geeignet\s*f(?:ür|ur)\s*)?k(?:ö|oe)rpergr(?:ö|oe)sse\s*:?\s*(?:ca\.?\s*)?([0-9][0-9.,]{0,2})\s*m\s*[-–—]\s*([0-9][0-9.,]{0,2})\s*m/i);
    const hrCm = t.match(/(?:geeignet\s*f(?:ür|ur)\s*)?k(?:ö|oe)rpergr(?:ö|oe)sse\s*:?\s*(?:ca\.?\s*)?([0-9]{2,3}(?:[.,]\d)?)\s*cm\s*[-–—]\s*([0-9]{2,3}(?:[.,]\d)?)\s*cm/i);
    let heightSize: string | null = null;
    const toMeters = (s: string) => parseFloat(s.replace(',', '.'));
    const heightToLetter = (h: number) => (h < 1.65 ? 'XS' : h < 1.70 ? 'S' : h < 1.80 ? 'M' : h < 1.90 ? 'L' : 'XL');
    if (hrMeters) {
      const lower = toMeters(hrMeters[1]);
      const upper = toMeters(hrMeters[2]);
      const a = heightToLetter(lower);
      const b = heightToLetter(upper);
      heightSize = a === b ? a : `${a}/${b}`;
    } else if (hrCm) {
      const lower = toMeters(hrCm[1]) / 100;
      const upper = toMeters(hrCm[2]) / 100;
      const a = heightToLetter(lower);
      const b = heightToLetter(upper);
      heightSize = a === b ? a : `${a}/${b}`;
    }
    const letter = anchoredSize || parenSize || null;
    if (letter && (cm || inch)) return `${letter} ${cm || inch}`;
    return (anchoredSize || parenSize || heightSize || cm || inch || null);
  }

  function parseYear(text: string): string | null {
    if (!text) return null;
    const years = text.match(/\b(19|20)\d{2}\b/g);
    if (years) {
      const y = years.map((v) => Number(v)).find((n) => n >= 1990 && n <= 2030);
      return y ? String(y) : null;
    }
    return null;
  }

  function detectStatuses(text: string): { vb: boolean; pickup: boolean } {
    const t = (text || "").toLowerCase();
    const vb = /\bvb\b|verhandlungsbasis/.test(t);
    const pickup = /nur[ -]?abholung|selbstabholung|selbstabholer|kein\s+versand|versand\s*:\s*nein|versand\s+nicht\s*möglich/.test(t);
    return { vb, pickup };
  }

  const getRealMarkup = React.useCallback((bikePrice: number) => {
    if (!Number.isFinite(bikePrice) || bikePrice <= 0) return 0;
    for (const r of RATES.markup_table) {
      if (bikePrice >= r.min && bikePrice < r.max) return r.markup;
    }
    return RATES.markup_table[0].markup;
  }, [RATES]);

  const calculateMarketingBreakdown = React.useCallback((bikePrice: number) => {
    const realMarkup = getRealMarkup(bikePrice);
    const marketingService = bikePrice * serviceRate;
    const markupRemainder = realMarkup - marketingService;
    const deliveryAddition = markupRemainder * 0.4;
    const otherFees = markupRemainder * 0.4;
    const logisticsFees = markupRemainder * 0.2;
    const marketingDelivery = deliveryBase + deliveryAddition;
    const totalEur = bikePrice + marketingService + marketingDelivery + logisticsFees + otherFees;
    const totalRub = totalEur * eurRate;
    return {
      bikePrice,
      serviceCost: marketingService,
      deliveryCost: marketingDelivery,
      logisticsFees,
      otherFees,
      totalEur,
      totalRub,
    };
  }, [getRealMarkup, eurRate, deliveryBase, serviceRate]);

  const effectivePriceEUR = React.useMemo(() => {
    if (mode === "manual") return Number(priceInput || 0);
    return Number(priceInput || info?.priceEUR || 0);
  }, [mode, priceInput, info]);

  const breakdown = React.useMemo(() => calculateMarketingBreakdown(effectivePriceEUR), [effectivePriceEUR, calculateMarketingBreakdown]);

  React.useEffect(() => {
    (async () => { try { const v = await refreshRates(); setEurRate(v); } catch {} })();
    const finalPrice = mode === "manual" ? Number(priceInput || 0) : Number(priceInput || info?.priceEUR || 0);
    if (Number.isFinite(finalPrice) && finalPrice > 0) {
      setDeliveryBase(PricingRates.real_delivery);
    }
  }, [mode, priceInput, info]);

  const handleCheckout = () => {
    if (!breakdown.totalEur) return;
    setCheckoutOpen(true);
  };

  const handleAddToFavorites = () => {
    if (!breakdown.totalEur) return;

    const favKey = 'guestExternalFavorites';
    const link = mode === "link" ? (extractUrl(rawText) || rawText) : `manual-${Date.now()}`;
    
    const data = {
      id: `ext-${Date.now()}`,
      link: link,
      name: info?.title || (mode === "manual" ? `Байк за ${effectivePriceEUR}€` : 'Найденный байк'),
      price: effectivePriceEUR,
      image: info?.image || '',
      totalEur: breakdown.totalEur,
      totalRub: breakdown.totalRub,
      addedAt: Date.now()
    };
    
    try {
      const existing = JSON.parse(localStorage.getItem(favKey) || '[]');
      // Simple duplicate check
      if (!existing.some((x: any) => x.link === link && x.price === effectivePriceEUR)) {
        existing.push(data);
        localStorage.setItem(favKey, JSON.stringify(existing));
        setSuccessMessage("Добавлено в избранное");
      } else {
        setSuccessMessage("Уже в избранном");
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-green-100">
      <SEOHead
        title="Калькулятор стоимости - BikeWerk"
        description="Рассчитайте стоимость доставки велосипеда из Европы в Россию. Введите ссылку на объявление или данные вручную."
        url="https://bikewerk.ru/calculator"
      />
      <BikeflipHeaderPX />
      
      <main className="container mx-auto px-4 pt-12 pb-24 md:pt-20">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-4 leading-[0.9]">
              Калькулятор
              <span className="block text-gray-200">доставки</span>
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-2xl text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed"
          >
            Вставьте ссылку на велосипед из Европы — мы рассчитаем полную стоимость с доставкой, растаможкой и страховкой за секунду.
          </motion.p>
        </div>

        {/* Input Area */}
        <div className="max-w-2xl mx-auto mb-20 relative z-10">
           {/* Mode Switcher */}
           <div className="flex justify-center mb-8">
              <div className="inline-flex bg-gray-50 p-1.5 rounded-full border border-gray-100 shadow-sm">
                <button
                  onClick={() => setMode("link")}
                  className={cn(
                    "px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2",
                    mode === "link" ? "bg-black text-white shadow-md" : "text-gray-500 hover:text-black"
                  )}
                >
                  <LinkIcon className="w-4 h-4" /> По ссылке
                </button>
                <button
                  onClick={() => setMode("manual")}
                  className={cn(
                    "px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2",
                    mode === "manual" ? "bg-black text-white shadow-md" : "text-gray-500 hover:text-black"
                  )}
                >
                  <Edit3 className="w-4 h-4" /> Вручную
                </button>
              </div>
           </div>

           {/* Main Input */}
           <div className="relative group transform transition-all duration-300 hover:scale-[1.01]">
              <div className="absolute -inset-1 bg-gradient-to-r from-green-400 via-emerald-400 to-green-600 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-white rounded-[1.8rem] shadow-xl border border-gray-100 p-2 flex items-center h-20 md:h-24">
                 {mode === "link" ? (
                   <div className="flex-1 flex items-center h-full pl-6 pr-4">
                     <Search className="w-6 h-6 text-gray-400 mr-4 flex-shrink-0" />
                     <input 
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder="https://www.kleinanzeigen.de/..." 
                        className="w-full h-full text-lg md:text-2xl font-medium outline-none placeholder:text-gray-300 bg-transparent"
                     />
                   </div>
                 ) : (
                   <div className="flex-1 flex items-center h-full pl-6 pr-4">
                     <span className="text-2xl md:text-3xl text-gray-400 mr-2 font-bold">€</span>
                     <input 
                        inputMode="numeric"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="1200" 
                        className="w-full h-full text-2xl md:text-4xl font-bold outline-none placeholder:text-gray-200 bg-transparent"
                     />
                   </div>
                 )}
                 
                 {mode === "link" && isScanning && (
                   <div className="pr-6">
                      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                   </div>
                 )}
              </div>
           </div>
           
           {/* Link found notification */}
           <AnimatePresence>
              {detectedUrl && mode === "link" && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-full left-0 w-full mt-4 text-center"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100">
                    <CheckCircle className="w-4 h-4" />
                    Ссылка распознана
                  </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
           
           {/* Left: Bike Info (col-span-7) */}
           <div className="lg:col-span-7 space-y-8">
              
              {/* Scan Animation */}
              <AnimatePresence>
                  {showScanFx && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative overflow-hidden rounded-3xl bg-black text-white p-8 md:p-12"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-blue-500/20 blur-3xl" />
                      <div className="relative z-10 flex flex-col items-center justify-center py-12">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-16 h-16 border-4 border-white/20 border-t-green-500 rounded-full mb-6"
                        />
                        <p className="text-xl font-medium text-white/80">Анализируем объявление...</p>
                        <p className="text-sm text-white/50 mt-2">{parseStage}</p>
                      </div>
                    </motion.div>
                  )}
              </AnimatePresence>

              {/* Info Display */}
              <AnimatePresence mode="wait">
                 {!isLoadingInfo && info && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-8"
                    >
                       <div className="border-l-4 border-black pl-6 py-2">
                          <h2 className="text-3xl md:text-5xl font-bold mb-2 leading-tight">{info.title}</h2>
                          <p className="text-xl text-gray-500">{[info.brand, info.model].filter(Boolean).join(" · ")}</p>
                       </div>

                       <div className="flex flex-wrap gap-3">
                          <div className="px-4 py-2 bg-gray-100 rounded-xl font-medium text-gray-900">
                             Размер: {frameSizeBadge}
                          </div>
                          <div className="px-4 py-2 bg-gray-100 rounded-xl font-medium text-gray-900">
                             Год: {frameYearBadge}
                          </div>
                          {isNegotiable ? (
                             <div className="px-4 py-2 bg-amber-100 text-amber-900 rounded-xl font-medium border border-amber-200">
                               Торг уместен
                             </div>
                          ) : (
                             <div className="px-4 py-2 border border-gray-200 text-gray-500 rounded-xl font-medium">
                               Торга нет
                             </div>
                          )}
                          {pickupOnly ? (
                             <div className="px-4 py-2 bg-red-100 text-red-900 rounded-xl font-medium border border-red-200">
                               Только самовывоз
                             </div>
                          ) : (
                             <div className="px-4 py-2 bg-emerald-100 text-emerald-900 rounded-xl font-medium border border-emerald-200">
                               Доставка доступна
                             </div>
                          )}
                       </div>

                       {/* Characteristics Grid */}
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {/* Render known keys first for better structure */}
                          {['Baujahr', 'Rahmenhöhe', 'wheelDiameter', 'Zustand'].map(key => {
                             const val = info.characteristics?.[key];
                             if (!val) return null;
                             return (
                                <div key={key} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                   <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{translateKey(key)}</div>
                                   <div className="font-semibold text-gray-900 truncate" title={String(val)}>{String(val)}</div>
                                </div>
                             );
                          })}
                          
                          {/* Render remaining keys */}
                          {Object.entries(info.characteristics || {}).map(([key, val]) => {
                             if (['Baujahr', 'Rahmenhöhe', 'wheelDiameter', 'Zustand', 'deliveryOption', 'frameSize', 'year', 'brand', 'model'].includes(key)) return null;
                             if (!val) return null;
                             return (
                                <div key={key} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                   <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{translateKey(key)}</div>
                                   <div className="font-semibold text-gray-900 truncate" title={String(val)}>{String(val)}</div>
                                </div>
                             );
                          })}
                          
                          {info.priceEUR && (
                             <div className="p-4 rounded-2xl bg-black text-white">
                                <div className="text-xs text-white/60 uppercase tracking-wider mb-1">Цена продавца</div>
                                <div className="font-bold text-xl">{info.priceEUR} €</div>
                             </div>
                          )}
                       </div>
                    </motion.div>
                 )}
                 
                 {!isLoadingInfo && !info && !showScanFx && (
                    <motion.div 
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       className="border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center"
                    >
                       <p className="text-gray-400 text-lg">
                          Ожидание данных...
                       </p>
                    </motion.div>
                 )}
              </AnimatePresence>
           </div>

           {/* Right: Pricing (col-span-5) */}
           <div className="lg:col-span-5 sticky top-24">
              <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative">
                 {/* Wave Reveal Effect */}
                 <AnimatePresence>
                  {showWaveReveal && (
                    <motion.div
                      key="wave"
                      initial={{ y: 0 }}
                      animate={{ y: "100%" }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 z-20 bg-black"
                    />
                  )}
                 </AnimatePresence>

                 <div className="p-8 md:p-10 space-y-8">
                    <div>
                       <h3 className="text-lg font-bold text-gray-400 uppercase tracking-widest mb-6">Ваш расчёт</h3>
                       <div className="space-y-4">
                          <div className="flex justify-between items-baseline group">
                             <span className="text-gray-500 group-hover:text-black transition-colors">Цена велосипеда</span>
                             <span className="font-medium text-lg">
                                <CountUp to={Math.round(breakdown.bikePrice || 0)} duration={0.8} /> €
                             </span>
                          </div>
                          <div className="flex justify-between items-baseline group">
                             <span className="text-gray-500 group-hover:text-black transition-colors">Доставка</span>
                             <span className="font-medium text-lg">
                                <CountUp to={Math.round(breakdown.deliveryCost || 0)} duration={0.8} /> €
                             </span>
                          </div>
                          <div className="flex justify-between items-baseline group">
                             <span className="text-gray-500 group-hover:text-black transition-colors">Комиссия сервиса</span>
                             <span className="font-medium text-lg">
                                <CountUp to={Math.round(breakdown.serviceCost || 0)} duration={0.8} /> €
                             </span>
                          </div>
                          <div className="flex justify-between items-baseline group">
                             <span className="text-gray-500 group-hover:text-black transition-colors">Таможня и сборы</span>
                             <span className="font-medium text-lg">
                                <CountUp to={Math.round((breakdown.logisticsFees || 0) + (breakdown.otherFees || 0))} duration={0.8} /> €
                             </span>
                          </div>
                       </div>
                    </div>
                    
                    <div className="pt-8 border-t border-gray-100">
                       <div className="flex justify-between items-end mb-2">
                          <span className="text-xl font-bold text-black">Итого</span>
                          <span className="text-5xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                             <CountUp to={Math.round(breakdown.totalRub || 0)} separator=" " duration={0.8} /> ₽
                          </span>
                       </div>
                       <div className="text-right text-gray-400 font-medium">
                          ≈ <CountUp to={Math.round(breakdown.totalEur || 0)} duration={0.8} /> €
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <Button 
                         className="h-14 rounded-2xl bg-black hover:bg-gray-800 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                         onClick={handleCheckout}
                      >
                         Оформить <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                      <Button 
                         variant="outline" 
                         className="h-14 rounded-2xl border-2 border-gray-200 hover:border-black hover:bg-transparent text-black font-bold text-lg transition-all"
                         onClick={handleAddToFavorites}
                      >
                         В избранное <Heart className="ml-2 w-5 h-5" />
                      </Button>
                   </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Pickup-only info dialog */}
        <Dialog open={pickupDialogOpen} onOpenChange={setPickupDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl border-0 bg-white p-0 overflow-hidden shadow-2xl">
             <div className="bg-gradient-to-br from-emerald-50 to-white p-6 md:p-8">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
                     <Truck className="w-8 h-8" />
                  </div>
                  <DialogTitle className="text-2xl font-bold tracking-tight text-black">
                    Только самовывоз
                  </DialogTitle>
                  <DialogDescription className="text-gray-500 text-base leading-relaxed">
                     Продавец указал, что не отправляет байк.
                  </DialogDescription>
                </div>
             </div>
             
             <div className="p-6 md:p-8 pt-0 space-y-6">
                <p className="text-gray-600 leading-relaxed text-center text-sm">
                   Наши эксперты свяжутся с продавцом и постараются организовать доставку. 
                   В редких случаях может потребоваться доплата за логистику.
                </p>
                
                <div 
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer group select-none",
                    allowDeliveryPremium ? "border-emerald-500 bg-emerald-50/50" : "border-gray-100 hover:border-emerald-200"
                  )}
                  onClick={() => setAllowDeliveryPremium(!allowDeliveryPremium)}
                >
                  <div className={cn(
                    "mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                    allowDeliveryPremium ? "border-emerald-500 bg-emerald-500" : "border-gray-300 group-hover:border-emerald-400"
                  )}>
                    {allowDeliveryPremium && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1">
                     <span className="font-semibold text-gray-900 block mb-1 text-sm">
                       Допустить наценку
                     </span>
                     <span className="text-xs text-gray-500 leading-snug">
                       Я готов доплатить за сложную логистику, если продавец откажется отправлять.
                     </span>
                  </div>
                </div>

                {allowDeliveryPremium && (
                   <div className="space-y-3 bg-gray-50 p-4 rounded-2xl">
                      <div className="flex justify-between text-sm font-medium">
                         <span>Макс. доплата</span>
                         <span>{deliveryPremium} €</span>
                      </div>
                      <Slider 
                         value={[deliveryPremium]} 
                         min={10} 
                         max={500} 
                         step={10} 
                         onValueChange={(v) => setDeliveryPremium(v[0])}
                         className="py-2" 
                      />
                   </div>
                )}

                <Button 
                  className="w-full h-14 rounded-xl text-lg font-bold bg-black text-white hover:bg-emerald-600 transition-all duration-300"
                  onClick={() => setPickupDialogOpen(false)}
                >
                  Понятно
                </Button>
             </div>
          </DialogContent>
        </Dialog>

        <BookingOverlay
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          mode="single"
          items={[{
             id: `calc-${Date.now()}`,
             name: info?.title || (mode === 'manual' ? `Байк за ${effectivePriceEUR}€` : "Найденный велосипед"),
             price: effectivePriceEUR,
             image: info?.image,
             details: {
               brand: info?.brand,
               model: info?.model,
               year: info?.characteristics?.Baujahr ? Number(info.characteristics.Baujahr) : undefined,
             },
             link: mode === "link" ? (extractUrl(rawText) || rawText) : undefined
          }]}
          onSuccess={() => {
             // Optional: redirect to success page or show message
             // BookingOverlay handles its own success state (shows success checkmark)
             // But maybe we want to close it after some time?
             // For now, let it be.
          }}
        />

        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="font-medium">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
