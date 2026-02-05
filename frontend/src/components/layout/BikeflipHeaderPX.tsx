"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Search, CheckCircle2, Heart, ChevronDown, Sparkles, Menu, ShoppingCart, Package } from "lucide-react";
import { AuthTriggerButton as LoginTriggerButton } from "@/components/auth/AuthOverlay";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/context/CartContext";
import { useDrawer } from "@/context/DrawerContext"; // Import Drawer Context


function TopPromoBarPX() {
  return (
    <div className="w-full bg-black text-white text-[12px]">
      <div className="max-w-7xl mx-auto h-9 px-4 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" />
        <span className="whitespace-nowrap">Über 100.000 Fahrräder, Fahrradteile und Zubehör</span>
      </div>
    </div>
  );
}

function MainHeaderPX() {
  const { user, logout } = useAuth();
  const { itemsCount } = useCart();
  const { toggleDrawer } = useDrawer(); // Use context

  return (
    <header className="w-full border-b bg-white relative z-40">
      <div className="max-w-7xl mx-auto h-[80px] px-4 flex items-center justify-start gap-3">
        {/* Left: burger + logo */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="menu" onClick={toggleDrawer}><Menu className="h-5 w-5" /></Button>
          <a href="/" className="flex items-center gap-2">
            <img src="/minilogo11.png" alt="BikeEU" className="h-14 w-14 select-none" />
          </a>
        </div>

        {/* Desktop center: full-width search */}
        <div className="hidden md:flex flex-1 px-6">
          <form
            className="w-full"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem("desktop-search") as HTMLInputElement | null;
              const q = input?.value.trim() || "";
              if (window.location.pathname === "/catalog") {
                window.location.hash = q ? `q=${encodeURIComponent(q)}` : "";
              } else {
                window.location.href = "/catalog" + (q ? `#q=${encodeURIComponent(q)}` : "");
              }
            }}
          >
            <div className="relative max-w-3xl mx-auto w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                name="desktop-search"
                type="search"
                placeholder="Ищите среди 1000+ объявлений со всей европы"
                data-testid="header-search-input"
                className="pl-9 h-11 rounded-full border focus:border-black focus-visible:ring-black"
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
                className="absolute right-2 top-1/2 -translate-y-1/2 h-9 px-4 rounded-full bg-black text-white hover:bg-black/90"
              >
                Найти
              </Button>
            </div>
          </form>
        </div>

        {/* Right: icons + auth */}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="icon" aria-label="favorites" asChild><a href="/favorites"><Heart className="h-5 w-5" /></a></Button>
          <Button variant="ghost" size="icon" aria-label="cart" asChild className="relative">
            <a href="/cart">
              <ShoppingCart className="h-5 w-5" />
              {itemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
                  {itemsCount}
                </span>
              )}
            </a>
          </Button>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full h-10 px-4 text-[14px] hover:bg-slate-100 data-[state=open]:bg-slate-100">
                  {user.name || user.email}
                  <ChevronDown className="ml-2 h-4 w-4 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-56 rounded-xl p-2 shadow-xl border-slate-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 duration-200 ease-out"
              >
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-slate-50">
                  <a href="/sniper" className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-slate-700">Снайпер</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-slate-50">
                  <a href="/order-tracking" className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-slate-700">Отследить заказ</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-slate-50">
                  <a href="/favorites" className="flex items-center gap-3">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span className="font-medium text-slate-700">Избранное</span>
                  </a>
                </DropdownMenuItem>

                <div className="h-px bg-slate-100 my-1 mx-2" />

                <DropdownMenuItem onClick={logout} className="rounded-lg cursor-pointer py-2.5 px-3 text-red-600 focus:text-red-700 focus:bg-red-50">
                  <span className="font-medium">Выйти</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <LoginTriggerButton label="Войти" />
          )}
        </div>


      </div>
    </header>
  );
}

function CategoriesBarPX() {
  const items = [
    { label: "Горячие предложения", href: "/catalog#hot", island: true, icon: <Sparkles className="h-4 w-4" /> },
    { label: "MTB", href: "/catalog#mtb" },
    { label: "Шоссе", href: "/catalog#road" },
    { label: "Гревел", href: "/catalog#gravel" },
    { label: "eMTB", href: "/catalog#emtb" },
    { label: "Детские", href: "/catalog#kids" },
    { label: "Компоненты", href: "/catalog#components" },
  ];
  return (
    <div className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="w-full">
          <ul className="flex flex-wrap items-center justify-center gap-3 py-2">
            {items.map((it) => (
              <li key={it.label} className="flex items-center gap-2">
                {it.icon ? <span className="text-primary/80">{it.icon}</span> : null}
                <a
                  href={it.href}
                  className={
                    it.island
                      ? "text-[13px] px-3 py-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      : "text-[13px] px-2 py-1 rounded hover:bg-muted/40 transition-colors"
                  }
                >
                  {it.label}
                </a>
                {it.badge ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 text-[11px] px-2 py-0.5">{it.badge}</span>
                ) : null}
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
      // Start fading out after 50px scroll, and complete by 210px (160px range)
      const target = Math.max(0, Math.min(1, (y - 50) / 160));
      setProgress(target);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div id="app-header" className="w-full font-dm-sans sticky top-0 z-50" style={{ transform: `translateY(-${progress * 100}%)`, opacity: String(1 - progress), transition: "transform 0s, opacity 0s" }}>
      <TopPromoBarPX />
      <MainHeaderPX />
      {/* Mobile search bar below header */}
      <div className="md:hidden border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem("mobile-search") as HTMLInputElement | null;
              const q = input?.value.trim() || "";
              if (window.location.pathname === "/catalog") {
                window.location.hash = q ? `q=${encodeURIComponent(q)}` : "";
              } else {
                window.location.href = "/catalog" + (q ? `#q=${encodeURIComponent(q)}` : "");
              }
            }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              name="mobile-search"
              type="search"
              placeholder="Ищите среди 1000+ объявлений"
              data-testid="header-search-input-mobile"
              className="pl-9 pr-24 h-11 rounded-full border focus:border-black focus-visible:ring-black text-sm placeholder:text-muted-foreground/80"
              onChange={(e) => {
                const q = e.currentTarget.value.trim();
                if (window.location.pathname === "/catalog") {
                  window.location.hash = q ? `q=${encodeURIComponent(q)}` : "";
                }
              }}
            />
            <Button
              type="submit"
              data-testid="header-search-submit-mobile"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 px-4 rounded-full bg-black text-white hover:bg-black/90"
            >
              Найти
            </Button>
          </form>
        </div>
      </div>
      <div className="hidden md:block"><CategoriesBarPX /></div>
    </div>
  );
}

export default BikeflipHeaderPX;
