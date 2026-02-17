import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Store, Package, MessageCircle, ArrowRight } from 'lucide-react'

type WhoWeAreSectionProps = {
  className?: string
}

export default function WhoWeAreSection({ className }: WhoWeAreSectionProps) {
  return (
    <section id="who-we-are" className={cn('relative w-full overflow-hidden bg-background', className)}>
      <div className="relative mx-auto max-w-7xl px-6 md:px-10 lg:px-14 py-14 md:py-20 lg:py-24">
        {/* Огромный фоновый заголовок поверх секции */}
        <div className="pointer-events-none absolute inset-x-0 -top-6 z-0 flex justify-center">
          <h2
            className="select-none font-heading font-extrabold tracking-tighter text-foreground text-center text-[18vw] md:text-[13rem] leading-[0.82]"
            style={{ opacity: 0.12, WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent)', maskImage: 'linear-gradient(to bottom, black 70%, transparent)' }}
          >
            Кто мы
          </h2>
        </div>

        {/* Контент поверх фона: убираем все заголовки, оставляем только фон «Кто мы» */}
        <div className="relative z-10 text-center mt-6 md:mt-8 mb-6 md:mb-8">
          <p className="mt-5 text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto">
            Мы — команда <span className="font-semibold text-primary">BikeWerk</span>: логисты, специалисты по таможне, менеджеры и другие профессионалы.
            Нас объединяет любовь к велосипедам и дотошность к мелочам каждой доставки.
            Мы здесь, чтобы именно <span className="font-semibold">ты</span> ездил на байке прямиком из <span className="font-semibold">Европы</span> — остальное возьмём на себя мы.
          </p>
        </div>

        {/* С какими порталами работаем */}
        <div className="mb-4 md:mb-6">
          <div className="text-center">
            <span className="inline-block rounded-full border border-muted-foreground/20 bg-muted/40 px-4 py-2 text-lg md:text-xl font-semibold text-foreground">
              С какими порталами мы работаем?
            </span>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-7 lg:gap-8">
          {/* Официальные магазины */}
          <Card className="border-muted-foreground/10">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <Store className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl md:text-3xl">Официальные магазины</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg md:text-xl text-muted-foreground">
                Полный список удобных нам вы найдёте
                {' '}<a href="#faq" className="underline underline-offset-4 text-primary hover:text-primary/90">здесь</a>,
                {' '}но мы сможем заказать практически с любого онлайн‑магазина на территории ЕС.
              </p>
              <p className="mt-4 text-base md:text-lg text-muted-foreground">
                Личный менеджер проверит доступность, посчитает всю стоимость и будет рядом
                на каждом шаге — до самого получения.
              </p>
              <div className="mt-4">
                <Button size="lg" variant="outline" asChild>
                  <a href="#faq" className="inline-flex items-center gap-2">
                    <ArrowRight className="h-5 w-5" /> Список и подробности
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Б/У барахолки */}
          <Card className="border-muted-foreground/10">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl md:text-3xl">Б/У барахолки</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg md:text-xl text-muted-foreground">
                Да, мы возим даже <span className="font-semibold">б/у байки</span> и компоненты — именно в
                б/у сегменте часто скрываются шикарные предложения по очень выгодным ценам.
              </p>
              <p className="mt-4 text-base md:text-lg text-muted-foreground">
                Полный порядок работы и ответы на все основные вопросы по доставке б/у товаров
                вы найдёте {' '}<a href="#faq" className="underline underline-offset-4 text-primary hover:text-primary/90">здесь</a>.
              </p>
              <div className="mt-4">
                <Button size="lg" variant="outline" asChild>
                  <a href="#faq" className="inline-flex items-center gap-2">
                    <ArrowRight className="h-5 w-5" /> Подробнее о б/у
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA к FAQ */}
        <div className="relative z-10 mt-12 md:mt-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-5 py-2.5">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span className="text-base">Остались вопросы?</span>
          </div>
          <div className="mt-5">
            <Button size="lg" className="inline-flex items-center gap-2" asChild>
              <a href="#faq">
                Перейти в подробный FAQ
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}