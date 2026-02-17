"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Bike, Heart, ShoppingCart, Menu, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AuthTriggerButton as LoginTriggerButton } from "@/components/auth/AuthOverlay";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import MiniCartContent from "@/components/cart/MiniCartContent";
import { useCartUI } from "@/lib/cart-ui";
import { useCart } from "@/context/CartContext";
import { Link } from "react-router-dom";
import { useDrawer } from "@/context/DrawerContext";

export function Header() {
  const { user, logout } = useAuth();
  const { open, setOpen } = useCartUI();
  const { itemsCount } = useCart();
  const { openDrawer } = useDrawer();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 mobile-safe">
        {/* Top Row: Logo + Navigation + Actions */}
        <div className="flex items-center justify-between h-16 gap-6">
          {/* Left: Logo + Mobile Menu */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={openDrawer}
              className="md:hidden"
              aria-label="menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo - Larger size */}
            <Link to="/" className="flex items-center gap-2.5">
              <Bike className="h-8 w-8 text-primary" />
              <span className="font-bold text-2xl hidden sm:inline">BikeWerk</span>
            </Link>
          </div>

          {/* Center: Navigation Links - Desktop Only */}
          <nav className="hidden lg:flex items-center gap-1">
            {/* Primary Navigation - Bold */}
            <Link
              to="/catalog"
              className="px-4 py-2 text-sm font-bold text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Каталог
            </Link>
            <Link
              to="/sniper"
              className="px-4 py-2 text-sm font-bold text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Подбор
            </Link>

            {/* Divider */}
            <div className="h-6 w-px bg-border mx-2" />

            {/* Secondary Navigation - Muted */}
            <Link
              to="/how-it-works"
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              Как это работает
            </Link>
            <Link
              to="/guarantees"
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              Гарантии
            </Link>
            <Link
              to="/delivery"
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              Доставка
            </Link>
            <Link
              to="/documents"
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              Документы
            </Link>
          </nav>

          {/* Right: User Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="hidden sm:flex">
              <Link to="/favorites" aria-label="favorites">
                <Heart className="h-5 w-5" />
              </Link>
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
              <div className="hidden md:flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{user.name || user.email}</span>
                <Button variant="outline" size="sm" onClick={logout}>
                  Выйти
                </Button>
              </div>
            ) : (
              <div className="hidden md:block">
                <LoginTriggerButton />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row: Search Bar - Desktop/Tablet */}
        <div className="hidden md:flex items-center justify-center pb-4 pt-2">
          <form
            className="w-full max-w-3xl"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem("header-search") as HTMLInputElement | null;
              const q = input?.value.trim();
              window.location.href = "/catalog" + (q ? `#q=${encodeURIComponent(q)}` : "");
            }}
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                name="header-search"
                type="search"
                placeholder="Поиск по каталогу — модель, бренд, тип велосипеда..."
                className="pl-12 h-12 text-base rounded-full border-2 focus-visible:ring-2"
              />
            </div>
          </form>
        </div>
      </div>
    </header>
  );
}

export default Header;