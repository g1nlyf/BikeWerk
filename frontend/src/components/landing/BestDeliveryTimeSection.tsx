import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Globe } from '@/components/ui/globe'
import { cn } from '@/lib/utils'
import { Clock, ShieldCheck } from 'lucide-react'

// Настройки акцентов на Германию и Россию
// Координаты для маркеров: Германия, Европа, Россия
const GERMANY = [
  { location: [52.52, 13.405], size: 0.16 }, // Berlin
  { location: [48.1351, 11.5820], size: 0.10 }, // Munich
  { location: [53.5511, 9.9937], size: 0.09 }, // Hamburg
  { location: [50.9375, 6.9603], size: 0.08 }, // Cologne
  { location: [50.1109, 8.6821], size: 0.08 }, // Frankfurt
]

const EUROPE = [
  { location: [48.8566, 2.3522], size: 0.08 }, // Paris
  { location: [40.4168, -3.7038], size: 0.08 }, // Madrid
  { location: [41.9028, 12.4964], size: 0.08 }, // Rome
  { location: [52.2297, 21.0122], size: 0.08 }, // Warsaw
  { location: [48.2082, 16.3738], size: 0.08 }, // Vienna
]

const RUSSIA = [
  { location: [55.7558, 37.6173], size: 0.18 }, // Moscow
  { location: [55.7558, 37.6173], size: 0.12 }, // Moscow overlay
  { location: [55.7558, 37.6173], size: 0.08 }, // Moscow overlay
  { location: [59.9343, 30.3351], size: 0.10 }, // Saint Petersburg
  { location: [55.8304, 49.0661], size: 0.08 }, // Kazan
  { location: [56.8380, 60.5975], size: 0.08 }, // Yekaterinburg
  { location: [55.0084, 82.9357], size: 0.08 }, // Novosibirsk
  { location: [56.2965, 43.9361], size: 0.07 }, // Nizhny Novgorod
  { location: [53.1959, 50.1000], size: 0.07 }, // Samara
  { location: [54.7388, 55.9721], size: 0.07 }, // Ufa
  { location: [55.1644, 61.4368], size: 0.07 }, // Chelyabinsk
  { location: [58.0105, 56.2502], size: 0.07 }, // Perm
  { location: [47.2357, 39.7015], size: 0.07 }, // Rostov-on-Don
  { location: [48.7080, 44.5133], size: 0.07 }, // Volgograd
  { location: [45.0355, 38.9753], size: 0.07 }, // Krasnodar
]

const FOCUS_CONFIG = {
  width: 800,
  height: 800,
  onRender: () => { },
  devicePixelRatio: 2,
  // Поворот так, чтобы центр был на Дальнем Востоке России (примерно 130–140°E)
  // Увеличиваем наклон, чтобы взгляд был чуть «сверху» (~ +10°)
  phi: 2.45,
  // Ещё более «с высоты» — усиливаем наклон
  theta: 0.8,
  dark: 0,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [1, 1, 1],
  markerColor: [0, 0, 0],
  glowColor: [1, 1, 1],
  markers: [
    ...GERMANY,
    ...EUROPE,
    ...RUSSIA,
  ],
} as const

type BestDeliveryTimeSectionProps = {
  className?: string
}

export function BestDeliveryTimeSection({ className }: BestDeliveryTimeSectionProps) {
  const [isMobile, setIsMobile] = React.useState(false)
  const mobileConfig = React.useMemo(() => ({
    ...FOCUS_CONFIG,
    phi: 2.2,
    theta: 0,
  }), [])

  React.useEffect(() => {
    try {
      const mq = window.matchMedia('(max-width: 768px)')
      const update = () => setIsMobile(mq.matches)
      update()
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    } catch {
      setIsMobile(false)
    }
  }, [])

  return (
    <section data-testid="best-delivery-section" className={cn('relative bg-background', className)}>
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-6 md:grid-cols-2 md:h-[60vh]">
          {/* Правая колонка — Globe на полэкрана, видна половина */}
          <div className="relative order-3 md:order-2 md:col-start-2">
            <div data-testid="globe-card" className="relative w-full h-[26vh] max-[480px]:h-[28vh] max-[360px]:h-[26vh] md:h-[60vh] overflow-hidden rounded-2xl border pt-12">
              {/* Шильдик поверх планеты */}
              <div className="absolute top-4 left-4 z-10 rounded-full bg-background/60 backdrop-blur px-3 py-2 text-xs md:text-sm border">
                Карта доставок за 2024 год
              </div>
              <div data-testid="globe-wrapper" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] aspect-square md:inset-0 md:w-full md:h-full md:translate-x-0 md:bottom-auto md:left-auto lg:translate-y-[20%] lg:translate-x-[44%] lg:scale-[1.0]">
                <div className="absolute bottom-[-35%] left-1/2 -translate-x-1/2 w-full h-full scale-[1.50] max-[480px]:bottom-[-32%] max-[480px]:scale-[1.43] max-[360px]:bottom-[-28%] max-[360px]:scale-[1.40]">
                  <Globe className="w-full h-full" config={(isMobile ? mobileConfig : FOCUS_CONFIG) as any} />
                </div>
              </div>
            </div>
          </div>

          {/* Левая колонка — текст */}
          <div className="order-1 md:order-1 flex flex-col justify-center">
            <Badge className="w-fit mb-4 bg-primary/10 text-primary border-primary/20 px-3 py-1 text-sm">Скорость и надёжность</Badge>
            <h2 className="text-4xl md:text-5xl lg:text-7xl font-heading font-extrabold tracking-tighter mb-6 leading-[1.0]">
              Лучшее* время доставки!
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl mb-8 max-w-xl leading-relaxed">
              Благодаря прямым маршрутам доставки и отработанной логистике, перевозка грузов из стран ЕС в Россию занимает минимум времени. Логистика выстроена так, чтобы предоставить максимум надежности на каждом этапе.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Card className="border-muted bg-muted/20">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground font-medium mb-1">Средний транзит</div>
                    <div className="text-2xl font-bold">15 дней</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-muted bg-muted/20">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="rounded-full bg-green-500/10 p-2 text-green-600">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground font-medium mb-1">Надёжность</div>
                    <div className="text-2xl font-bold">0 повреждений</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground">
              * согласно внутреннему исследованию логистического департамента
            </p>

          </div>
        </div>
      </div>
    </section>
  )
}

export default BestDeliveryTimeSection
