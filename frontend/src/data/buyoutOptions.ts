export type DeliveryOptionId = 'Cargo' | 'CargoProtected' | 'EMS' | 'EMSProtected' | 'Premium' | 'PremiumGroup'

export type DeliveryOption = {
  id: DeliveryOptionId
  title: string
  subtitle: string
  priceEur: number
  eta: string
  highlight?: string
}

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: 'Cargo',
    title: 'Стандарт',
    subtitle: 'Доставка до отделения',
    priceEur: 170,
    eta: '20-24 дня',
  },
  {
    id: 'CargoProtected',
    title: 'Стандарт + Защита',
    subtitle: 'Таможенная защита',
    priceEur: 250,
    eta: '20-24 дня',
    highlight: 'Premium Customs',
  },
  {
    id: 'EMS',
    title: 'Ускоренная',
    subtitle: 'Курьером до двери',
    priceEur: 220,
    eta: '14-18 дней',
  },
  {
    id: 'EMSProtected',
    title: 'Ускоренная + Защита',
    subtitle: 'Курьером + Таможня',
    priceEur: 300,
    eta: '14-18 дней',
    highlight: 'Premium Customs',
  },
  {
    id: 'PremiumGroup',
    title: 'Премиум (Сборный)',
    subtitle: 'Индивидуальная логистика',
    priceEur: 450,
    eta: '25-30 дней',
  },
  {
    id: 'Premium',
    title: 'Премиум (Лично)',
    subtitle: 'Выкуп + доставка под ключ',
    priceEur: 650,
    eta: '22-24 дня',
  },
]

export type AddonType = 'fixed' | 'percent_bike' | 'percent_total_rub' | 'per_unit'

export type AddonOption = {
  id: string
  title: string
  description: string
  type: AddonType
  value: number
  unitLabel?: string
  minQty?: number
  maxQty?: number
}

export const INCLUDED_SERVICES = [
  'Удаление инвойсов',
  'Фото со склада',
  'Заполнение таможенной декларации',
  'Ускоренная доставка по Германии',
  'Страховка при доставке по Германии',
]

export const ADDON_OPTIONS: AddonOption[] = [
  {
    id: 'personal_inspection',
    title: 'Личная проверка экспертом',
    description: 'Эксперт разбирает байк, фиксирует недочёты и формирует детальный отчёт.',
    type: 'fixed',
    value: 80,
  },
  {
    id: 'extra_packaging',
    title: 'Дополнительная упаковка',
    description: 'Усиленная защита коробки и уязвимых мест.',
    type: 'fixed',
    value: 10,
  },
  {
    id: 'video_call',
    title: 'Видеозвонок с демонстрацией',
    description: 'Покажем байк перед отправкой вживую.',
    type: 'fixed',
    value: 10,
  },
  {
    id: 'extra_photos',
    title: 'Дополнительные фотографии',
    description: 'Любые дополнительные фото по запросу.',
    type: 'per_unit',
    value: 2,
    unitLabel: 'шт',
    minQty: 0,
    maxQty: 20,
  },
  {
    id: 'detailed_check',
    title: 'Детальная проверка (склад)',
    description: 'Полное раскрытие коробки, фото комплектации и перепаковка.',
    type: 'fixed',
    value: 10,
  },
  {
    id: 'extra_insurance',
    title: 'Дополнительное страхование',
    description: 'Расширенная страховая защита груза.',
    type: 'percent_bike',
    value: 0.08,
  },
  {
    id: 'customs_guarantee',
    title: 'Таможенная гарантия',
    description: 'Возврат сервисного сбора при задержках на таможне.',
    type: 'percent_total_rub',
    value: 0.04,
  },
]

export type AddonSelection = Record<string, number>

export type AddonLine = {
  id: string
  title: string
  qty: number
  priceRub: number
  priceEur: number
}

export function getAddonTitle(id: string) {
  return ADDON_OPTIONS.find((opt) => opt.id === id)?.title || id
}

export function calculateAddonsTotals({
  bikePriceEur,
  baseTotalRub,
  exchangeRate,
  selection,
}: {
  bikePriceEur: number
  baseTotalRub: number
  exchangeRate: number
  selection: AddonSelection
}) {
  let totalRub = 0
  let totalEur = 0
  const lines: AddonLine[] = []

  ADDON_OPTIONS.forEach((opt) => {
    const qty = Math.max(0, Number(selection[opt.id] || 0))
    if (!qty) return

    let lineEur = 0
    let lineRub = 0

    if (opt.type === 'fixed') {
      lineEur = opt.value * qty
      lineRub = Math.round(lineEur * exchangeRate)
    }

    if (opt.type === 'per_unit') {
      lineEur = opt.value * qty
      lineRub = Math.round(lineEur * exchangeRate)
    }

    if (opt.type === 'percent_bike') {
      lineEur = bikePriceEur * opt.value * qty
      lineRub = Math.round(lineEur * exchangeRate)
    }

    if (opt.type === 'percent_total_rub') {
      lineRub = Math.round(baseTotalRub * opt.value * qty)
      lineEur = exchangeRate > 0 ? lineRub / exchangeRate : 0
    }

    totalRub += lineRub
    totalEur += lineEur
    lines.push({ id: opt.id, title: opt.title, qty, priceRub: lineRub, priceEur: lineEur })
  })

  return {
    totalRub,
    totalEur,
    lines,
  }
}
