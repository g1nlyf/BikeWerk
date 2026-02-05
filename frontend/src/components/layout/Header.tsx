"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Bike, Heart, ShoppingCart, Menu, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AuthTriggerButton as LoginTriggerButton } from "@/components/auth/AuthOverlay";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import MiniCartContent from "@/components/cart/MiniCartContent";
import { useCartUI } from "@/lib/cart-ui";
import { useCart } from "@/context/CartContext";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { user, logout } = useAuth();
  const { open, setOpen } = useCartUI();
  const { itemsCount } = useCart();


  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 mobile-safe grid grid-cols-[1fr_auto_1fr] items-center h-16 gap-4">
          {/* Left: logo + nav */}
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-2">
              <Bike className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl">BikeEU</span>
            </a>
            {/* Навигационные пункты удалены по требованию */}
          </div>

          {/* Center: search */}
          <div className="hidden md:flex justify-center justify-self-center w-full">
            <form
              className="w-full md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl"
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("header-search") as HTMLInputElement | null;
                const q = input?.value.trim();
                window.location.href = "/catalog" + (q ? `#q=${encodeURIComponent(q)}` : "");
              }}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  name="header-search"
                  type="search"
                  placeholder="Поиск по каталогу"
                  className="pl-9 h-11 rounded-full border"
                />
              </div>
            </form>
          </div>
          {/* Right: actions (desktop) */}
          <div className="hidden md:flex items-center gap-4 justify-end">
            <Button variant="ghost" size="icon" asChild>
              <a href="/favorites" aria-label="favorites"><Heart className="h-5 w-5" /></a>
            </Button>
            <DropdownMenu open={open} onOpenChange={setOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="cart" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {itemsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
                      {itemsCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" className="p-2">
                <MiniCartContent />
              </DropdownMenuContent>
            </DropdownMenu>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{user.name || user.email}</span>
                <Button variant="outline" size="sm" onClick={logout}>
                  Выйти
                </Button>
              </div>
            ) : (
              <LoginTriggerButton />
            )}
          </div>
          {/* Right: mobile toggle */}
          <div className="flex md:hidden justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="toggle-mobile-menu"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden border-b bg-background p-4">
          <nav className="flex flex-col gap-4" />
        </div>
      )}
    </>
  );
}

export default Header;