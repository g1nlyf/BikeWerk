"use client";

import * as React from "react";
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { Footer } from "@/components/layout/Footer";
import MiniCatalogSection from "@/components/landing/MiniCatalogSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { NavigationMenu, NavigationMenuList } from "@/components/ui/navigation-menu";
import { Bike, ShieldCheck, Star, Search, Users } from "lucide-react";

function TopPromoBar() {
  return (
    <div className="w-full bg-black text-white text-[12px]">
      <div className="max-w-7xl mx-auto h-9 px-4 flex items-center gap-6 overflow-x-auto">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Star className="h-4 w-4 text-green-400" />
          <span className="font-medium">Отличный рейтинг</span>
          <span className="text-muted-foreground/80">• Trustpilot ★★★★★</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Bike className="h-4 w-4 text-primary" />
          <span>100 000+ велосипедов, деталей и аксессуаров</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Users className="h-4 w-4" />
          <span>1 000 000+ велоэнтузиастов в Европе</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <ShieldCheck className="h-4 w-4" />
          <span>Безопасная доставка и защита покупателя</span>
        </div>
      </div>
    </div>
  );
}

function CategoryNav() {
  const items = [
    { label: "Велоспорт", href: "/catalog#sport" },
    { label: "Популярные бренды", href: "/catalog#brands" },
    { label: "Шоссе и гравий", href: "/catalog#road-gravel" },
    { label: "MTB", href: "/catalog#mtb" },
    { label: "Детали", href: "/catalog#parts" },
    { label: "Аксессуары и одежда", href: "/catalog#gear" },
    { label: "Бег", href: "/catalog#run" },
    { label: "Новинки", href: "/catalog#new" },
    { label: "Зимний спорт", href: "/catalog#winter" },
    { label: "Ещё", href: "/catalog" },
  ];
  return (
    <div className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4">
        <NavigationMenu className="w-full">
          <NavigationMenuList className="flex flex-wrap gap-1 py-2">
            {items.map((it) => (
              <Button key={it.label} asChild variant="ghost" size="sm" className="text-[13px]">
                <a href={it.href}>{it.label}</a>
              </Button>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </div>
  );
}

function TopFullWidthBanner() {
  return (
    // «Полноширинный» баннер. Обёртка выносит изображение из любого контейнера и растягивает на ширину вьюпорта.
    <section
      className="relative left-1/2 -translate-x-1/2 w-screen overflow-hidden"
      aria-label="Акционный баннер"
    >
      <img
        src="/landing.jpg"
        alt="До твоего байка из Европы — два клика!"
        className="block w-full h-auto select-none"
        draggable={false}
      />
    </section>
  );
}

function BrandRow() {
  const brands = ["BikeEU", "EUBike", "VELOX", "ROADPRO", "MTBGEAR", "NORDIC", "TREKX"];
  return (
    <section className="container mx-auto px-4 md:px-6 py-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {brands.map((b) => (
          <Card key={b} className="p-4 text-center font-semibold">
            {b}
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function TestBuycycleLanding() {
  return (
    <>
      <TopPromoBar />
      <BikeflipHeaderPX />
      <CategoryNav />

      <main className="min-h-screen pt-6">
        <TopFullWidthBanner />

        {/* Горячие предложения — используем мини-каталог */}
        <MiniCatalogSection />

        {/* Подобие блока "Новые объявления" можно повторно показать мини-каталог */}
        <section className="container mx-auto px-4 md:px-6">
          <div className="mb-4 flex items-end justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Бренд‑новые объявления</h2>
              <p className="text-sm text-muted-foreground">Свежие поступления от проверенных продавцов</p>
            </div>
            <Button variant="link" onClick={() => (window.location.href = "/catalog")}>Перейти в каталог →</Button>
          </div>
        </section>

        <MiniCatalogSection />

        {/* Ряд наших логотипов вместо оригинальных */}
        <BrandRow />

        <section className="container mx-auto px-4 md:px-6 pb-8">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Гарантия безопасной покупки</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Мы сопровождаем покупку от оплаты до доставки. Все велосипеды проверяются и страхуются.
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bike className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Быстрая логистика по Европе и РФ</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Оптимальные сроки благодаря отлаженной цепочке поставки. Реальное время доставки — от 7 дней.
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Отличные цены и горячие предложения</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Актуальные скидки и спец‑предложения. Мини‑каталог подбирает лучшие варианты автоматически.
              </p>
            </Card>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}