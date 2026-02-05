"use client";

import * as React from "react";
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { Footer } from "@/components/layout/Footer";
import MiniCatalogBikeflip from "@/components/landing/MiniCatalogBikeflip";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MiniCalculatorSection } from "@/components/landing/MiniCalculatorSection";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import SelectionDialog from "@/components/landing/SelectionDialog";
import { ProcessStepsSection } from "@/components/landing/ProcessStepsSection";
import { Protocol130Section } from "@/components/landing/Protocol130Section";
import { HistoryStorySection } from "@/components/landing/HistoryStorySection";
import { LandingJournalTeaser } from "@/components/landing/LandingJournalTeaser";
import { Card } from "@/components/ui/card";
import { SEOHead } from "@/components/SEO/SEOHead";
import { PageTitle } from "@/components/SEO/PageTitle";

// Полноширинный баннер — изображение из public, всегда на ширину экрана
function TopFullWidthBanner() {
  return (
    <section
      className="relative left-1/2 -translate-x-1/2 w-screen h-auto overflow-visible cursor-pointer"
      aria-label="Hero banner (open catalog)"
      onClick={() => (window.location.href = '/catalog')}
      onKeyDown={(e) => { if (e.key === 'Enter') window.location.href = '/catalog' }}
      role="link"
      tabIndex={0}
    >
      <picture>
        <source media="(max-width: 1024px)" srcSet="/Lanidng2.jpg" />
              <img
          src="/landing.jpg"
          alt="Б/у велосипеды премиум-класса с проверкой - BikeWerk"
          className="block w-screen h-auto object-contain select-none max-w-none"
          draggable={false}
        />
      </picture>
    </section>
  );
}

  function MarketplaceCategoriesSection() {
  const cats = [
    { title: "MTB", img: "/mtb11.jpg" },
    { title: "Road", img: "/Road1.jpg" },
    { title: "eBike", img: "/emtb1.jpg" },
    { title: "Kids", img: "/kids.jpg" },
  ];
  return (
    <section className="container mx-auto px-4 md:px-6 py-16 font-manrope">
      <h2 data-testid="categories-title" className="text-3xl md:text-5xl leading-[1.1] font-extrabold tracking-tight mb-2">Категории</h2>
      <p className="text-muted-foreground text-lg mb-8">Выбирайте по типу велосипеда</p>
      
      {/* Mobile: сетка 2x2 */}
      <div data-testid="categories-grid-mobile" className="grid grid-cols-2 gap-3 md:hidden">
        {cats.map((c) => (
          <a key={c.title} href={`/catalog#${c.title.toLowerCase()}`} className="group relative block overflow-hidden rounded-2xl bg-gray-100">
            <div className="aspect-[4/5] w-full overflow-hidden">
              <img src={c.img} alt={`Купить ${c.title} велосипед б/у - BikeWerk`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
            <div className="absolute bottom-4 left-4">
              <span className="text-white font-bold text-lg tracking-wide">{c.title}</span>
            </div>
          </a>
        ))}
      </div>

      {/* Desktop grid */}
      <div data-testid="categories-grid-desktop" className="hidden md:grid grid-cols-4 gap-6">
        {cats.map((c) => (
          <a key={c.title} href={`/catalog#${c.title.toLowerCase()}`} className="group relative block overflow-hidden rounded-[2rem] bg-gray-100">
            <div className="aspect-[3/4] w-full overflow-hidden">
              <img src={c.img} alt={`Купить ${c.title} велосипед б/у - BikeWerk`} className={
                 (c.title === 'Kids' ? "w-full h-full object-cover object-[50%_50%] scale-[1.06]" : "w-full h-full object-cover") + 
                 " transition-transform duration-700 ease-out group-hover:scale-105"
              } />
            </div>
            {/* Minimalist overlay: just text at bottom, no pill background, just gradient shadow */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-80 transition-opacity duration-300" />
            <div className="absolute bottom-6 left-6">
              <span className="text-white font-extrabold text-2xl tracking-tight">{c.title}</span>
            </div>
            <div className="absolute top-6 right-6 opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
               <div className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white">
                 <ArrowRight className="h-5 w-5" />
               </div>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <Button
          variant="outline"
          className="rounded-full px-8 h-12 text-base font-bold border-2 border-black text-black hover:bg-black hover:text-white transition-all"
          onClick={() => (window.location.href = "/catalog")}
        >
          Все категории →
        </Button>
      </div>
    </section>
  );
}

function OriginsSection() {
  return (
    <section id="origins" className="w-full py-20 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-sm font-semibold text-slate-500">Как всё начиналось</div>
          <h2 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Начинали с Авито. Потом собрали процесс “под ключ”.
          </h2>
          <p className="mt-4 text-base md:text-lg text-slate-600 leading-relaxed">
            Мы начинали как обычные ребята: находили объявления, переписывались с продавцами, ездили смотреть, учились отличать “нормальный вариант”
            от “потом будут проблемы”. Со временем стало понятно: людям нужен не разовый “сделайте скидку”, а спокойный и понятный сервис, который берёт на себя всё.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              title: "Сначала — адекватность",
              text: "Смотрим продавца, детали объявления, задаём правильные вопросы. Если что-то “не так” — не тратим ваше время.",
              icon: <CheckCircle2 className="h-5 w-5 text-slate-700" />
            },
            {
              title: "Потом — проверка по шагам",
              text: "Просим доп. фото/видео, фиксируем нюансы, считаем финальную стоимость “под ключ” до оплаты.",
              icon: <CheckCircle2 className="h-5 w-5 text-slate-700" />
            },
            {
              title: "И только потом — выкуп и доставка",
              text: "Берём на себя логистику и оформление. Вы получаете велосипед, а не переписки, риски и сюрпризы.",
              icon: <CheckCircle2 className="h-5 w-5 text-slate-700" />
            },
          ].map((i) => (
            <Card key={i.title} className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-50 border border-black/10 flex items-center justify-center">
                  {i.icon}
                </div>
                <div className="text-base md:text-lg font-extrabold tracking-tight text-slate-900">{i.title}</div>
              </div>
              <div className="mt-4 text-sm md:text-base text-slate-600 leading-relaxed">{i.text}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function NoJunkSection() {
  return (
    <section id="no-junk" className="w-full py-20 bg-muted/20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-sm font-semibold text-slate-500">Хлам? Не к нам!</div>
          <h2 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Отсеиваем “хлам” ещё до выкупа
          </h2>
          <p className="mt-4 text-base md:text-lg text-slate-600 leading-relaxed">
            Мы не берём в работу сомнительные объявления. Если есть риск “переиграть и проиграть” — честно скажем и предложим альтернативы.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              title: "Проверяем продавца",
              text: "Адекватность общения, история профиля, совпадение деталей, готовность дать видео/доп. фото.",
              icon: <CheckCircle2 className="h-5 w-5 text-slate-700" />
            },
            {
              title: "Проверяем объявление",
              text: "Комплектация, состояние узлов, признаки ремонта/падений, корректность цены относительно рынка.",
              icon: <CheckCircle2 className="h-5 w-5 text-slate-700" />
            },
            {
              title: "Фиксируем договорённости",
              text: "Чтобы “в пути” ничего не поменялось: согласуем детали и стоимость заранее, без неожиданностей.",
              icon: <CheckCircle2 className="h-5 w-5 text-slate-700" />
            },
            {
              title: "Не понравилось — не берём",
              text: "Если есть красные флаги, лучше пропустить вариант и найти следующий, чем чинить последствия.",
              icon: <CheckCircle2 className="h-5 w-5 text-slate-700" />
            },
          ].map((i) => (
            <Card key={i.title} className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-50 border border-black/10 flex items-center justify-center">
                  {i.icon}
                </div>
                <div className="text-base md:text-lg font-extrabold tracking-tight text-slate-900">{i.title}</div>
              </div>
              <div className="mt-4 text-sm md:text-base text-slate-600 leading-relaxed">{i.text}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function TransparentControlSection() {
  const items = [
    {
      title: "Фиксируем цену заранее",
      text: "Считаем стоимость “под ключ” до оплаты и согласуем её с вами. Без сюрпризов “по дороге”.",
    },
    {
      title: "Показываем, что происходит",
      text: "Пишем по делу: что подтвердили у продавца, что проверили, на каком этапе сейчас заказ.",
    },
    {
      title: "Проверка и фотоотчёт",
      text: "На складе проверяем состояние и комплектность. При необходимости — переупаковка перед отправкой.",
    },
    {
      title: "Один менеджер на связь",
      text: "Вы всегда знаете, кому написать. Вопросы по документам, доставке и срокам — без “перекидываний”.",
    },
  ];

  return (
    <section id="transparent" className="w-full py-20 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-sm font-semibold text-slate-500">Прозрачно и под контролем</div>
          <h2 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Вы видите весь путь — от объявления до двери
          </h2>
          <p className="mt-4 text-base md:text-lg text-slate-600 leading-relaxed">
            Мы не “просто привозим”. Мы делаем так, чтобы вы понимали каждый шаг и чувствовали спокойствие.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((i) => (
            <Card key={i.title} className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-50 border border-black/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-slate-700" />
                </div>
                <div className="text-base md:text-lg font-extrabold tracking-tight text-slate-900">{i.title}</div>
              </div>
              <div className="mt-4 text-sm md:text-base text-slate-600 leading-relaxed">{i.text}</div>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Button
            variant="outline"
            className="rounded-full px-8 h-12 text-base font-bold border-2 border-black text-black hover:bg-black hover:text-white transition-all"
            onClick={() => (window.location.href = "/about")}
          >
            Подробнее о процессе →
          </Button>
        </div>
      </div>
    </section>
  );
}



export default function TestBikeflipLanding2() {
  React.useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash ? window.location.hash.slice(1) : "";
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <>
      <SEOHead
        title="BikeWerk — Проверенные б/у велосипеды из Европы | MTB, Road, Gravel"
        description="Купить проверенные б/у велосипеды премиум-класса из Европы. MTB, Road, Gravel от Canyon, Specialized, Trek. Профессиональная проверка, гарантия качества, доставка по России. Цены от 50 000₽."
        keywords="купить велосипед б/у, mtb бу, canyon бу, specialized бу, велосипеды москва, gravel бу, road бу, велосипеды из европы, проверенные велосипеды"
        url="https://bikewerk.ru"
      />
      {/* Пиксель‑перфект хедер для тестовой страницы */}
      <BikeflipHeaderPX />
      <main className="min-h-screen pt-6">
        {/* H1 для SEO - скрыт визуально, но доступен для поисковиков */}
        <h1 className="sr-only">Б/у велосипеды премиум-класса с проверкой - BikeWerk</h1>
        {/* 1. Hero-баннер */}
        <TopFullWidthBanner />

        {/* 2. Мини-каталог "Горячие предложения" */}
        <MiniCatalogBikeflip />

        {/* 3. Категории */}
        <MarketplaceCategoriesSection />

        {/* 4. Мини-калькулятор */}
        <MiniCalculatorSection />

        {/* 5. Процесс (4 этапа) */}
        <ProcessStepsSection />

        {/* 6. Протокол 130 */}
        <Protocol130Section />

        {/* 7. Отзывы */}
        <ReviewsSection />

        {/* 8. Founder Story "Как мы начинали" */}
        <HistoryStorySection />

        {/* 9. Журнал + FAQ */}
        <LandingJournalTeaser />

        {/* 10. Футер */}
        <Footer />
        <SelectionDialog />
      </main>
    </>
  );
}
