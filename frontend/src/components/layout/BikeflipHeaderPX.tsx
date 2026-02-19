"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Search, CheckCircle2, Heart, ChevronDown, Sparkles, Menu, Package } from "lucide-react";
import { AuthTriggerButton as LoginTriggerButton } from "@/components/auth/AuthOverlay";
import { useAuth } from "@/lib/auth";
import { useDrawer } from "@/context/DrawerContext";
import { Link } from "react-router-dom";

function TopPromoBarPX() {
  return (
    <div className="w-full bg-black text-white text-[12px]">
      <div className="max-w-7xl mx-auto h-9 px-4 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" />
        <span className="whitespace-nowrap">Более 100 000 велосипедов на выбор. Доставка в РФ.</span>
      </div>
    </div>
  );
}

function MainHeaderPX() {
  const { user, logout } = useAuth();
  const { toggleDrawer } = useDrawer();

  return (
    <header className="w-full bg-white border-b">
      {/* Row 1: Primary + Secondary Navigation - FULL WIDTH */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-11 md:h-14">
            {/* Navigation (desktop structure, adaptive overflow on mobile) */}
            <nav className="no-scrollbar flex w-full items-center gap-4 overflow-x-auto whitespace-nowrap md:justify-center md:gap-6">
              {/* Primary Navigation - Bold */}
              <Link
                to="/catalog"
                className="text-[15px] font-bold text-foreground hover:text-foreground/80 transition-colors"
              >
                Каталог
              </Link>
              <Link
                to="/sniper"
                className="text-[15px] font-bold text-foreground hover:text-foreground/80 transition-colors"
              >
                Подбор
              </Link>

              {/* Divider */}
              <div className="h-6 w-[1.5px] bg-border" />

              {/* Secondary Navigation with dots */}
              <Link
                to="/how-it-works"
                className="text-[14px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Как это работает
              </Link>
              <span className="text-muted-foreground/40">•</span>
              <Link
                to="/guarantees"
                className="text-[14px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Гарантии
              </Link>
              <span className="text-muted-foreground/40">•</span>
              <Link
                to="/delivery"
                className="text-[14px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Доставка
              </Link>
              <span className="text-muted-foreground/40">•</span>
              <Link
                to="/documents"
                className="text-[14px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Документы
              </Link>
              <span className="text-muted-foreground/40">•</span>
              <Link
                to="/faq"
                className="text-[14px] text-muted-foreground hover:text-foreground transition-colors"
              >
                FAQ
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Row 2: Burger + Logo + Search + Actions */}
      <div className="max-w-7xl lg:max-w-[1220px] mx-auto px-4 py-3 md:py-4">
        <div className="flex items-center justify-center gap-2">
          {/* Left: Burger + Logo */}
          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <Button variant="ghost" size="icon" aria-label="menu" onClick={toggleDrawer} className="h-9 w-9 md:h-10 md:w-10">
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center shrink-0">
              <img src="/minilogo11.png" alt="BikeWerk" className="h-9 w-9 md:h-11 md:w-11 select-none object-contain" />
            </Link>
          </div>

          {/* Center: Search Bar in the same row on all breakpoints */}
          <div className="min-w-0 flex-1 lg:max-w-[920px]">
            <form
              className="w-full"
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("header-search") as HTMLInputElement | null;
                const q = input?.value.trim() || "";
                if (window.location.pathname === "/catalog") {
                  window.location.hash = q ? `q=${encodeURIComponent(q)}` : "";
                } else {
                  window.location.href = "/catalog" + (q ? `#q=${encodeURIComponent(q)}` : "");
                }
              }}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  name="header-search"
                  type="search"
                  placeholder="Ищите среди 1000+ объявлений"
                  data-testid="header-search-input"
                  className="pl-9 pr-20 h-10 md:h-11 text-sm md:text-[14px] rounded-full border focus:border-black focus-visible:ring-black"
                  onChange={(e) => {
                    const q = e.currentTarget.value.trim();
                    if (window.location.pathname === "/catalog") {
                      window.location.hash = q ? `q=${encodeURIComponent(q)}` : "";
                    }
                  }}
                />
                <Button
                  type="submit"
                  data-testid="header-search-submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-4 md:px-5 rounded-full bg-black text-white hover:bg-black/90 text-sm md:text-[13px] font-medium"
                >
                  Найти
                </Button>
              </div>
            </form>
          </div>

          {/* Right: Favorites + User */}
          <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
            <Button variant="ghost" size="icon" aria-label="favorites" asChild className="hidden sm:inline-flex h-9 w-9 md:h-10 md:w-10">
              <Link to="/favorites"><Heart className="h-5 w-5" /></Link>
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="rounded-full h-9 md:h-10 max-w-[8.5rem] md:max-w-[13rem] px-2.5 md:px-4 text-[13px] md:text-[14px] hover:bg-slate-100 data-[state=open]:bg-slate-100"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white text-[11px] font-semibold mr-1.5">
                      {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate hidden md:inline">{user.name || user.email}</span>
                    <ChevronDown className="ml-1 h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-xl p-2 shadow-xl">
                  <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-slate-50">
                    <Link to="/sniper" className="flex items-center gap-3">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-slate-700">Снайпер</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-slate-50">
                    <Link to="/order-tracking" className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium text-slate-700">Отследить заказ</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-slate-50">
                    <Link to="/favorites" className="flex items-center gap-3">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-slate-700">Избранное</span>
                    </Link>
                  </DropdownMenuItem>
                  <div className="h-px bg-slate-100 my-1 mx-2" />
                  <DropdownMenuItem onClick={logout} className="rounded-lg cursor-pointer py-2.5 px-3 text-red-600 focus:text-red-700 focus:bg-red-50">
                    <span className="font-medium">Выйти</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <LoginTriggerButton label="Войти" className="h-9 md:h-10 px-3 md:px-4 rounded-full" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function CategoriesBarPX() {
  const items = [
    { label: "Горячие предложения", href: "/catalog#hot", island: true, icon: <Sparkles className="h-3.5 w-3.5" /> },
    { label: "MTB", href: "/catalog#mtb" },
    { label: "Шоссе", href: "/catalog#road" },
    { label: "Гревел", href: "/catalog#gravel" },
    { label: "eMTB", href: "/catalog#emtb" },
    { label: "Детские", href: "/catalog#kids" },
    { label: "Компоненты", href: "/catalog#components" },
  ] as { label: string; href: string; island?: boolean; icon?: React.ReactNode }[];

  return (
    <div className="border-t bg-background">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="w-full no-scrollbar overflow-x-auto">
          <ul className="flex w-max min-w-full items-center justify-start md:justify-center gap-4 py-2.5 whitespace-nowrap">
            {items.map((it) => (
              <li key={it.label} className="flex items-center gap-1.5">
                {it.icon ? <span className="text-primary">{it.icon}</span> : null}
                <Link
                  to={it.href}
                  className={
                    it.island
                      ? "text-[13px] font-medium px-4 py-1.5 rounded-full bg-black text-white hover:bg-black/90 transition-colors"
                      : "text-[13px] font-normal text-foreground hover:text-foreground/70 transition-colors"
                  }
                >
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export function BikeflipHeaderPX() {
  const [progress, setProgress] = React.useState(0);
  const lastY = React.useRef<number>(0);

  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      lastY.current = y;
      const target = Math.max(0, Math.min(1, (y - 50) / 160));
      setProgress(target);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      id="app-header"
      className="w-full font-dm-sans sticky top-0 z-50"
      style={{
        transform: `translateY(-${progress * 100}%)`,
        opacity: String(1 - progress),
        transition: "transform 0s, opacity 0s"
      }}
    >
      <TopPromoBarPX />
      <MainHeaderPX />
      <CategoriesBarPX />
    </div>
  );
}

export default BikeflipHeaderPX;
