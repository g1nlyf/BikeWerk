import React from 'react'
import { catalogApi, resolveImageUrl } from '@/api'
import { BikeCard as CatalogBikeCard } from '@/components/catalog/BikeCard'
import { calculateMarketingBreakdown, refreshRates } from '@/lib/pricing'

type BikeData = React.ComponentProps<typeof CatalogBikeCard>['bike']

export default function MiniCatalogPage() {
  const [bikes, setBikes] = React.useState<BikeData[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await refreshRates()
        const data = await catalogApi.list({ sort: 'rank', limit: 12, hot: true })
        const items = Array.isArray(data?.bikes) ? data.bikes : []
        const mapped: BikeData[] = items.map((b: any) => {
          const price = Number(b.price || 0)
          const { totalEur, totalRub } = calculateMarketingBreakdown(price)
          return {
            id: String(b.id),
            name: String(b.name || ''),
            brand: b.brand || '',
            model: b.model || b.name || '',
            year: Number(b.year || 0),
            type: b.category || 'other',
            status: b.is_new ? 'new' : (b.condition_status === 'used' ? 'used' : 'available'),
            priceEU: Math.round(price),
            priceWithDelivery: Math.round(totalEur),
            priceRUB: Math.round(totalRub),
            savings: Math.max(0, Number((b.original_price || 0) - price)),
            image: resolveImageUrl(b.main_image || (Array.isArray(b.images) && (typeof b.images[0] === 'string' ? b.images[0] : b.images[0]?.image_url)) || '') || '',
            description: b.description || '',
            tags: Array.isArray(b.features) ? b.features : [],
            isReserviert: Boolean(b.is_reserviert),
          }
        })
        setBikes(mapped)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Лучшие предложения</h1>
      {loading && <div className="text-sm text-muted-foreground">Загрузка…</div>}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {bikes.map(b => (<CatalogBikeCard key={b.id} bike={b} variant="compact" />))}
      </div>
    </div>
  )
}
