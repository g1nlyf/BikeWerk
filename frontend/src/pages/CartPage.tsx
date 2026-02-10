import * as React from 'react'
import BikeflipHeaderPX from '@/components/layout/BikeflipHeaderPX'
import { SEOHead } from '@/components/SEO/SEOHead'
import { API_BASE } from '@/api'
import { useCart } from '@/context/CartContext'
import { Button } from '@/components/ui/button'
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, ShieldCheck, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, loading, clearCart, totalAmount, itemsCount } = useCart()
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
      const checkout = params.get('checkout')
      if (checkout === '1' || checkout === 'true') {
        if (items.length > 0) {
            setCheckoutOpen(true)
        }
      }
    } catch {}
  }, [items.length])

  const placeholderImg = 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=200&h=200&fit=crop&auto=format'

  const shippingCost = 0 // Free shipping logic can be added here
  const finalTotal = totalAmount + shippingCost

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead title="Корзина - BikeWerk" />
        <BikeflipHeaderPX />
        <main className="flex-1 container mx-auto px-4 py-20 flex items-center justify-center">
             <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="h-12 w-12 bg-gray-200 rounded-full" />
                <div className="h-4 w-48 bg-gray-200 rounded" />
             </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <SEOHead title="Корзина - BikeWerk" />
      <BikeflipHeaderPX />
      
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Корзина</h1>
                <p className="text-zinc-500">{itemsCount} {itemsCount === 1 ? 'товар' : (itemsCount > 1 && itemsCount < 5) ? 'товара' : 'товаров'}</p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="h-24 w-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <ShoppingBag className="h-10 w-10 text-zinc-300" />
              </div>
              <h2 className="text-xl font-bold mb-2">Ваша корзина пуста</h2>
              <p className="text-zinc-500 max-w-sm mb-8">
                Похоже, вы еще не добавили ни одного велосипеда. Загляните в каталог, там много интересного!
              </p>
              <Button 
                onClick={() => window.location.href = '/catalog'}
                className="h-12 px-8 rounded-full font-bold text-base"
              >
                Перейти в каталог
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Items List */}
              <div className="lg:col-span-8 space-y-4">
                {items.map((item) => {
                   const base = API_BASE.replace('/api', '')
                   const img = item.image
                   const imageUrl = img
                     ? (img.startsWith('http') ? img : `${base}${img}`)
                     : placeholderImg
                     
                   return (
                     <div key={item.id} className="group relative bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex gap-4 sm:gap-6">
                        {/* Image */}
                        <div className="shrink-0 w-24 h-24 sm:w-32 sm:h-32 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover mix-blend-multiply" />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div className="flex justify-between items-start gap-4">
                             <div>
                                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">{item.brand}</div>
                                <h3 
                                  className="font-bold text-base sm:text-lg leading-tight cursor-pointer hover:underline"
                                  onClick={() => window.location.href = `/product/${item.bike_id}`}
                                >
                                  {item.model}
                                </h3>
                                {/* Mobile Price */}
                                <div className="sm:hidden font-bold mt-2 text-lg">
                                  {item.price.toLocaleString()} €
                                </div>
                             </div>
                             
                             {/* Desktop Price */}
                             <div className="hidden sm:block text-right">
                                <div className="font-bold text-xl">{item.price.toLocaleString()} €</div>
                                {item.quantity > 1 && (
                                    <div className="text-xs text-zinc-400 mt-1">{item.price.toLocaleString()} € / шт.</div>
                                )}
                             </div>
                          </div>

                          <div className="flex items-center justify-between mt-4">
                             {/* Quantity Control */}
                             <div className="flex items-center gap-1 bg-gray-50 rounded-full p-1 border border-gray-200">
                                <button 
                                  onClick={() => updateQuantity(item.bike_id, item.quantity - 1)}
                                  className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white hover:shadow-sm transition-all text-zinc-600 disabled:opacity-50"
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-8 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(item.bike_id, item.quantity + 1)}
                                  className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white hover:shadow-sm transition-all text-zinc-600"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                             </div>

                             <button 
                               onClick={() => removeFromCart(item.bike_id)}
                               className="text-zinc-400 hover:text-red-500 p-2 transition-colors"
                               title="Удалить"
                             >
                               <Trash2 className="h-5 w-5" />
                             </button>
                          </div>
                        </div>
                     </div>
                   )
                })}
              </div>

              {/* Summary Side */}
              <div className="lg:col-span-4 sticky top-24">
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
                   <h3 className="font-bold text-lg">Ваш заказ</h3>
                   
                   <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-zinc-600">
                        <span>Товары ({itemsCount})</span>
                        <span className="font-medium text-black">{totalAmount.toLocaleString()} €</span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Доставка</span>
                        <span className="font-medium text-green-600">Бесплатно</span>
                      </div>
                   </div>
                   
                   <div className="h-px bg-gray-100" />
                   
                   <div className="flex justify-between items-end">
                      <span className="font-bold text-lg">Итого</span>
                      <span className="font-bold text-2xl">{finalTotal.toLocaleString()} €</span>
                   </div>

                   <Button 
                     onClick={() => setCheckoutOpen(true)}
                     className="w-full h-14 rounded-2xl text-base font-bold bg-black text-white hover:bg-black/90 shadow-lg shadow-black/10 group"
                   >
                     Оформить заказ
                     <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                   </Button>
                   
                   <div className="space-y-3 pt-2">
                      <div className="flex gap-3 text-xs text-zinc-500">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" />
                        <p>Безопасная сделка. Оплата только после подтверждения наличия.</p>
                      </div>
                      <div className="flex gap-3 text-xs text-zinc-500">
                        <Truck className="h-4 w-4 shrink-0 text-blue-600" />
                        <p>Доставка по всей России и СНГ.</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Universal Order Overlay */}
        
      </main>
    </div>
  )
}
