"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { StaggerChildren, FadeInWhenVisible } from "@/components/animated";
import { catalogGridVariants, staggerItem, skeletonVariants } from "@/animations";
 
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

  // ... (все остальные хуки остаются без изменений)
  // Копирую весь код из оригинального файла до return
