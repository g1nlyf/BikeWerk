import * as React from 'react'
const BikeflipHeaderPX = React.lazy(() => import('@/components/layout/BikeflipHeaderPX'))
import { SEOHead } from '@/components/SEO/SEOHead'
import { apiGet, apiDelete, apiPost, resolveImageUrl, metricsApi } from '@/api'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { useCartUI } from '@/lib/cart-ui'
import { formatEUR } from '@/lib/pricing'
import { motion } from 'framer-motion'
import { Heart, ShoppingCart, Trash2, ArrowRight, Package, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function FavoritesPage() {
  const { user } = useAuth() as any
  const { openCart } = useCartUI()
  const [items, setItems] = React.useState<any[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const favKey = 'guestFavorites'

  const normalizeBike = (raw: any, fallback: any = {}) => {
    const b = raw || {};
    const basic = b.basic_info || {};
    const pricing = b.pricing || {};
    const media = b.media || {};
    const conditionObj = b.condition || {};

    const brand = basic.brand ?? b.brand ?? fallback.brand ?? '';
    const model = basic.model ?? b.model ?? fallback.model ?? '';
    const nameFromParts = `${brand || ''} ${model || ''}`.trim();
    const name =
      basic.name ??
      b.name ??
      (nameFromParts || fallback.name);

    const image =
      media.main_image ??
      b.main_image ??
      (Array.isArray(media.gallery)
        ? (typeof media.gallery[0] === 'string' ? media.gallery[0] : media.gallery[0]?.image_url)
        : undefined) ??
      (Array.isArray(b.images)
        ? (typeof b.images[0] === 'string' ? b.images[0] : b.images[0]?.image_url)
        : undefined) ??
      fallback.image;

    const condition =
      (typeof b.condition === 'string' ? b.condition : undefined) ??
      conditionObj.status ??
      conditionObj.grade ??
      b.condition_status ??
      fallback.condition ??
      '';

    const year =
      basic.year ??
      b.year ??
      fallback.year ??
      '';

    const price = Number(pricing.price ?? b.price ?? fallback.price ?? 0);
    const original_price = Number(pricing.original_price ?? b.original_price ?? fallback.original_price ?? 0);
    const favoritesCount = typeof b.favorites_count === 'number' ? b.favorites_count : fallback.total_favorites;

    return {
      bike_id: Number(b.id ?? fallback.bike_id ?? fallback.id),
      name,
      brand,
      model,
      image,
      price,
      original_price,
      total_favorites: favoritesCount,
      condition,
      year,
    };
  };

  React.useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (user?.id) {
          const data = await apiGet('/favorites')
          const base = Array.isArray(data?.favorites) ? data.favorites : []

          // Enrich data with fresh bike info
          const enriched = await Promise.all(base.map(async (f: any) => {
            try {
              const d = await apiGet(`/bikes/${Number(f.bike_id || f.id)}`)
              const b = d?.bike || d
              return normalizeBike(b, f)
            } catch { return f }
          }))
          setItems(enriched)
        } else {
          // Local storage fallback for guests
          let guestItems: any[] = []
          try {
            const ids: number[] = JSON.parse(localStorage.getItem(favKey) || '[]')
            const unique = Array.from(new Set((Array.isArray(ids) ? ids : []).map((x: any) => Number(x)).filter(Boolean)))
            const results = await Promise.all(unique.map(async (id) => {
              try {
                const d = await apiGet(`/bikes/${id}`)
                const b = d?.bike || d
                if (!b) return null
                return normalizeBike(b, { bike_id: id })
              } catch { return null }
            }))
            guestItems = results.filter(Boolean) as any[]
          } catch { }

          setItems(guestItems)
        }

        // Load external favorites (for everyone)
        try {
          const extRaw = localStorage.getItem('guestExternalFavorites')
          if (extRaw) {
            const ext = JSON.parse(extRaw)
            const mappedExt = ext.map((e: any) => ({
              bike_id: e.id,
              name: e.name,
              brand: 'Свой выбор',
              model: '',
              image: e.image,
              price: e.price,
              original_price: 0,
              condition: 'N/A',
              year: '',
              isExternal: true,
              link: e.link,
              breakdown: e.breakdown || { totalRub: e.totalRub, totalEur: e.totalEur }
            }))
            setItems(prev => [...prev, ...mappedExt])
          }
        } catch { }

      } catch (e: any) {
        setError(e?.message || 'Ошибка загрузки избранного')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const removeOne = async (bikeId: number | string, isExternal?: boolean) => {
    // Optimistic UI update
    setItems((arr) => arr.filter((x) => x.bike_id !== bikeId))

    if (isExternal) {
      try {
        const extRaw = localStorage.getItem('guestExternalFavorites')
        if (extRaw) {
          const ext = JSON.parse(extRaw)
          const next = ext.filter((x: any) => x.id !== bikeId)
          localStorage.setItem('guestExternalFavorites', JSON.stringify(next))
        }
      } catch { }
      return
    }

    if (user?.id) {
      try {
        await apiDelete(`/favorites/remove/${bikeId}`)
      } catch {
        // Revert if failed (optional, but skipping for simplicity in this demo)
      }
    } else {
      try {
        const ids: number[] = JSON.parse(localStorage.getItem(favKey) || '[]')
        const next = Array.from(new Set((Array.isArray(ids) ? ids : []).map((x: any) => Number(x)).filter(Boolean))).filter((x) => x !== Number(bikeId))
        localStorage.setItem(favKey, JSON.stringify(next))
      } catch { void 0 }
    }
  }

  const addToCart = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation()

    if (item.isExternal) {
      const data = {
        link: item.link,
        bikePrice: item.price,
        totalRub: item.breakdown?.totalRub,
        totalEur: item.breakdown?.totalEur,
        breakdown: item.breakdown,
        info: {
          title: item.name,
          priceEUR: item.price,
          image: item.image
        },
        mode: item.link && item.link.startsWith('http') ? 'link' : 'manual'
      };
      try {
        localStorage.setItem('calculator_data', JSON.stringify(data));
        window.location.href = '/guest-order';
      } catch { }
      return;
    }

    try {
      const res = await apiPost('/cart', { bikeId: Number(item.bike_id), quantity: 1, calculatedPrice: Math.round(Number(item.price || 0)) })
      if (res?.success) {
        try { await metricsApi.sendEvents([{ type: 'add_to_cart', bikeId: Number(item.bike_id) }]) } catch { }
        openCart()
      } else if (res?.status === 401 || res?.error === 'Access token required') {
        window.location.href = '/guest-order'
      }
    } catch { }
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <SEOHead title="Избранное - BikeWerk" />
      <React.Suspense fallback={<div className="h-16 bg-white" />}>
        <BikeflipHeaderPX />
      </React.Suspense>

      <main className="container mx-auto px-4 md:px-8 py-12 md:py-20 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 md:mb-16"
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4">
            Избранное
          </h1>
          <p className="text-xl md:text-2xl text-gray-500 font-light max-w-2xl">
            Ваша персональная коллекция исключительных находок.
          </p>
        </motion.div>

        {error && (
          <div className="mb-8 p-4 rounded-2xl bg-red-50 text-red-600 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
            <p className="text-gray-400 animate-pulse">Загружаем коллекцию...</p>
          </div>
        ) : (
          <>
            {items.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-100 rounded-[2.5rem]"
              >
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                  <Heart className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Список пока пуст</h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  Исследуйте наш каталог, чтобы найти уникальные велосипеды из Европы по лучшим ценам.
                </p>
                <Button
                  onClick={() => window.location.href = '/catalog'}
                  className="h-14 px-8 rounded-full bg-black text-white text-lg font-bold hover:bg-emerald-600 transition-colors"
                >
                  Перейти в каталог
                </Button>
              </motion.div>
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              >
                {items.map((item) => (
                  <motion.div
                    key={item.bike_id}
                    variants={itemAnim}
                    layout
                    className="group relative bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden flex flex-col"
                  >
                    {/* Image Area */}
                    <div
                      className="aspect-[4/3] w-full overflow-hidden bg-gray-100 relative cursor-pointer"
                      onClick={() => {
                        if (item.isExternal && item.link?.startsWith('http')) {
                          window.open(item.link, '_blank')
                        } else if (!item.isExternal) {
                          window.location.href = `/product/${Number(item.bike_id)}`
                        }
                      }}
                    >
                      {item.image ? (
                        <img
                          src={resolveImageUrl(item.image)}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                          <Package className="w-12 h-12" />
                        </div>
                      )}

                      {/* Floating remove button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeOne(item.bike_id, item.isExternal) }}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-white transition-colors opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-300"
                        title="Удалить из избранного"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                      {/* Badges */}
                      <div className="absolute top-4 left-4 flex gap-2">
                        {item.isExternal ? (
                          <span className="px-3 py-1 rounded-full bg-blue-500 text-xs font-bold text-white">
                            Внешний
                          </span>
                        ) : (
                          <>
                            {item.condition && (
                              <span className="px-3 py-1 rounded-full bg-black/5 backdrop-blur text-xs font-bold text-white bg-black">
                                {item.condition}
                              </span>
                            )}
                            {item.original_price > item.price && (
                              <span className="px-3 py-1 rounded-full bg-emerald-500 text-xs font-bold text-white">
                                -{Math.round((1 - item.price / item.original_price) * 100)}%
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex-1 flex flex-col">
                      <div
                        className="cursor-pointer mb-4"
                        onClick={() => {
                          if (item.isExternal && item.link?.startsWith('http')) {
                            window.open(item.link, '_blank')
                          } else if (!item.isExternal) {
                            window.location.href = `/product/${Number(item.bike_id)}`
                          }
                        }}
                      >
                        <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
                          {item.brand || 'Бренд'} • {item.year || 'Год?'}
                        </div>
                        <h3 className="text-xl font-bold leading-tight line-clamp-2 group-hover:text-emerald-700 transition-colors">
                          {item.name || `${item.brand} ${item.model}`}
                        </h3>
                      </div>

                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-50">
                        <div>
                          <div className="text-2xl font-bold tracking-tight">
                            {formatEUR(Number(item.price || 0))}
                          </div>
                          {item.original_price > item.price && !item.isExternal && (
                            <div className="text-sm text-gray-400 line-through decoration-emerald-500/50">
                              {formatEUR(Number(item.original_price))}
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={(e) => addToCart(e, item)}
                          size="icon"
                          className={cn(
                            "h-12 rounded-2xl bg-black text-white hover:bg-emerald-600 transition-colors shadow-lg hover:shadow-emerald-500/20",
                            item.isExternal ? "w-auto px-4" : "w-12"
                          )}
                        >
                          {item.isExternal ? (
                            <>
                              <span className="mr-2 font-bold text-sm">Купить</span>
                              <ArrowRight className="w-5 h-5" />
                            </>
                          ) : (
                            <ShoppingCart className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
