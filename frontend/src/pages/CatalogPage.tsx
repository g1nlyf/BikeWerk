"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
 
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
 
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { apiGet } from "@/api";
 
import { SlidersHorizontal, ChevronLeft, ChevronRight, ChevronDown, Star, AlertCircle, CheckCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/Footer";
import { BikeCard, type BikeData as CatalogBikeData } from "@/components/catalog/BikeCard";
import { EmptyCatalogState } from "@/components/catalog/EmptyCatalogState";
import { calculateMarketingBreakdown, refreshRates } from "@/lib/pricing";
import { SEOHead } from "@/components/SEO/SEOHead";


type BikeData = CatalogBikeData;
type SidebarItem = { key: string; label: string; keywords: string[] };
type SidebarGroup = { label: string; value: string; items: SidebarItem[] };
const PAGE_SIZE = 12;
const SHOW_MORE_BATCH = 30;

export default function CatalogPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedType, setSelectedType] = React.useState("all");
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = React.useState("all");
  const [selectedBrands, setSelectedBrands] = React.useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = React.useState("all");
  const [selectedSellerType, setSelectedSellerType] = React.useState("all");
  const [selectedDelivery, setSelectedDelivery] = React.useState("all");
  const [priceRange, setPriceRange] = React.useState([0, 10000]);
  const [sortBy, setSortBy] = React.useState("rank");
  const [currentPage, setCurrentPage] = React.useState(1);
  
  const [bikes, setBikes] = React.useState<BikeData[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAppending, setIsAppending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [availableBrands, setAvailableBrands] = React.useState<string[]>([]);
  const [serverTotal, setServerTotal] = React.useState<number>(0);
  const [filteredTotal, setFilteredTotal] = React.useState<number>(0);
  const [selectedSizes, setSelectedSizes] = React.useState<string[]>([]);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const [selectedSubs, setSelectedSubs] = React.useState<Record<string, string[]>>({});
  const [isHotFilter, setIsHotFilter] = React.useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = React.useState(false);
  const [isMobileSortOpen, setIsMobileSortOpen] = React.useState(false);
  const [mobileCatOpen, setMobileCatOpen] = React.useState<string | null>(null);
  const mobileCatsRef = React.useRef<HTMLDivElement | null>(null);
  const mobileDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const [displayCount, setDisplayCount] = React.useState<number>(PAGE_SIZE);
  const prevFiltersRef = React.useRef<string>("");
  const isRestoring = React.useRef(false);

  // Restore filters from sessionStorage on mount
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem('catalogFilters');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if we are not on a deep link (hash is empty)
        // or if we want to support restoring even with hash (maybe merging?)
        // For now, let's restore if hash is empty, as hash usually implies a specific link.
        if (!window.location.hash) {
          isRestoring.current = true;
          if (parsed.selectedType) setSelectedType(parsed.selectedType);
          if (parsed.selectedTypes) setSelectedTypes(parsed.selectedTypes);
          if (parsed.selectedBrand) setSelectedBrand(parsed.selectedBrand);
          if (parsed.selectedBrands) setSelectedBrands(parsed.selectedBrands);
          if (parsed.selectedStatus) setSelectedStatus(parsed.selectedStatus);
          if (parsed.selectedSellerType) setSelectedSellerType(parsed.selectedSellerType);
          if (parsed.selectedDelivery) setSelectedDelivery(parsed.selectedDelivery);
          if (parsed.priceRange && Array.isArray(parsed.priceRange) && parsed.priceRange.length === 2) {
             setPriceRange(parsed.priceRange);
          }
          if (parsed.selectedSizes) setSelectedSizes(parsed.selectedSizes);
          if (parsed.selectedSubs) setSelectedSubs(parsed.selectedSubs);
          if (parsed.searchQuery) setSearchQuery(parsed.searchQuery);
          if (parsed.sortBy) setSortBy(parsed.sortBy);
          if (parsed.isHotFilter) setIsHotFilter(parsed.isHotFilter);
          if (parsed.currentPage) setCurrentPage(parsed.currentPage);
          
          // Reset restoration flag after a short delay to allow effects to run
          setTimeout(() => { isRestoring.current = false; }, 500);
        }
      }
    } catch (e) {
      console.error("Failed to restore filters", e);
    }
  }, []);

  // Save filters to sessionStorage on change
  React.useEffect(() => {
    const state = {
      selectedType, selectedTypes, selectedBrand, selectedBrands,
      selectedStatus, selectedSellerType, selectedDelivery, priceRange, selectedSizes,
      selectedSubs, searchQuery, sortBy, isHotFilter, currentPage
    };
    sessionStorage.setItem('catalogFilters', JSON.stringify(state));
  }, [selectedType, selectedTypes, selectedBrand, selectedBrands, selectedStatus, selectedSellerType, selectedDelivery, priceRange, selectedSizes, selectedSubs, searchQuery, sortBy, isHotFilter, currentPage]);

  const num = React.useCallback((obj: Record<string, unknown>, key: string) => {
    const v = obj[key];
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, []);
  const str = React.useCallback((obj: Record<string, unknown>, key: string) => String(obj[key] ?? ''), []);
  const applySort = React.useCallback((arr: Record<string, unknown>[]) => {
    if (sortBy === 'price-asc') {
      return arr.slice().sort((a, b) => num(a, 'price') - num(b, 'price'));
    } else if (sortBy === 'price-desc') {
      return arr.slice().sort((a, b) => num(b, 'price') - num(a, 'price'));
    } else if (sortBy === 'savings') {
      const savings = (o: Record<string, unknown>) => num(o, 'original_price') - num(o, 'price');
      return arr.slice().sort((a, b) => savings(b) - savings(a));
    }
    return arr;
  }, [num, sortBy]);

  const buildBaseParams = React.useCallback(() => {
    const base = new URLSearchParams();
    
    // Category filter (mtb, road, gravel, emtb, kids)
    if (selectedType !== 'all') base.set('category', selectedType);
    
    // Brand filter
    if (selectedBrand !== 'all') base.set('brand', selectedBrand);
    
    // Condition filter (new/used)
    if (selectedStatus !== 'all') base.set('status', selectedStatus);
    
    // Search query
    if (searchQuery) base.set('search', searchQuery);
    
    // Price range filter
    if (priceRange[0] > 0) base.set('minPrice', String(priceRange[0]));
    if (priceRange[1] < 10000) base.set('maxPrice', String(priceRange[1]));
    
    // Sorting
    if (sortBy === 'rank') { base.set('sort', 'rank'); base.set('sortOrder', 'DESC'); }
    else if (sortBy === 'price-asc') { base.set('sort', 'price'); base.set('sortOrder', 'ASC'); }
    else if (sortBy === 'price-desc') { base.set('sort', 'price'); base.set('sortOrder', 'DESC'); }
    
    // Hot offers filter
    if (isHotFilter) base.append('hot', 'true');
    
    // Sub-category filters
    const mtbSubs = selectedSubs['mtb'] || [];
    const roadSubs = selectedSubs['road'] || [];
    const gravelSubs = selectedSubs['gravel'] || [];
    const emtbSubs = selectedSubs['emtb'] || [];
    const kidsSubs = selectedSubs['kids'] || [];

    // Map frontend keys to Backend `sub_category` values
    const discMap: Record<string, string> = { enduro: 'enduro', dh: 'dh', trail: 'trail', xc: 'xc' };
    const roadMap: Record<string, string> = { aero: 'aero', endurance: 'endurance', climbing: 'race', tt: 'tt_triathlon' };
    const gravelMap: Record<string, string> = { race: 'race', allroad: 'adventure', bikepacking: 'bikepacking' };
    // Kids filters are wheel sizes, not sub_categories. Handled separately or ignored for sub_category.
    const kidsMap: Record<string, string> = { balance: 'balance', w14: '14', w16: '16', w20: '20', w24: '24' };

    for (const k of mtbSubs) { if (discMap[k]) base.append('sub_category', discMap[k]); }
    for (const k of roadSubs) { if (roadMap[k]) base.append('sub_category', roadMap[k]); }
    for (const k of gravelSubs) { if (gravelMap[k]) base.append('sub_category', gravelMap[k]); }
    
    // For Kids, we might want to filter by wheel_size if supported, or sub_category if defined.
    // Currently prompt sets sub_category=null for kids. 
    // We'll skip sub_category for kids to avoid breaking empty results.
    // for (const k of kidsSubs) { if (kidsMap[k]) base.append('sub_category', kidsMap[k]); }
    
    // eMTB sub-category handling
    for (const k of emtbSubs) { 
      if (k !== 'all') {
        // Map eMTB sub-categories to their DB values
        const emtbMap: Record<string, string> = { trail: 'trail', enduro: 'enduro', xc: 'xc' };
        if (emtbMap[k]) base.append('sub_category', emtbMap[k]); 
      }
    }

    // Size filter
    for (const size of selectedSizes) {
      base.append('size', size);
    }

    // Add Profile Data for Smart Sorting (20% influence)
    try {
        const savedProfile = localStorage.getItem('eubike_user_dna');
        if (savedProfile) {
            const profile = JSON.parse(savedProfile);
            if (profile.disciplines) {
                const topDisciplines = Object.entries(profile.disciplines)
                    .sort(([, a], [, b]) => Number(b) - Number(a))
                    .slice(0, 3)
                    .map(([d]) => d);
                const toCategory = (k: string): string => {
                    const raw = String(k || '').trim();
                    if (!raw) return '';
                    const u = raw.toLowerCase();
                    // Return normalized category values
                    if (u === 'mtb' || u === 'горный' || u.startsWith('mtb ') || u === 'dh' || u === 'downhill' || u === 'enduro' || u === 'trail' || u === 'xc' || u === 'xco') return 'mtb';
                    if (u === 'road' || u === 'шоссейный' || u.startsWith('road ') || u === 'aero' || u === 'endurance' || u === 'climbing' || u === 'tt' || u === 'triathlon' || u === 'granfondo') return 'road';
                    if (u === 'gravel' || u === 'гравийный' || u.startsWith('gravel ') || u === 'race' || u === 'allroad' || u === 'all-road' || u === 'bikepacking') return 'gravel';
                    if (u === 'emtb' || u === 'электро' || u === 'ebike') return 'emtb';
                    if (u === 'kids' || u === 'детский' || u.startsWith('kids ')) return 'kids';
                    return '';
                };
                const cats = Array.from(new Set(topDisciplines.map(toCategory).filter(Boolean)));
                if (cats.length) base.set('profile_disciplines', cats.join(','));
            }
            if (profile.brands) {
                const topBrands = Object.entries(profile.brands)
                    .sort(([, a], [, b]) => Number(b) - Number(a))
                    .slice(0, 3)
                    .map(([b]) => b);
                if (topBrands.length) base.set('profile_brands', topBrands.join(','));
            }
            if (profile.priceSensitivity && profile.priceSensitivity.weightedAverage > 0) {
                base.set('target_price', String(Math.round(profile.priceSensitivity.weightedAverage)));
            }
        }
    } catch (e) { console.warn('Failed to load profile for catalog sort', e); }

    return base;
  }, [selectedType, selectedBrand, selectedStatus, searchQuery, priceRange, sortBy, isHotFilter, selectedSubs, selectedSizes]);

  const sidebarToggles = React.useMemo(() => ([
    { label: "Лучшие предложения", key: "hot" },
  ]), []);

  const sidebarGroups: Record<string, SidebarGroup> = React.useMemo(() => ({
    mtb: {
      label: "MTB",
      value: "mtb",  // Normalized category value for backend
      items: [
        { key: "dh", label: "DH", keywords: ["dh", "downhill"] },
        { key: "enduro", label: "Enduro", keywords: ["enduro"] },
        { key: "trail", label: "Trail", keywords: ["trail"] },
        { key: "xc", label: "XC", keywords: ["xc", "xco", "cross country"] },
      ],
    },
    road: {
      label: "Шоссе",
      value: "road",  // Normalized category value for backend
      items: [
        { key: "aero", label: "Aero", keywords: ["aero"] },
        { key: "endurance", label: "Endurance", keywords: ["endurance", "granfondo"] },
        { key: "climbing", label: "Climbing", keywords: ["climbing", "hill"] },
        { key: "tt", label: "TT/Триатлон", keywords: ["tt", "time trial", "triathlon"] },
      ],
    },
    gravel: {
      label: "Гревел",
      value: "gravel",  // Normalized category value for backend
      items: [
        { key: "race", label: "Race", keywords: ["gravel race", "race"] },
        { key: "allroad", label: "All‑road", keywords: ["all-road", "allroad"] },
        { key: "bikepacking", label: "Bikepacking", keywords: ["bikepacking"] },
      ],
    },
    emtb: {
      label: "eMTB",
      value: "emtb",  // Normalized category value for backend
      items: [
        { key: "all", label: "eMTB", keywords: ["emtb"] },
      ],
    },
    kids: {
      label: "Детские",
      value: "kids",  // Normalized category value for backend
      items: [
        { key: "balance", label: "Balance", keywords: ["balance"] },
        { key: "w14", label: "14\"", keywords: ["14\"", "14 "] },
        { key: "w16", label: "16\"", keywords: ["16\"", "16 "] },
        { key: "w20", label: "20\"", keywords: ["20\"", "20 "] },
        { key: "w24", label: "24\"", keywords: ["24\"", "24 "] },
      ],
    },
  }), []);

  const mobileCats = React.useMemo(() => ([
    { title: 'MTB', value: 'mtb', img: '/mtb11.jpg', hash: '#mtb' },
    { title: 'Road', value: 'road', img: '/Road1.jpg', hash: '#road' },
    { title: 'eBike', value: 'emtb', img: '/emtb1.jpg', hash: '#ebike' },
    { title: 'Kids', value: 'kids', img: '/kids.jpg', hash: '#kids' },
  ]), []);

  const valueToGroupKey = React.useCallback((v: string): string | null => {
    for (const [gk, grp] of Object.entries(sidebarGroups)) {
      if (grp.value === v) return gk;
    }
    return null;
  }, [sidebarGroups]);

  const isAllSelected = React.useCallback((gk: string): boolean => {
    const arr = selectedSubs[gk] || [];
    const items = sidebarGroups[gk]?.items || [];
    if (!items || items.length === 0) return false;
    if (gk === 'emtb') return arr.includes('all');
    return arr.length === items.length;
  }, [selectedSubs, sidebarGroups]);

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (mobileCatOpen) {
        const withinDropdown = mobileDropdownRef.current ? mobileDropdownRef.current.contains(t) : false;
        const withinCats = mobileCatsRef.current ? mobileCatsRef.current.contains(t) : false;
        if (!withinDropdown && !withinCats) setMobileCatOpen(null);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => { window.removeEventListener('pointerdown', onPointerDown); };
  }, [mobileCatOpen]);

  React.useEffect(() => {
    const handle = () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (!hash) return;
      try {
        const h = hash.replace(/^#/, '');
        if (h.startsWith('q=')) {
          const qv = decodeURIComponent(h.slice(2));
          setSearchQuery(qv);
          setCurrentPage(1);
        } else {
          if (h in sidebarGroups) {
            const grp = sidebarGroups[h as keyof typeof sidebarGroups];
            setOpenSections((prev) => ({ ...prev, [h]: true }));
            setSelectedSubs((prev) => ({ ...prev, [h]: grp.items.map((i: SidebarItem) => i.key) }));
          } else {
            if (h === 'ebike') {
              setOpenSections((prev) => ({ ...prev, emtb: true }));
              setSelectedSubs((prev) => ({ ...prev, emtb: ['all'] }));
              setSelectedType('Электро');
            } else {
              const canonical = unifyCategoryFromHash(h);
              if (canonical) setSelectedType(canonical);
            }
          }
          if (h === 'new') setSelectedStatus('new');
          if (h === 'hot') {
            setSortBy('rank');
            setIsHotFilter(true);
          } else {
            setIsHotFilter(false);
            setSortBy('rank');
          }
          setCurrentPage(1);
        }
      } catch { void 0 }
    };
    handle();
    window.addEventListener('hashchange', handle);
    return () => { window.removeEventListener('hashchange', handle); };
  }, [sidebarGroups]);

  

  // Fetch bikes from API when filters change
  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const fetchBikes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Use server-side filtering with buildBaseParams
        const params = buildBaseParams();
        params.set('limit', '500'); // Fetch enough for a decent catalog
        params.set('offset', '0');
        
        const data = await apiGet(`/bikes?${params.toString()}`, { signal: controller.signal });
        
        if (cancelled) return;

        const itemsRaw: unknown[] = Array.isArray((data as Record<string, unknown>)?.bikes) ? (data as Record<string, unknown>).bikes as unknown[] : [];
        let items: Record<string, unknown>[] = itemsRaw.map((x) => (x as Record<string, unknown>));
        
        // Map to internal format
        const mappedAll = items.map(mapOne);
        
        // Apply Client-Side Filtering
        const filtered = mappedAll.filter(bike => {
            // 1. Search Query
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const text = [bike.name, bike.brand, bike.model].join(' ').toLowerCase();
                if (!text.includes(q)) return false;
            }

            // 2. Type/Category
            if (selectedType !== 'all' && bike.type !== selectedType) return false;
            if (selectedTypes.length > 0 && !selectedTypes.includes(bike.type)) return false;

            // 3. Brand
            if (selectedBrand !== 'all' && bike.brand !== selectedBrand) return false;
            if (selectedBrands.length > 0 && !selectedBrands.includes(bike.brand)) return false;

            // 4. Price
            // Use priceEU for filtering
            if (bike.priceEU < priceRange[0] || bike.priceEU > priceRange[1]) return false;

            return true;
        });

        // Apply Sorting
        const sorted = filtered.sort((a, b) => {
            if (sortBy === 'price_asc') return a.priceEU - b.priceEU;
            if (sortBy === 'price_desc') return b.priceEU - a.priceEU;
            // Default: Rank/Hotness
            return (b.ranking_score || 0) - (a.ranking_score || 0);
        });

        setBikes(sorted);
        setServerTotal(items.length); // Total available in DB
        setFilteredTotal(sorted.length); // Total matching filters
        setDisplayCount(PAGE_SIZE);

      } catch (e: any) {
        if (e.name === 'AbortError') return;
        console.error('Catalog fetch error:', e);
        setError(e?.message || 'Не удалось загрузить каталог');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchBikes();
    return () => { 
      cancelled = true; 
      controller.abort();
    };
  }, [selectedType, selectedTypes, selectedBrand, selectedBrands, selectedStatus, selectedSellerType, priceRange, selectedSizes, selectedSubs, searchQuery, sortBy, isHotFilter]);

  // Fetch available brands from API when category/search changes
  React.useEffect(() => {
    const fetchBrands = async () => {
      try {
        const params = new URLSearchParams();
        // Бренды подтягиваем без учета категории
        if (searchQuery) params.set('search', searchQuery);
        const data = await apiGet(`/catalog/brands?${params.toString()}`);
        const list: string[] = Array.isArray(data?.brands) ? data.brands : [];
        setAvailableBrands(list);
        if (selectedBrand !== 'all' && !list.includes(selectedBrand)) {
          setSelectedBrand('all');
        }
      } catch { void 0 }
    };
    fetchBrands();
  }, [selectedType, searchQuery, selectedBrand]);

  React.useEffect(() => { if (!isRestoring.current) setCurrentPage(1); }, [selectedType, selectedTypes, selectedBrand, selectedBrands, selectedStatus, selectedSellerType, priceRange, selectedSizes, selectedSubs, searchQuery, sortBy, isHotFilter]);
  React.useEffect(() => { setDisplayCount(PAGE_SIZE); }, [currentPage, selectedType, selectedTypes, selectedBrand, selectedBrands, selectedStatus, selectedSellerType, priceRange, selectedSizes, selectedSubs, searchQuery, sortBy, isHotFilter]);

  const mapOne = React.useCallback((b: Record<string, unknown>): BikeData => ({
    id: ((): string => {
      const id1 = str(b, 'id');
      const id2 = str(b, 'sourceAdId') || str(b, 'source_ad_id');
      const id3 = str(b, 'originalUrl') || str(b, 'original_url');
      if (id1) return id1;
      if (id2) return id2;
      if (id3) return id3;
      const combo = [str(b, 'brand'), str(b, 'model'), String(Math.round(num(b, 'price')))].filter(Boolean).join('|');
      return combo || String(Math.round(num(b, 'internal_id')) || str(b, 'name'));
    })(),
    name: str(b, 'name'),
    brand: str(b, 'brand'),
    model: str(b, 'model') || str(b, 'name'),
    year: ((): number => {
      const direct = num(b, 'year');
      if (direct) return direct;
      const specs = Array.isArray((b as any).specs) ? (b as any).specs as Array<Record<string, unknown>> : [];
      const raw = ((): string => {
        for (const s of specs) {
          const lbl = String(((s as any).label ?? (s as any).spec_label) || '').toLowerCase().trim();
          if (["год","год выпуска","год производства"].includes(lbl)) {
            return String(((s as any).value ?? (s as any).spec_value) || '').trim();
          }
        }
        return '';
      })();
      const m = raw.match(/\b(20\d{2})\b/);
      return m ? Number(m[1]) : 0;
    })(),
    type: str(b, 'category') || 'other',
    status: Boolean(b['is_new']) ? 'new' : (str(b, 'condition_status') === 'used' ? 'used' : 'available'),
    priceEU: Math.round(num(b, 'price')),
    ...(function(){
      const p = num(b, 'price');
      const { totalEur, totalRub } = calculateMarketingBreakdown(p);
      return { priceWithDelivery: Math.round(totalEur), priceRUB: Math.round(totalRub) };
    })(),
    savings: Math.max(0, num(b, 'original_price') - num(b, 'price')),
    image: ((): string => {
      const main = b['main_image'];
      if (typeof main === 'string' && main) return main;
      const imgs = b['images'];
      if (Array.isArray(imgs)) {
        const first = imgs[0] as unknown;
        if (typeof first === 'string') return first;
        const rec = first as Record<string, unknown> | undefined;
        const url = rec?.['image_url'];
        if (typeof url === 'string') return url;
      }
      return '';
    })(),
    description: str(b, 'description'),
    tags: ((): string[] => {
      const base = Array.isArray(b['features']) ? (b['features'] as string[]) : [];
      const more: string[] = [];
      const d = str(b, 'discipline');
      const sub = str(b, 'sub_category');
      if (d) more.push(d);
      if (sub) more.push(sub);
      return [...base, ...more].map((x) => String(x).toLowerCase());
    })(),
    size: ((): string | undefined => {
      const sizeDirect = b['size'] as string | undefined;
      if (sizeDirect) return String(sizeDirect);
      const specs = Array.isArray((b as any).specs) ? (b as any).specs as Array<Record<string, unknown>> : [];
      for (const s of specs) {
        const lbl = String(((s as any).label ?? (s as any).spec_label) || '').toLowerCase().trim();
        if (["размер","размер рамы","размер велосипеда","рост"].includes(lbl)) {
          const raw = String(((s as any).value ?? (s as any).spec_value) || '').trim();
          if (raw) return raw;
        }
      }
      return undefined;
    })(),
    wheelDiameter: ((): string | undefined => {
      const direct = b['wheel_diameter'] as string | undefined;
      if (direct) return String(direct);
      const specs = Array.isArray((b as any).specs) ? (b as any).specs as Array<Record<string, unknown>> : [];
      const raw = ((): string => {
        for (const s of specs) {
          const lbl = String(((s as any).label ?? (s as any).spec_label) || '').toLowerCase().trim();
          if (["диаметр колес","диаметр колёс","размер колес","размер колёс","диаметр колеса","размер колеса","wheel size"].includes(lbl)) {
            return String(((s as any).value ?? (s as any).spec_value) || '').trim().toLowerCase();
          }
        }
        return '';
      })();
      if (!raw) return undefined;
      const m = raw.match(/(29|27\.5|26|28|24|20)\s*(?:дюйм|дюймов|\"|"|in)?/) || raw.match(/700\s*c/) || raw.match(/650\s*b/);
      if (!m) return raw;
      const v = m[0];
      if (/700\s*c/.test(v)) return '700c';
      if (/650\s*b/.test(v)) return '650b';
      if (v.includes('27.5')) return '27.5"';
      const n2 = v.match(/(29|26|28|24|20)/);
      return n2 ? `${n2[1]}"` : raw;
    })(),
    favoritesCount: typeof b['favorites_count'] === 'number' ? (b['favorites_count'] as number) : undefined,
    isReserviert: Boolean(b['is_reserviert']),
    is_hot: Boolean(b['is_hot'] || b['is_hot_offer']),
    ranking_score: typeof b['ranking_score'] === 'number' ? (b['ranking_score'] as number) : undefined,
    seller: str(b, 'seller_name'),
    sellerType: str(b, 'seller_type'),
    sub_category: str(b, 'sub_category'),
    discipline: str(b, 'discipline'),
    ...(str(b, 'source') ? { source: str(b, 'source') } : {}),
    ...(str(b, 'location') ? { location: str(b, 'location') } : {}),
    ...(str(b, 'shipping_option') ? { shipping_option: str(b, 'shipping_option') } : {}),
  }), [num, str]);

  const loadMoreServer = React.useCallback(async (batch: number) => {
    if (isAppending) return;
    setIsAppending(true);
    try {
      const already = bikes.length;
      const remaining = Math.max(0, serverTotal - already);
      const toFetch = Math.min(batch, remaining);
      if (toFetch <= 0) return;
      const base = buildBaseParams();
      const params = new URLSearchParams(base);
      params.set('limit', String(toFetch));
      params.set('offset', String(already));
      const data = await apiGet(`/catalog/bikes?${params.toString()}`);
      const itemsRaw: unknown[] = Array.isArray((data as Record<string, unknown>)?.bikes) ? (data as Record<string, unknown>).bikes as unknown[] : [];
      let items: Record<string, unknown>[] = itemsRaw.map((x) => (x as Record<string, unknown>));
      items = applySort(items);
      const mapped = items.map(mapOne);
      const seen = new Set(bikes.map((x) => x.id));
      const unique = mapped.filter((x) => !seen.has(x.id));
      setBikes((prev) => [...prev, ...unique]);
      const total = Number(data?.total ?? serverTotal);
      setServerTotal(total);
      setDisplayCount((c) => Math.min(c + unique.length, total));
    } finally {
      setIsAppending(false);
    }
  }, [applySort, bikes.length, buildBaseParams, mapOne, serverTotal, isAppending]);

  const loadAllServer = React.useCallback(async () => {
    if (isAppending) return;
    setIsAppending(true);
    try {
      let already = bikes.length;
      const seen = new Set(bikes.map((x) => x.id));
      const base = buildBaseParams();
      while (already < serverTotal) {
        const batch = Math.min(300, serverTotal - already);
        const params = new URLSearchParams(base);
        params.set('limit', String(batch));
        params.set('offset', String(already));
        const data = await apiGet(`/catalog/bikes?${params.toString()}`);
        const itemsRaw: unknown[] = Array.isArray((data as Record<string, unknown>)?.bikes) ? (data as Record<string, unknown>).bikes as unknown[] : [];
        let items: Record<string, unknown>[] = itemsRaw.map((x) => (x as Record<string, unknown>));
        items = applySort(items);
        const mapped = items.map(mapOne);
        const unique = mapped.filter((x) => !seen.has(x.id));
        setBikes((prev) => [...prev, ...unique]);
        unique.forEach((x) => seen.add(x.id));
        already += unique.length;
        const total = Number(data?.total ?? serverTotal);
        setServerTotal(total);
        setDisplayCount(total);
        if (mapped.length === 0) break;
      }
    } finally {
      setIsAppending(false);
    }
  }, [applySort, bikes.length, buildBaseParams, mapOne, serverTotal, isAppending]);

  

  const filteredBikes = bikes.filter((bike) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = [bike.name, bike.brand, bike.model]
      .some((v) => (v || '').toLowerCase().includes(q));
    const matchesCatMulti = selectedTypes.length === 0 || selectedTypes.includes(bike.type);
    const matchesType = selectedType === "all" || bike.type === selectedType;
    const matchesBrandMulti = selectedBrands.length === 0 || selectedBrands.includes(bike.brand);
    const matchesBrand = selectedBrand === "all" || bike.brand === selectedBrand;
    const matchesStatus = selectedStatus === "all" || bike.status === selectedStatus;
    const matchesDelivery = (() => {
      if (selectedDelivery === "all") return true;
      if (selectedDelivery === "available") return bike.shipping_option === "available";
      if (selectedDelivery === "pickup") return bike.shipping_option === "pickup-only";
      if (selectedDelivery === "guaranteed") return bike.shipping_option === "pickup-only" && (bike.logistics_priority === "medium" || bike.logistics_priority === "high");
      return true;
    })();
    const matchesSellerType = (() => {
      if (selectedSellerType === "all") return true;
      const typeStr = (bike.sellerType || "").toLowerCase();
      const isShop = typeStr.includes("gewerbl");
      if (selectedSellerType === "shop") return isShop;
      if (selectedSellerType === "private") return !isShop;
      return true;
    })();
    const matchesPrice = bike.priceEU >= priceRange[0] && bike.priceEU <= priceRange[1];
    
    // Size normalization: handle letter sizes and cm sizes
    const normalizeSize = (v: string): string => {
      const s = v.trim().toUpperCase().replace(/\s+/g, '');
      // Extract letter sizes
      const letterMatch = s.match(/^(XXS|XS|S|M|L|XL|XXL|XXXL)/);
      if (letterMatch) return letterMatch[1];
      // Extract cm values
      const cmMatch = s.match(/(\d+)\s*CM/i);
      if (cmMatch) return `${cmMatch[1]}CM`;
      return s;
    };
    const matchesSize = selectedSizes.length === 0 || (bike.size ? selectedSizes.some((s) => normalizeSize(s) === normalizeSize(String(bike.size))) : false);
    const textAll = [bike.name, bike.brand, bike.model, bike.description, ...(Array.isArray(bike.tags) ? bike.tags : [])].join(' ').toLowerCase();
    const matchesSubs = (() => {
      const entries = Object.entries(selectedSubs).filter(([, keys]) => keys && keys.length > 0);
      if (entries.length === 0) return true;
      
      // Map frontend sub-category keys to backend sub_category/discipline values
      const subCategoryMap: Record<string, string[]> = {
        // MTB
        'enduro': ['enduro', 'all_mountain'],
        'dh': ['dh', 'downhill'],
        'trail': ['trail', 'trail_riding'],
        'xc': ['xc', 'cross_country'],
        // Road
        'aero': ['aero'],
        'endurance': ['endurance'],
        'climbing': ['race', 'climbing'],
        'tt': ['tt_triathlon', 'triathlon'],
        // Gravel
        'race': ['race', 'gravel_racing'],
        'allroad': ['adventure', 'gravel_adventure'],
        'bikepacking': ['bikepacking'],
        // eMTB
        'all': ['emtb', 'trail', 'enduro', 'xc'], // "all" for eMTB matches any sub
      };
      
      // Collect all selected sub-category values
      const selectedSubCats: string[] = [];
      for (const [, keys] of entries) {
        for (const key of keys) {
          const mappedValues = subCategoryMap[key] || [key];
          selectedSubCats.push(...mappedValues);
        }
      }
      
      // Check if bike's sub_category or discipline matches any selected value
      const bikeSubCat = (bike.sub_category || '').toLowerCase();
      const bikeDiscipline = (bike.discipline || '').toLowerCase();
      
      return selectedSubCats.some(sc => 
        bikeSubCat === sc.toLowerCase() || bikeDiscipline === sc.toLowerCase()
      );
    })();

    return (
      matchesSearch && (matchesBrandMulti && matchesBrand) && matchesStatus && matchesSellerType && matchesDelivery && matchesPrice && matchesSize && matchesSubs
    );
  });

  const activeFiltersCount = [
    selectedType !== "all",
    selectedTypes.length > 0,
    selectedBrands.length > 0 || selectedBrand !== "all",
    selectedStatus !== "all",
    selectedSellerType !== "all",
    selectedDelivery !== "all",
    priceRange[0] !== 0 || priceRange[1] !== 10000,
    selectedSizes.length > 0,
    Object.values(selectedSubs).some((arr) => (arr || []).length > 0),
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedType("all");
    setSelectedTypes([]);
    setSelectedBrand("all");
    setSelectedBrands([]);
    setSelectedStatus("all");
    setSelectedSellerType("all");
    setSelectedDelivery("all");
    setPriceRange([0, 10000]);
    setSearchQuery("");
    setSelectedSizes([]);
    setOpenSections({});
    setSelectedSubs({});
  };

  React.useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { void 0 }
  }, [currentPage, selectedType, selectedTypes, selectedBrand, selectedBrands, selectedStatus, selectedSellerType, priceRange, selectedSizes, selectedSubs, searchQuery, sortBy, isHotFilter]);

  return (
    <div className="min-h-screen bg-background font-dm-sans">
      <SEOHead
        title="Каталог велосипедов - BikeWerk"
        description="Каталог б/у велосипедов премиум-класса с проверкой. MTB, Road, Gravel от Canyon, Specialized, Trek, YT. Гарантия качества, доставка по России."
        keywords="каталог велосипедов б/у, mtb каталог, road велосипеды, gravel бу, canyon бу, specialized бу"
        url="https://bikewerk.ru/catalog"
      />
      <BikeflipHeaderPX />
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-4xl font-bold">Каталог проверенных велосипедов MTB, Road, Gravel</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
          {/* Mobile Categories: Horizontal Scroll with Peek */}
          <div className="lg:hidden mb-2 -mx-4 px-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
             <div className="flex gap-3 w-max pr-8"> {/* pr-8 for end padding */}
                {Object.entries(sidebarGroups).map(([gk, grp]) => {
                   const isActive = selectedType === grp.value;
                   return (
                      <button
                        key={gk}
                        onClick={() => {
                           if (isActive) {
                               setSelectedType("all");
                               setSelectedSubs(prev => { const n = {...prev}; delete n[gk]; return n; });
                           } else {
                               setSelectedType(grp.value);
                               // Reset other subs? No, keep logic simple
                           }
                        }}
                        className={cn(
                           "flex-shrink-0 snap-start rounded-full px-4 py-2 text-sm font-medium border transition-colors",
                           isActive ? "bg-black text-white border-black" : "bg-white text-gray-700 border-gray-200"
                        )}
                      >
                        {grp.label}
                      </button>
                   );
                })}
             </div>
          </div>

          <aside className="hidden lg:block">
            <div>
              <nav className="rounded-2xl border bg-card shadow-sm p-3">
                <ul className="space-y-1.5">
                  {sidebarToggles.map((it) => {
                    const isActive = (it.key === 'hot' && isHotFilter);
                    return (
                      <li key={it.key}>
                        <button
                          type="button"
                          data-testid={`sidebar-${it.key}-toggle`}
                          className={cn("w-full flex items-center justify-between rounded-full px-3 py-2 text-sm",
                            isActive ? "bg-black text-white shadow-sm" : "border hover:bg-muted/50")}
                          onClick={() => {
                            if (it.key === 'hot') {
                              setIsHotFilter((prev) => !prev);
                              setSortBy('rank');
                            }
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <span>{it.label}</span>
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </button>
                      </li>
                    );
                  })}

                  {Object.entries(sidebarGroups).map(([gk, grp]) => {
                    const open = !!openSections[gk] || ((selectedSubs[gk] || []).length > 0);
                    const active = selectedType === grp.value;
                    return (
                      <li key={gk}>
                        <div
                          data-testid={`sidebar-group-${gk}`}
                          className={cn("w-full flex items-center justify-between rounded-full px-3 py-2 text-sm cursor-pointer",
                            active ? "bg-primary text-primary-foreground" : "border hover:bg-muted/50")}
                          onClick={() => setOpenSections((prev) => ({ ...prev, [gk]: !open }))}
                        >
                          <span>{grp.label}</span>
                          <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "rotate-0")} />
                        </div>
                        {open && (
                          <div className="mt-2 space-y-1 px-3">
                            {grp.items.map((it) => (
                              <div key={it.key} className="flex items-center justify-between py-1">
                                <span className="text-xs">{it.label}</span>
                                <Checkbox
                                  data-testid={`sub-checkbox-${gk}-${it.key}`}
                                  checked={(selectedSubs[gk] || []).includes(it.key)}
                                  onCheckedChange={(v) => {
                                    const checked = !!v;
                                    setSelectedSubs((prev) => {
                                      const arr = prev[gk] || [];
                                      const next = checked ? [...arr.filter((x) => x !== it.key), it.key] : arr.filter((x) => x !== it.key);
                                      return { ...prev, [gk]: next };
                                    });
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </aside>

          <div>
            <div className="hidden -mx-4 mb-3 px-4">
              <div className="rounded-2xl border bg-card/80 p-1.5">
                <div className="flex items-center justify-between gap-1 w-full">
                  <Button
                    variant="outline"
                    className="rounded-full h-8 px-2 text-[10px] font-bold border bg-purple-500/10 text-purple-700 border-purple-200 hover:bg-purple-500/20 whitespace-nowrap flex-shrink-0"
                    onClick={() => {
                      setSortBy('rank');
                      window.location.hash = 'hot';
                    }}
                  >
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Лучшие
                  </Button>
                  {Object.entries(sidebarGroups).map(([gk, grp]) => {
                    const active = (selectedSubs[gk] || []).length > 0;
                    return (
                      <DropdownMenu key={gk}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("rounded-full h-8 px-1.5 text-[10px] font-medium border min-w-0 flex-1", active ? "bg-primary text-primary-foreground border-primary" : "bg-background")}
                          >
                            <span className="truncate">{grp.label}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[90vw] max-w-[380px] p-3">
                          <div className="space-y-2">
                            {grp.items.map((it) => (
                              <div key={it.key} className="flex items-center justify-between">
                                <span className="text-sm">{it.label}</span>
                                <Checkbox
                                  checked={(selectedSubs[gk] || []).includes(it.key)}
                                  onCheckedChange={(v) => {
                                    const checked = !!v;
                                    setSelectedSubs((prev) => {
                                      const arr = prev[gk] || [];
                                      const next = checked ? [...arr.filter((x) => x !== it.key), it.key] : arr.filter((x) => x !== it.key);
                                      return { ...prev, [gk]: next };
                                    });
                                  }}
                                />
                              </div>
                            ))}
                            <div className="pt-2 flex items-center justify-between">
                              <Button variant="ghost" size="sm" onClick={() => setSelectedSubs((prev) => ({ ...prev, [gk]: grp.items.map((i) => i.key) }))}>Все</Button>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedSubs((prev) => ({ ...prev, [gk]: [] }))}>Сброс</Button>
                            </div>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="-mx-4 mb-6 px-4 py-4">
              {/* Mobile header: prominent minimal category islands */}
              <div className="md:hidden mb-4" ref={mobileCatsRef}>
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                  {mobileCats.map((c) => (
                    <button
                      key={c.title}
                      className={(() => {
                        const gk = valueToGroupKey(c.value);
                        const black = gk ? isAllSelected(gk) : false;
                        const base = black ? "bg-black text-white border-black ring-2 ring-black/20" : "bg-background text-foreground border";
                        return base + " inline-flex items-center justify-center shrink-0 rounded-2xl border shadow-sm px-5 h-14 min-w-[150px]";
                      })()}
                      onClick={() => {
                        const gk = valueToGroupKey(c.value);
                        if (!gk) { setSelectedType(c.value); return; }
                        if (isAllSelected(gk)) {
                          setSelectedSubs((prev) => ({ ...prev, [gk]: [] }));
                          setSelectedType('all');
                          setMobileCatOpen(null);
                        } else {
                          setSelectedType(c.value);
                          setMobileCatOpen(gk);
                        }
                        try { window.location.hash = c.hash; } catch { void 0 }
                      }}
                      aria-label={c.value}
                    >
                      <span className="text-sm font-semibold tracking-wide">{c.title}</span>
                    </button>
                  ))}
                </div>
                {(function(){
                  if (!mobileCatOpen) return null;
                  const grp = sidebarGroups[mobileCatOpen];
                  if (!grp) return null;
                  const items = grp.items;
                  const sel = selectedSubs[mobileCatOpen] || [];
                  const toggleAll = (checked: boolean) => {
                    if (mobileCatOpen === 'emtb') {
                      setSelectedSubs((prev) => ({ ...prev, emtb: checked ? ['all'] : [] }));
                      setSelectedType(checked ? grp.value : 'all');
                    } else {
                      const allKeys = items.map((i) => i.key);
                      setSelectedSubs((prev) => ({ ...prev, [mobileCatOpen]: checked ? allKeys : [] }));
                      setSelectedType(checked ? grp.value : 'all');
                    }
                  };
                  return (
                    <div ref={mobileDropdownRef} className="mt-3 rounded-3xl border bg-card shadow-lg p-3 backdrop-blur-sm transition-all duration-300 ease-out">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">{grp.label}</span>
                        <Button size="sm" variant="ghost" onClick={() => setMobileCatOpen(null)}>Закрыть</Button>
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center justify-between text-sm">
                          <span>Все</span>
                          <Checkbox
                            checked={isAllSelected(mobileCatOpen)}
                            onCheckedChange={(v) => toggleAll(Boolean(v))}
                          />
                        </label>
                        {items.map((it) => (
                          <label key={it.key} className="flex items-center justify-between text-sm">
                            <span>{it.label}</span>
                            <Checkbox
                              checked={sel.includes(it.key)}
                              onCheckedChange={(v) => {
                                const checked = Boolean(v);
                                setSelectedSubs((prev) => {
                                  const arr = prev[mobileCatOpen] || [];
                                  const next = checked ? Array.from(new Set([...arr, it.key])) : arr.filter((x) => x !== it.key);
                                  return { ...prev, [mobileCatOpen]: next };
                                });
                                setSelectedType(grp.value);
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Mobile: Filters and Sort buttons (left/right) */}
              <div className="lg:hidden mb-3 flex items-center justify-between">
                <Button className="rounded-full pl-4 pr-5" variant="outline" onClick={() => setIsMobileFiltersOpen(true)}>
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Фильтры
                  {activeFiltersCount > 0 ? <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-2 text-xs text-white">{activeFiltersCount}</span> : null}
                </Button>
                <Button className="rounded-full pl-4 pr-5" variant="outline" onClick={() => setIsMobileSortOpen(true)}>
                  Сортировка
                </Button>
              </div>
              <div className="hidden md:block rounded-2xl border bg-card p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={selectedType === 'all' ? undefined : selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-[160px] sm:w-[180px] rounded-full border px-3 sm:px-4 h-10 sm:h-11">
                      <SelectValue placeholder="Тип велосипеда" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mtb">Горный (MTB)</SelectItem>
                      <SelectItem value="road">Шоссейный</SelectItem>
                      <SelectItem value="gravel">Гравийный</SelectItem>
                      <SelectItem value="emtb">Электро (eMTB)</SelectItem>
                      <SelectItem value="kids">Детский</SelectItem>
                    </SelectContent>
                  </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-full border h-9 sm:h-11 px-3 sm:px-4">Марки</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBrands([])}>Сбросить</Button>
                      <span className="text-xs text-muted-foreground">{selectedBrands.length} выбрано</span>
                    </div>
                    <div className="max-h-64 overflow-auto space-y-2">
                      {availableBrands.map((b) => (
                        <div key={b} className="flex items-center justify-between">
                          <span className="text-sm">{b}</span>
                          <Checkbox
                            checked={selectedBrands.includes(b)}
                            onCheckedChange={(v) => {
                              const checked = !!v;
                              setSelectedBrands((prev) => checked ? [...prev.filter((x) => x !== b), b] : prev.filter((x) => x !== b));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Select value={selectedStatus === 'all' ? undefined : selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[130px] sm:w-[150px] rounded-full border px-3 sm:px-4 h-9 sm:h-11">
                    <SelectValue placeholder="Состояние" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="new">Новые</SelectItem>
                    <SelectItem value="used">Б/У</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedSellerType === 'all' ? undefined : selectedSellerType} onValueChange={setSelectedSellerType}>
                  <SelectTrigger className="w-[130px] sm:w-[150px] rounded-full border px-3 sm:px-4 h-9 sm:h-11">
                    <SelectValue placeholder="Продавец" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="private">Частный</SelectItem>
                    <SelectItem value="shop">Магазин</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedDelivery === 'all' ? undefined : selectedDelivery} onValueChange={setSelectedDelivery}>
                  <SelectTrigger className="w-[130px] sm:w-[150px] rounded-full border px-3 sm:px-4 h-9 sm:h-11">
                    <SelectValue placeholder="Доставка" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="available">Доставка доступна</SelectItem>
                    <SelectItem value="pickup">Только самовывоз (?)</SelectItem>
                    <SelectItem value="guaranteed">Гарантированный самовывоз (?)</SelectItem>
                  </SelectContent>
                </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-full border h-9 sm:h-11 px-3 sm:px-4">
                      Размеры{selectedSizes.length > 0 ? ` (${selectedSizes.length})` : ''}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSizes([])}>Сбросить</Button>
                      <span className="text-xs text-muted-foreground">{selectedSizes.length} выбрано</span>
                    </div>
                    {['XS','S','M','L','XL','XXL','50 cm','52 cm','54 cm','56 cm','58 cm','60 cm'].map((s) => (
                      <div key={s} className="flex items-center justify-between py-1">
                        <span className="text-sm">{s}</span>
                        <Checkbox
                          aria-label={s}
                          checked={selectedSizes.includes(s)}
                          onCheckedChange={(v) => {
                            const checked = !!v;
                            setSelectedSizes((prev) => checked ? [...prev.filter((x) => x !== s), s] : prev.filter((x) => x !== s));
                          }}
                        />
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-full border h-9 sm:h-11 px-3 sm:px-4">
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Цена: {priceRange[0]}-{priceRange[1]}€
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80 p-4">
                    <div className="space-y-4">
                      <Label>Диапазон цен (EUR)</Label>
                      <div className="flex items-center gap-2 mb-2">
                         <div className="grid gap-1.5 flex-1">
                            <Input 
                              type="number" 
                              value={priceRange[0]} 
                              onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                              className="h-8 text-xs"
                              placeholder="От"
                            />
                         </div>
                         <div className="grid gap-1.5 flex-1">
                            <Input 
                              type="number" 
                              value={priceRange[1]} 
                              onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                              className="h-8 text-xs"
                              placeholder="До"
                            />
                         </div>
                      </div>
                      <Slider
                        value={priceRange}
                        onValueChange={setPriceRange}
                        max={10000}
                        step={100}
                        className="w-full"
                      />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] sm:w-[200px] rounded-full border px-3 sm:px-4 h-9 sm:h-11">
                    <SelectValue placeholder="Сортировка" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rank">Лучшие предложения</SelectItem>
                    <SelectItem value="date">По дате добавления</SelectItem>
                    <SelectItem value="price-asc">По цене: дешевле</SelectItem>
                    <SelectItem value="price-desc">По цене: дороже</SelectItem>
                    <SelectItem value="savings">По экономии</SelectItem>
                  </SelectContent>
                </Select>

                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" onClick={resetFilters}>
                      Сбросить фильтры ({activeFiltersCount})
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {selectedDelivery === 'pickup' && (
              <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-100 p-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-amber-900">Только самовывоз</h3>
                    <p className="text-sm text-amber-800/80 leading-relaxed max-w-3xl">
                      Некоторые продавцы указывают в своих объявлениях "только самовывоз". Мы собираем только самые выгодные из них - те, ради которых стоит договариваться с продавцом. Наши эксперты свяжутся с продавцом, постараются наладить контакт и убедить отправить велосипед почтой. Иногда для убеждения продавца требуется повышение цены, что бы ему было выгодно покупать упаковочные материалы, тратить время на упаковку и доставлять его до отделения почты. Байки отсюда бронируются бесплатно, т.к. мы не можем гарантировать успешность переговоров.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedDelivery === 'guaranteed' && (
              <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-100 p-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-emerald-900">Гарантированный самовывоз</h3>
                    <p className="text-sm text-emerald-800/80 leading-relaxed max-w-3xl">
                      Это байки, у которых доступен только самовывоз, но они находятся в зоне досягаемости и их наш эксперт сможет в личном порядке забрать для вас у продавца. Эта услуга стоит дополнительных 150 евро.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4 flex items-center justify-between">
              <p className="text-muted-foreground">Показано: {filteredBikes.length} из {serverTotal} велосипедов</p>
              {isLoading ? <span className="text-sm text-muted-foreground">Загрузка…</span> : null}
            </div>

            {error ? (
              <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
                {String(error)}
              </div>
            ) : null}

            {(!isLoading && filteredBikes.length === 0) ? (
              <EmptyCatalogState />
            ) : (
              <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading && filteredBikes.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-lg border bg-card">
                      <div className="aspect-[4/3] bg-muted" />
                      <div className="p-4 space-y-3">
                        <div className="h-5 w-3/4 bg-muted rounded" />
                        <div className="h-4 w-1/2 bg-muted rounded" />
                        <div className="h-4 w-full bg-muted rounded" />
                      </div>
                    </div>
                  ))
                ) : (
                  (function(){
                    const isServerPaging = !(activeFiltersCount > 0 || !!searchQuery);
                    const pageItems = isServerPaging 
                      ? bikes.slice(0, displayCount) 
                      : filteredBikes.slice((currentPage - 1) * PAGE_SIZE, (currentPage - 1) * PAGE_SIZE + displayCount);
                    try { /* debug disabled to avoid scope issues in preview */ } catch { void 0 }
                    return pageItems.map((bike) => (
                      <BikeCard key={bike.id} bike={bike} variant="compact" />
                    ));
                  })()
                )}
              </div>
            )}

            {(filteredBikes.length > 0 || isLoading) && (
              <>
                <div className="mb-6 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const isServerPaging = !(activeFiltersCount > 0 || !!searchQuery);
                      if (isServerPaging) {
                        void loadMoreServer(SHOW_MORE_BATCH);
                      } else {
                        setDisplayCount((c) => Math.min(c + SHOW_MORE_BATCH, filteredBikes.length));
                      }
                    }}
                    disabled={isAppending || (displayCount >= ((activeFiltersCount > 0 || !!searchQuery) ? filteredBikes.length : serverTotal))}
                  >
                    Показать ещё (+{SHOW_MORE_BATCH})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const isServerPaging = !(activeFiltersCount > 0 || !!searchQuery);
                      if (isServerPaging) {
                        void loadAllServer();
                      } else {
                        setDisplayCount(filteredBikes.length);
                      }
                    }}
                    disabled={isAppending || (displayCount >= ((activeFiltersCount > 0 || !!searchQuery) ? filteredBikes.length : serverTotal))}
                  >
                    Загрузить до конца
                  </Button>
                  {isAppending ? <span className="text-sm text-muted-foreground">Загрузка…</span> : null}
                </div>

                <div className="mb-12 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.max(1, Math.min(7, Math.ceil(((activeFiltersCount > 0 || !!searchQuery) ? filteredTotal : serverTotal) / PAGE_SIZE))) }).map((_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= Math.ceil(((activeFiltersCount > 0 || !!searchQuery) ? filteredTotal : serverTotal) / PAGE_SIZE)}
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(((activeFiltersCount > 0 || !!searchQuery) ? filteredTotal : serverTotal) / PAGE_SIZE), p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

          </div>
        </div>
      </main>
      <Dialog open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto left-0 right-0 z-50 h-[85vh] w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl border bg-background p-4 shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-0 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Фильтры</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={resetFilters}>Сбросить</Button>
              <Button onClick={() => setIsMobileFiltersOpen(false)}>Применить</Button>
            </div>
          </DialogTitle>
          <div className="mt-4 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Категории</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(sidebarGroups).map(([gk, grp]) => (
                  <div key={gk} className="rounded-md border p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">{grp.label}</span>
                      <Button size="sm" variant={selectedType === grp.value ? 'default' : 'outline'} onClick={() => setSelectedType(grp.value)}>
                        {grp.value}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {grp.items.map((it) => (
                        <label key={it.key} className="flex items-center justify-between text-sm">
                          <span>{it.label}</span>
                          <Checkbox
                            checked={(selectedSubs[gk] || []).includes(it.key)}
                            onCheckedChange={(v) => {
                              const checked = !!v;
                              setSelectedSubs((prev) => {
                                const list = Array.from(prev[gk] || []);
                                const next = checked ? [...list.filter((x) => x !== it.key), it.key] : list.filter((x) => x !== it.key);
                                return { ...prev, [gk]: next };
                              });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <span className="text-sm font-medium">Марки</span>
              <div className="mt-2 max-h-48 overflow-auto space-y-2">
                {availableBrands.map((b) => (
                  <label key={b} className="flex items-center justify-between text-sm">
                    <span>{b}</span>
                    <Checkbox
                      checked={selectedBrands.includes(b)}
                      onCheckedChange={(v) => {
                        const checked = !!v;
                        setSelectedBrands((prev) => checked ? [...prev.filter((x) => x !== b), b] : prev.filter((x) => x !== b));
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <span className="text-sm font-medium">Тип объявления</span>
              <div className="mt-2 inline-flex rounded-full border bg-background">
                <Button size="sm" variant={selectedStatus === 'all' ? 'default' : 'ghost'} onClick={() => setSelectedStatus('all')}>Все</Button>
                <Button size="sm" variant={selectedStatus === 'new' ? 'default' : 'ghost'} onClick={() => setSelectedStatus('new')}>Новые</Button>
                <Button size="sm" variant={selectedStatus === 'used' ? 'default' : 'ghost'} onClick={() => setSelectedStatus('used')}>Б/У</Button>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <span className="text-sm font-medium">Продавец</span>
              <div className="mt-2 inline-flex rounded-full border bg-background">
                <Button size="sm" variant={selectedSellerType === 'all' ? 'default' : 'ghost'} onClick={() => setSelectedSellerType('all')}>Все</Button>
                <Button size="sm" variant={selectedSellerType === 'private' ? 'default' : 'ghost'} onClick={() => setSelectedSellerType('private')}>Частный</Button>
                <Button size="sm" variant={selectedSellerType === 'shop' ? 'default' : 'ghost'} onClick={() => setSelectedSellerType('shop')}>Магазин</Button>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <span className="text-sm font-medium">Размеры</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {['XS','S','M','L','XL','XXL','48 CM','50 CM','52 CM','54 CM','56 CM','58 CM'].map((s) => (
                  <label key={s} className="flex items-center justify-between text-sm">
                    <span>{s}</span>
                    <Checkbox
                      aria-label={s}
                      checked={selectedSizes.includes(s)}
                      onCheckedChange={(v) => {
                        const checked = !!v;
                        setSelectedSizes((prev) => checked ? [...prev.filter((x) => x !== s), s] : prev.filter((x) => x !== s));
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <span className="text-sm font-medium">Цена (EUR)</span>
              <div className="mt-3 space-y-4">
                <div className="flex items-center gap-2">
                   <div className="grid gap-1.5 flex-1">
                      <Label className="text-xs text-muted-foreground">От</Label>
                      <Input 
                        type="number" 
                        value={priceRange[0]} 
                        onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                        className="h-8 text-xs"
                      />
                   </div>
                   <div className="grid gap-1.5 flex-1">
                      <Label className="text-xs text-muted-foreground">До</Label>
                      <Input 
                        type="number" 
                        value={priceRange[1]} 
                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                        className="h-8 text-xs"
                      />
                   </div>
                </div>
                <Slider value={priceRange} onValueChange={setPriceRange} max={10000} step={100} className="w-full" />
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <span className="text-sm font-medium">Сортировка</span>
              <div className="mt-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full rounded-full border px-4 h-11">
                    <SelectValue placeholder="Сортировка" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rank">Лучшие предложения</SelectItem>
                    <SelectItem value="date">По дате добавления</SelectItem>
                    <SelectItem value="price-asc">По цене: дешевле</SelectItem>
                    <SelectItem value="price-desc">По цене: дороже</SelectItem>
                    <SelectItem value="savings">По экономии</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="pb-2" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile sort dialog */}
      <Dialog open={isMobileSortOpen} onOpenChange={setIsMobileSortOpen}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto left-0 right-0 z-50 h-[55vh] w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl border bg-background p-4 shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-0 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Сортировка</span>
            <Button variant="ghost" onClick={() => setIsMobileSortOpen(false)}>Закрыть</Button>
          </DialogTitle>
          <div className="mt-4 space-y-2">
            {[
              { key: 'rank', label: 'Лучшие предложения' },
              { key: 'date', label: 'По дате добавления' },
              { key: 'price-asc', label: 'По цене: дешевле' },
              { key: 'price-desc', label: 'По цене: дороже' },
              { key: 'savings', label: 'По экономии' },
            ].map((opt) => (
              <Button
                key={opt.key}
                variant={sortBy === opt.key ? 'default' : 'outline'}
                className="w-full rounded-full"
                onClick={() => { setSortBy(opt.key as any); setIsMobileSortOpen(false); }}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}

function unifyCategoryFromHash(hash: string): string | null {
  const h = hash.toLowerCase();
  if (h === 'mtb') return 'Горный';
  if (h === 'road') return 'Шоссейный';
  if (h === 'gravel') return 'Гравийный';
  if (h === 'emtb') return 'Электро';
  if (h === 'ebike') return 'Электро';
  if (h === 'kids') return 'Детский';
  return null;
}
