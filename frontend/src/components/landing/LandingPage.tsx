import * as React from 'react'
import { routePaths } from '@/routes/paths'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ContainerScroll } from '@/components/ui/container-scroll-animation'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'
import { Hero } from '@/components/blocks/hero'
import { ArrowRight } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import MiniCatalogSection from '@/components/landing/MiniCatalogSection'
import CalculatorBringYourOwnSection from '@/components/landing/CalculatorBringYourOwnSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import { RecentDeliveriesSection } from '@/components/landing/RecentDeliveriesSection'
import { ReviewsSection } from '@/components/landing/ReviewsSection'
import { GuaranteesSection } from '@/components/landing/GuaranteesSection'
import { AboutCompanySection } from '@/components/landing/AboutCompanySection'
import { BestDeliveryTimeSection } from '@/components/landing/BestDeliveryTimeSection'
import WhoWeAreSection from '@/components/landing/WhoWeAreSection'
import { FAQSection } from '@/components/landing/FAQSection'
import { ContactsSection } from '@/components/landing/ContactsSection'
import { Footer } from '@/components/layout/Footer'
import DreamBikeSection from '@/components/landing/DreamBikeSection'
import StatsSection from '@/components/landing/StatsSection'
import ConvenienceMaxSection from '@/components/landing/ConvenienceMaxSection'

const LandingPage: React.FC = () => {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-16">
      {/* Hero из 21st.dev (ohmfordev) */}
      <Hero
        title="Профессиональный привоз велосипедов из Германии"
        subtitle="Полный цикл: от поиска до доставки. С доказанно лучшими сроками, ценами и надежностью."
        actions={[
          { label: 'Рассчитать стоимость', href: '/calculator', variant: 'default' },
          { label: 'Как мы работаем', href: 'index.html#how-it-works', variant: 'outline' },
        ]}
        titleClassName="text-5xl md:text-6xl"
        subtitleClassName="text-lg md:text-xl max-w-[900px]"
        actionsClassName="mt-6"
      />

      {/* Мини-каталог */}
      <MiniCatalogSection />

      {/* Две кнопки (CTA) */}
      <CalculatorBringYourOwnSection />

      {/* Кто мы */}
      <WhoWeAreSection />

      {/* Лучшее время доставки */}
      <BestDeliveryTimeSection />

      {/* Полный пакет гарантий */}
      <GuaranteesSection />

      {/* Процесс доставки */}
      <HowItWorksSection />

      {/* Байк мечты? Начните с каталога! */}
      <DreamBikeSection />

      {/* Удобство на максимум */}
      <ConvenienceMaxSection />
      {/* Recent deliveries */}
      <RecentDeliveriesSection />

      {/* Отзывы клиентов */}
      <ReviewsSection />

      {/* FAQ */}
      <FAQSection />

      {/* Статистика */}
      <StatsSection />

      {/* Контакты */}
      <ContactsSection />

      {/* Footer */}
      <Footer />

      {/* Остальные секции будут ниже */}
      </main>
    </>
  )
}

export default LandingPage