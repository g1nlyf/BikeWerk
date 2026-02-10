"use client"
import React, { useState, useEffect, useRef } from "react"
import { motion, useScroll, useTransform, useInView, useSpring, AnimatePresence } from "framer-motion"
import {
  Bike,
  Shield,
  TrendingDown,
  Clock,
  CheckCircle,
  Star,
  ArrowRight,
  Phone,
  Mail,
  MessageCircle,
  Menu,
  X,
  User,
  Heart,
  ShoppingCart,
  Package,
  FileCheck,
  Truck,
  Search,
  MapPin,
  Award,
  Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Header from "@/components/layout/Header"
import CountUp from "@/components/count-up"
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel"
import BestDeliveryTimeSection from "@/components/landing/BestDeliveryTimeSection"
import ConvenienceMaxSection from "@/components/landing/ConvenienceMaxSection"
import WhoWeAreSection from "@/components/landing/WhoWeAreSection"
import MiniCatalogSection from "@/components/landing/MiniCatalogSection"
import CalculatorBringYourOwnSection from "@/components/landing/CalculatorBringYourOwnSection"
import { HunterLogger } from "@/components/HunterLogger"

interface Feature {
  step: string
  title?: string
  content: string
  image: string
}

interface FeatureStepsProps {
  features: Feature[]
  className?: string
  title?: string
  autoPlayInterval?: number
  imageHeight?: string
}

function FeatureSteps({
  features,
  className,
  title = "Как это работает",
  autoPlayInterval = 3000,
  imageHeight = "h-[400px]",
}: FeatureStepsProps) {
  const [currentFeature, setCurrentFeature] = useState(0)
  const [carouselApi, setCarouselApi] = useState<any>(null)

  useEffect(() => {
    if (!carouselApi) return
    const onSelect = () => {
      const index = carouselApi.selectedScrollSnap()
      setCurrentFeature(index)
    }
    carouselApi.on("select", onSelect)
    return () => {
      try {
        carouselApi.off("select", onSelect)
      } catch { }
    }
  }, [carouselApi])

  return (
    <div className={cn("p-8 md:p-12", className)}>
      <div className="max-w-7xl mx-auto w-full">
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-heading font-bold mb-12 text-center tracking-tighter">
          {title}
        </h2>

        <div className="flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-10">
          {/* Steps list - horizontal scroll on mobile, vertical on desktop */}
          <div className="order-2 md:order-1 flex md:flex-col gap-4 md:gap-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none pb-2">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="flex items-center gap-6 md:gap-8 cursor-pointer snap-start min-w-[280px] md:min-w-0"
                initial={{ opacity: 0.5 }}
                animate={{ opacity: index === currentFeature ? 1 : 0.5 }}
                transition={{ duration: 0.3 }}
                onClick={() => carouselApi?.scrollTo(index)}
              >
                <motion.div
                  className={cn(
                    "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2",
                    index === currentFeature
                      ? "bg-primary border-primary text-primary-foreground scale-110"
                      : "bg-muted border-muted-foreground",
                  )}
                >
                  {index === currentFeature ? (
                    <span className="text-lg font-bold">✓</span>
                  ) : (
                    <span className="text-lg font-semibold">{index + 1}</span>
                  )}
                </motion.div>

                <div className="flex-1">
                  <h3 className="text-xl md:text-3xl font-heading font-bold mb-1">
                    {feature.title || feature.step}
                  </h3>
                  <p className="text-sm md:text-lg text-muted-foreground">
                    {feature.content}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Carousel for content with snap points */}
          <div className={cn("order-1 md:order-2 relative")}>
            <Carousel setApi={setCarouselApi} className="w-full">
              <CarouselContent className="">
                {features.map((feature, index) => (
                  <CarouselItem key={index}>
                    <div className={cn("relative overflow-hidden rounded-lg", imageHeight)}>
                      <img
                        src={feature.image}
                        alt={feature.step}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-background via-background/50 to-transparent" />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="-left-6 md:-left-12" />
              <CarouselNext className="-right-6 md:-right-12" />
            </Carousel>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatCounterProps {
  icon: React.ReactNode
  value: number
  label: string
  suffix: string
  delay: number
}

function StatCounter({ icon, value, label, suffix, delay }: StatCounterProps) {
  const countRef = useRef(null)
  const isInView = useInView(countRef, { once: false })
  const [hasAnimated, setHasAnimated] = useState(false)

  const springValue = useSpring(0, {
    stiffness: 50,
    damping: 10,
  })

  useEffect(() => {
    if (isInView && !hasAnimated) {
      springValue.set(value)
      setHasAnimated(true)
    } else if (!isInView && hasAnimated) {
      springValue.set(0)
      setHasAnimated(false)
    }
  }, [isInView, value, springValue, hasAnimated])

  const displayValue = useTransform(springValue, (latest) => Math.floor(latest))

  return (
    <motion.div
      className="bg-white/50 backdrop-blur-sm p-6 rounded-xl flex flex-col items-center text-center group hover:bg-white transition-colors duration-300"
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, delay },
        },
      }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
    >
      <motion.div
        className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:bg-primary/20 transition-colors duration-300"
        whileHover={{ rotate: 360, transition: { duration: 0.8 } }}
      >
        {icon}
      </motion.div>
      <motion.div ref={countRef} className="text-3xl font-bold text-foreground flex items-center">
        <motion.span>{displayValue}</motion.span>
        <span>{suffix}</span>
      </motion.div>
      <p className="text-muted-foreground text-sm mt-1">{label}</p>
      <motion.div className="w-10 h-0.5 bg-primary mt-3 group-hover:w-16 transition-all duration-300" />
    </motion.div>
  )
}

import AdminTMAPage from "./pages/AdminTMAPage";

function BikeImportWebsite() {
  const [searchQuery, setSearchQuery] = useState("") // Added for FAQ filtering
  const sectionRef = useRef<HTMLElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  // удалено: локальная переменная isInView не используется
  const isStatsInView = useInView(statsRef, { once: false, amount: 0.3 })

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -50])
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 50])

  const fadeUpVariants: import("framer-motion").Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: "easeInOut",
      },
    }),
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  }

  // удалено: itemVariants не используется

  // Smooth scroll for in-page anchors with 500ms animation
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      if (!href.startsWith('#')) return
      const id = href.slice(1)
      const el = document.getElementById(id)
      if (!el) return
      e.preventDefault()
      const start = window.scrollY
      const end = el.getBoundingClientRect().top + window.scrollY
      const duration = 500
      const startTime = performance.now()
      const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const step = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const pos = start + (end - start) * easeInOutCubic(progress)
        window.scrollTo({ top: pos })
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  const howItWorksSteps = [
    {
      step: "Шаг 1",
      title: "Консультация и подбор",
      content: "Изучив ваши требования, личный менеджер подберет для вас самые подходящие варианты и полностью проинструктирует.",
      image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?q=80&w=2070&auto=format&fit=crop"
    },
    {
      step: "Шаг 2",
      title: "Поиск и проверка",
      content: "Находим велосипед, проверяем документы и техническое состояние",
      image: "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?q=80&w=2022&auto=format&fit=crop"
    },
    {
      step: "Шаг 3",
      title: "Покупка и оформление",
      content: "Выкупаем байк, оформляем все документы для экспорта",
      image: "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?q=80&w=2070&auto=format&fit=crop"
    },
    {
      step: "Шаг 4",
      title: "Логистика",
      content: "Организуем доставку из Германии в Россию",
      image: "https://images.unsplash.com/photo-1494412651409-8963ce7935a7?q=80&w=2070&auto=format&fit=crop"
    },
    {
      step: "Шаг 5",
      title: "Таможенное оформление",
      content: "Проводим через таможню с полным пакетом документов",
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=2012&auto=format&fit=crop"
    },
    {
      step: "Шаг 6",
      title: "Доставка до двери",
      content: "Велосипед доставляется к вам домой, или в ближайший выбранный пункт выдачи",
      image: "https://images.unsplash.com/photo-1511994298241-608e28f14fde?q=80&w=2070&auto=format&fit=crop"
    }
  ]

  const recentDeliveries = [
    {
      id: 1,
      name: "Canyon Ultimate CF SLX",
      city: "Москва",
      price: "€3,200 + доставка €450",
      status: "Доставлен",
      image: "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?q=80&w=2048&auto=format&fit=crop"
    },
    {
      id: 2,
      name: "Specialized S-Works Tarmac",
      city: "Санкт-Петербург",
      price: "€4,800 + доставка €450",
      status: "В пути",
      image: "https://images.unsplash.com/photo-1571333250630-f0230c320b6d?q=80&w=2070&auto=format&fit=crop"
    },
    {
      id: 3,
      name: "Trek Domane SL 7",
      city: "Казань",
      price: "€3,900 + доставка €550",
      status: "Доставлен",
      image: "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?q=80&w=2022&auto=format&fit=crop"
    }
  ]

  const testimonials = [
    {
      name: "Алексей М.",
      city: "Москва",
      text: "Заказал Canyon Aeroad CF SLX. Сэкономил около 200 тысяч рублей по сравнению с российскими ценами. Весь процесс занял 3 недели, все прозрачно и профессионально.",
      rating: 5
    },
    {
      name: "Дмитрий К.",
      city: "Екатеринбург",
      text: "Отличный сервис! Помогли подобрать идеальный размер рамы, проверили байк перед отправкой. Велосипед пришел в идеальном состоянии со всеми документами.",
      rating: 5
    },
    {
      name: "Ирина С.",
      city: "Санкт-Петербург",
      text: "Заказывала для мужа Specialized Roubaix. Команда профессионалов, всегда на связи, отвечают на все вопросы. Рекомендую!",
      rating: 5
    }
  ]

  const faqs = [
    {
      question: "Сколько времени занимает доставка?",
      answer: "В среднем 2-4 недели от момента оплаты до получения велосипеда. Это включает поиск, покупку, логистику и таможенное оформление."
    },
    {
      question: "Какие документы я получу?",
      answer: "Вы получите полный пакет: договор купли-продажи, таможенную декларацию, сертификат соответствия и все оригинальные документы от производителя."
    },
    {
      question: "Есть ли гарантия на велосипед?",
      answer: "Да, действует официальная гарантия производителя. Мы также предоставляем гарантию на наши услуги по доставке и оформлению."
    },
    {
      question: "Можно ли заказать б/у велосипед?",
      answer: "Да, мы работаем как с новыми, так и с б/у велосипедами. Все б/у байки проходят тщательную проверку перед покупкой."
    },
    {
      question: "Какова экономия по сравнению с покупкой в РФ?",
      answer: "В среднем 150-250 тысяч рублей на премиальных моделях. Чем дороже велосипед, тем больше экономия."
    },
    {
      question: "Что входит в стоимость доставки?",
      answer: "Логистика из Германии, таможенное оформление, пошлины, доставка до вашего города и страховка груза."
    }
  ]

  const stats = [
    { icon: <Package />, value: 147, label: "Велосипедов доставлено", suffix: "" },
    { icon: <TrendingDown />, value: 32000, label: "Средняя экономия (руб.)", suffix: " руб" },
    { icon: <Users />, value: 2021, label: "Год основания", suffix: "" },
    { icon: <Award />, value: 104, label: "б/у велосипедов доставлено", suffix: "" },
  ]

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background font-manrope">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section ref={sectionRef} className="relative min-h-[72vh] w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 pt-4 pb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 blur-3xl" />

        <motion.div
          className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary/5 blur-3xl"
          style={{ y: y1 }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-primary/10 blur-3xl"
          style={{ y: y2 }}
        />

        <div className="relative z-10 container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Удалён бейдж с текстом "Профессиональный импорт велосипедов" по запросу */}

            <motion.div custom={1} variants={fadeUpVariants} initial="hidden" animate="visible">
              <h1 className="text-5xl sm:text-6xl md:text-8xl font-heading font-extrabold mb-6 tracking-tight leading-[0.9] text-gradient">
                Велосипеды из Европы
                <br />
                с полным сопровождением
              </h1>
            </motion.div>

            <motion.div custom={2} variants={fadeUpVariants} initial="hidden" animate="visible">
              <p className="text-base md:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                Полный цикл: от поиска до доставки. С доказанно лучшими сроками, ценами и надежностью.
              </p>
            </motion.div>

            <motion.div
              custom={3}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row gap-3 justify-center mb-8"
            >
              <InteractiveHoverButton
                text="В каталог"
                className="w-auto px-6 py-3"
                onClick={() => { window.location.href = '/catalog'; }}
              />
              <InteractiveHoverButton
                text="Калькулятор"
                className="w-auto px-6 py-3"
                onClick={() => { window.location.href = '/calculator'; }}
              />
            </motion.div>

            <motion.div
              custom={4}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
            >
              <div className="bg-card/50 backdrop-blur-sm p-3 rounded-lg border">
                <div className="text-3xl font-bold text-primary mb-1">
                  <CountUp to={438} duration={2} onStart={() => { }} onEnd={() => { }} />
                </div>
                <div className="text-sm text-muted-foreground">велосипедов доставлено</div>
              </div>
              <div className="bg-card/50 backdrop-blur-sm p-3 rounded-lg border">
                <div className="text-3xl font-bold text-primary mb-1">
                  <CountUp to={32000} separator=" " duration={2} /> руб
                </div>
                <div className="text-sm text-muted-foreground">средняя экономия</div>
              </div>
              <div className="bg-card/50 backdrop-blur-sm p-3 rounded-lg border">
                <div className="text-3xl font-bold text-primary mb-1">
                  <CountUp to={2021} duration={2} onStart={() => { }} onEnd={() => { }} />
                </div>
                <div className="text-sm text-muted-foreground">год основания</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mini Catalog (две листающие строки) */}
      <MiniCatalogSection />

      {/* Calculator CTA — объединённый блок про ИИ‑калькулятор */}
      <CalculatorBringYourOwnSection />

      {/* Best Delivery Time */}
      <BestDeliveryTimeSection />

      {/* Work CTA standalone block */}
      <section data-testid="work-cta-block" className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <button
            data-testid="work-cta"
            onClick={() => (window.location.href = '/about')}
            className="w-full max-w-3xl mx-auto block rounded-3xl border-2 border-black bg-white text-black shadow-[0_6px_0_#000] hover:shadow-[0_10px_0_#000] transition-all duration-200 ease-out px-10 py-8 text-2xl font-extrabold tracking-tight flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Подробнее о нашей работе</span>
          </button>
        </div>
      </section>

      {/* Кто мы? */}
      <WhoWeAreSection />

      {/* Guarantees (без фонового заголовка) */}
      <section id="guarantees" className="bg-gradient-to-b from-background to-muted/30 py-16 sm:py-24 md:py-28 mb-16">
        <div className="container mx-auto px-4">
          {/* Заголовок секции */}
          <div className="text-center mb-8 md:mb-10">
            <h3 className="text-3xl md:text-4xl font-bold mb-2">ПОЛНЫЙ ПАКЕТ ГАРАНТИЙ</h3>
            <p className="text-muted-foreground text-lg md:text-xl">с каждым заказом!</p>
          </div>

          {/* Ряд 1 — три гарантии */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Гарантия выбора</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Оплата на самом последнем этапе, консультации и подбор с личным менеджером бесплатны.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileCheck className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Гарантия условий</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Все условия прозрачны: торгуемся за максимальную скидку и добиваемся компенсаций при необходимости.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Award className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Гарантия цены</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Цена, названная менеджером, фиксируется и не может быть увеличена ни при каких условиях!
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Ряд 2 — страховки и поддержка */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Truck className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Страхование груза</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Полное страхование на всех этапах доставки.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Package className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Таможенная страховка</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Документы и прохождение таможни берём на себя — гарантия успешного оформления для каждого велосипеда.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Clock className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Поддержка 24/7</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Личный менеджер на связи 24/7 на всех этапах.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 flex justify-center">
            <Button asChild className="group transition-transform duration-200 hover:scale-[1.05]">
              <a href="#guarantees">
                Подробнее о защите клиента
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Convenience Max */}
      <ConvenienceMaxSection />



      {/* Catalog Teaser */}
      <section id="catalog-teaser" className="py-12 sm:py-18 md:py-24 bg-background mb-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="mb-6 text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
                Байк мечты? <span className="bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">Начните с каталога!</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl leading-relaxed">
                Мы собираем и регулярно обновляем лучшие предложения: акции от производителей и сильные варианты б/у.
                <br className="hidden sm:block" />
                Каталог создан, чтобы у вас всегда был доступ к самым выгодным и актуальным сделкам.
              </p>
              <div className="flex items-center gap-3">
                <Button asChild size="lg" className="group px-8 py-6 rounded-xl text-lg shadow-md transition-all duration-200 hover:scale-[1.03] hover:shadow-lg">
                  <a href="/catalog">
                    В каталог
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-4">
                *Все цены в каталоге — финальные, уже включают все дополнительные сборы и на них распространяется
                {" "}
                <a href="#guarantees" className="underline underline-offset-4 hover:text-primary transition-colors">Гарантия цены</a>.
              </p>
            </div>
            <div className="relative">
              <div className="relative aspect-[4/3] rounded-2xl ring-1 ring-muted-foreground/20 border-2 border-dashed border-muted-foreground/30 bg-gradient-to-br from-muted/40 via-muted/20 to-transparent flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                <span className="text-sm text-muted-foreground">Фото добавим позже</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-6 sm:py-16 md:py-20 bg-background mb-16">
        <FeatureSteps
          features={howItWorksSteps}
          title="Процесс доставки"
          autoPlayInterval={4000}
        />
        <div className="container mx-auto px-4 mt-8 flex justify-center">
          <Button asChild className="group transition-transform duration-200 hover:scale-[1.05]">
            <a href="#how-it-works">
              Подробнее о процессе
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Recent Deliveries */}
      <section id="recent-deliveries" className="py-6 sm:py-16 md:py-20 bg-muted/30 mb-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
            Недавние доставки
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentDeliveries.map((bike) => (
              <Card key={bike.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48">
                  <img
                    src={bike.image}
                    alt={bike.name}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-2 right-2">
                    {bike.status}
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-xl">{bike.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {bike.city}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{bike.price}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Button asChild className="group transition-transform duration-200 hover:scale-[1.05]">
              <a href="#recent-deliveries">
                Подробнее о доставках
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Proof Section */}
      <section id="stats" ref={statsRef} className="py-6 sm:py-16 md:py-20 bg-background mb-16">
        <div className="container mx-auto px-4">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
            initial="hidden"
            animate={isStatsInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            {stats.map((stat, index) => (
              <StatCounter
                key={index}
                icon={stat.icon}
                value={stat.value}
                label={stat.label}
                suffix={stat.suffix}
                delay={index * 0.1}
              />
            ))}
          </motion.div>
          <div className="mt-8 flex justify-center">
            <Button asChild className="group transition-transform duration-200 hover:scale-[1.05]">
              <a href="#stats">
                Подробнее о статистике
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="reviews" className="py-6 sm:py-16 md:py-20 bg-muted/30 mb-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
            Отзывы клиентов
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <CardTitle className="text-lg">{testimonial.name}</CardTitle>
                  <CardDescription>{testimonial.city}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{testimonial.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Button asChild className="group transition-transform duration-200 hover:scale-[1.05]">
              <a href="#reviews">
                Подробнее об отзывах
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>


      {/* Pricing */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Прозрачные цены
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Никаких скрытых платежей. Все расходы известны заранее
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Базовый</CardTitle>
                <CardDescription>Для одного велосипеда</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-4">от 25 000₽</div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Поиск и подбор
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Проверка документов
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Логистика
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Таможня
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full">Заказать</Button>
              </CardFooter>
            </Card>

            <Card className="border-primary shadow-lg">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Популярный
              </Badge>
              <CardHeader>
                <CardTitle>Премиум</CardTitle>
                <CardDescription>Полное сопровождение</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-4">от 35 000₽</div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Все из Базового
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Техосмотр перед покупкой
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Приоритетная доставка
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Расширенная страховка
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full">Заказать</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Корпоративный</CardTitle>
                <CardDescription>Для команд и магазинов</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-4">Договорная</div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Все из Премиум
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Оптовые скидки
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Персональный менеджер
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Гибкие условия
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline">Связаться</Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
            Частые вопросы
          </h2>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по вопросам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {filteredFaqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Contact */}
      <section id="contacts" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            Свяжитесь с нами
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">Контактная информация</h3>
                <div className="space-y-4">
                  <a href="tel:+79991234567" className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="h-5 w-5" />
                    +7 (999) 123-45-67
                  </a>
                  <a href="mailto:info@bikeimport.ru" className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="h-5 w-5" />
                    info@bikeimport.ru
                  </a>
                  <a href="https://t.me/bikeimport" className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="h-5 w-5" />
                    Telegram
                  </a>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">Мессенджеры</h3>
                <div className="flex gap-4">
                  <Button size="lg">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Telegram
                  </Button>
                  <Button size="lg" variant="outline">
                    WhatsApp
                  </Button>
                </div>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Отправить сообщение</CardTitle>
                <CardDescription>Мы ответим в течение 24 часов</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div>
                    <Input placeholder="Ваше имя" />
                  </div>
                  <div>
                    <Input type="email" placeholder="Email" />
                  </div>
                  <div>
                    <Textarea placeholder="Сообщение" rows={4} />
                  </div>
                  <Button type="submit" className="w-full">
                    Отправить
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Bike className="h-6 w-6 text-primary" />
                <span className="font-bold text-xl">BikeImport.ru</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Профессиональный подбор и доставка велосипедов из Европы. Гарантия качества и прозрачные условия.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Компания</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#about" className="hover:text-foreground">О нас</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground">Как это работает</a></li>
                <li><a href="#guarantees" className="hover:text-foreground">Гарантии</a></li>
                <li><a href="#reviews" className="hover:text-foreground">Отзывы</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Услуги</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/catalog" className="hover:text-foreground">Каталог</a></li>
                <li><a href="/calculator" className="hover:text-foreground">Калькулятор</a></li>
                <li><a href="#delivery" className="hover:text-foreground">Доставка</a></li>
                <li><a href="#customs" className="hover:text-foreground">Таможня</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Контакты</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Москва, ул. Примерная, 1</li>
                <li>+7 (999) 123-45-67</li>
                <li>info@bikeimport.ru</li>
                <li>Пн-Вс: 10:00 - 20:00</li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} BikeImport.ru. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <>
      <HunterLogger />
      <div className="flex flex-col min-h-screen">
        <Header />

        {/* Hero Section */}
        <section className="relative pt-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Badge variant="secondary" className="mb-6 px-4 py-2 text-base bg-primary/10 text-primary hover:bg-primary/20">
                  <Star className="w-4 h-4 mr-2 fill-primary" />
                  Premium E-Commerce
                </Badge>
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6">
                  Байки из Европы <br />
                  <span className="text-primary relative inline-block">
                    без границ
                    <motion.svg
                      className="absolute w-full h-3 -bottom-1 left-0 text-primary/30"
                      viewBox="0 0 100 10"
                      preserveAspectRatio="none"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1, delay: 0.5 }}
                    >
                      <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                    </motion.svg>
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground mb-8 max-w-lg">
                  Доставим любой велосипед из магазинов Германии и Австрии.
                  Прозрачный расчет, страховка груза и полное сопровождение.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <InteractiveHoverButton
                    text="Рассчитать стоимость"
                    className="w-full sm:w-auto"
                    onClick={() => document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' })}
                  />
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full border-2">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Написать менеджеру
                  </Button>
                </div>

                <div className="mt-12 flex items-center gap-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Страховка</p>
                      <p>на всю сумму</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">14-21 день</p>
                      <p>быстрая доставка</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                <div className="relative z-10 bg-gradient-to-tr from-primary/20 to-transparent rounded-[3rem] p-8">
                  <img
                    src="https://images.unsplash.com/photo-1576435728678-35d016018c97?q=80&w=2940&auto=format&fit=crop"
                    alt="Premium Bike"
                    className="rounded-[2rem] shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500"
                  />

                  {/* Floating Cards */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="absolute -bottom-6 -left-6 bg-background p-4 rounded-2xl shadow-xl flex items-center gap-4"
                  >
                    <div className="bg-green-100 p-3 rounded-xl">
                      <TrendingDown className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Выгода до</p>
                      <p className="text-xl font-bold">30%</p>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="absolute -top-6 -right-6 bg-background p-4 rounded-2xl shadow-xl flex items-center gap-4"
                  >
                    <div className="bg-blue-100 p-3 rounded-xl">
                      <CheckCircle className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Гарантия</p>
                      <p className="text-xl font-bold">100%</p>
                    </div>
                  </motion.div>
                </div>

                {/* Background Blobs */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/5 blur-3xl -z-10 rounded-full" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Mini Catalog Section */}
        <MiniCatalogSection />

        {/* Calculator Section */}
        <CalculatorBringYourOwnSection />

        {/* Who We Are Section */}
        <WhoWeAreSection />

        {/* Feature Steps Section */}
        <section id="how-it-works" className="py-20 bg-muted/30">
          <FeatureSteps
            features={[
              {
                step: "01",
                title: "Выбор",
                content: "Вы выбираете велосипед в любом европейском магазине или на нашей витрине.",
                image: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&q=80&w=2400"
              },
              {
                step: "02",
                title: "Расчет",
                content: "Мы рассчитываем итоговую стоимость с доставкой и страховкой.",
                image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=2400"
              },
              {
                step: "03",
                title: "Оплата",
                content: "Вы оплачиваете заказ удобным способом. Мы выкупаем товар.",
                image: "https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&q=80&w=2400"
              },
              {
                step: "04",
                title: "Доставка",
                content: "Бережно доставляем велосипед до вашего города за 2-3 недели.",
                image: "https://images.unsplash.com/photo-1616432043562-3671ea2e5242?auto=format&fit=crop&q=80&w=2400"
              }
            ]}
          />
        </section>

        {/* Best Delivery Time Section */}
        <BestDeliveryTimeSection />

        {/* Convenience Max Section */}
        <ConvenienceMaxSection />

        {/* Footer */}
        <footer className="bg-background border-t py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Bike className="h-6 w-6 text-primary" />
                  <span className="font-bold text-xl">BikeImport.ru</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Профессиональный подбор и доставка велосипедов из Европы. Гарантия качества и прозрачные условия.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Компания</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#about" className="hover:text-foreground">О нас</a></li>
                  <li><a href="#how-it-works" className="hover:text-foreground">Как это работает</a></li>
                  <li><a href="#guarantees" className="hover:text-foreground">Гарантии</a></li>
                  <li><a href="#reviews" className="hover:text-foreground">Отзывы</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Услуги</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="/catalog" className="hover:text-foreground">Каталог</a></li>
                  <li><a href="/calculator" className="hover:text-foreground">Калькулятор</a></li>
                  <li><a href="#delivery" className="hover:text-foreground">Доставка</a></li>
                  <li><a href="#customs" className="hover:text-foreground">Таможня</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Контакты</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Москва, ул. Примерная, 1</li>
                  <li>+7 (999) 123-45-67</li>
                  <li>info@bikeimport.ru</li>
                  <li>Пн-Вс: 10:00 - 20:00</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-8 text-center text-sm text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} BikeImport.ru. Все права защищены.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
