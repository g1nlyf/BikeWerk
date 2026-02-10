import * as React from 'react'
import { resolveImageUrl } from '@/api'
import OrderStatusBadge from './OrderStatusBadge'

type OrderItem = {
  basic_info?: { name?: string }
  name?: string
  image_url?: string
  main_image?: string
  image?: string
}

type OrderSummary = {
  bike_name?: string
  items?: OrderItem[]
  bike_snapshot?: {
    bike_id?: string
    archived_bike?: boolean
    external_bike_ref?: string
    main_photo_url?: string
    main_image?: string
    image_url?: string
    image?: string
    photos?: string[] | string
    images?: string[] | string
    cached_images?: string[] | string
  } | string
  customer?: { full_name?: string }
  customer_name?: string
  order_number?: string
  order_code?: string
  order_id?: string
  status?: string
  total_amount_rub?: number
  total_amount_eur?: number
}

type Props = {
  order: OrderSummary
  onClick?: () => void
}

export default function OrderCard({ order, onClick }: Props) {
  const snapshot = (() => {
    const raw = order?.bike_snapshot
    if (!raw) return null
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    }
    return raw
  })()
  const firstImage = (value: unknown) => {
    if (Array.isArray(value)) return value.find((v) => typeof v === 'string' && v.trim()) || null
    if (typeof value === 'string' && value.trim()) return value
    return null
  }
  const snapshotImage = firstImage(snapshot?.cached_images)
  const name = order?.bike_name || order?.items?.[0]?.basic_info?.name || order?.items?.[0]?.name || 'Байк'
  const img = resolveImageUrl(snapshotImage)
  const archivedBike = !img && Boolean(snapshot?.archived_bike || snapshot?.external_bike_ref || snapshot?.bike_id || order?.bike_name)
  const customer = order?.customer?.full_name || order?.customer_name || 'Клиент'
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-[#e4e4e7] bg-white p-3 shadow-sm hover:shadow-md transition"
    >
      <div className="flex gap-3">
        <div className="h-14 w-14 rounded-lg bg-[#f4f4f5] overflow-hidden flex items-center justify-center">
          {img ? <img src={img} alt={name} className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">Нет фото</span>}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-[#18181b] line-clamp-2">{name}</div>
          <div className="mt-1 text-xs text-slate-500">{order?.order_number || order?.order_code || order?.order_id}</div>
          <div className="mt-2 text-xs text-slate-500">{customer}</div>
          {archivedBike ? <div className="mt-1 text-[11px] text-amber-600">Архивный байк</div> : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <OrderStatusBadge status={order?.status} />
        <div className="text-sm font-semibold text-[#18181b]">
          {order?.total_amount_rub != null ? `${Number(order.total_amount_rub).toLocaleString('ru-RU')} ₽` : (order?.total_amount_eur != null ? `EUR ${Number(order.total_amount_eur).toLocaleString('ru-RU')}` : '')}
        </div>
      </div>
    </button>
  )
}


