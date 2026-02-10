import * as React from 'react'
import { resolveImageUrl } from '@/api'

type OrderSummary = {
  order_id: string
  order_number?: string
  status?: string
  total_amount_rub?: number
  total_amount_eur?: number
  bike_name?: string
  assigned_manager?: string
  customer?: { full_name?: string; phone?: string; email?: string; contact_value?: string }
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
  items?: Array<{ image_url?: string; main_image?: string; image?: string }>
}

type Column = {
  status: string
  label: string
  color: string
  orders: OrderSummary[]
}

type Props = {
  orders: OrderSummary[]
  onOrderClick: (orderId: string) => void
  onStatusChange: (orderId: string, newStatus: string) => Promise<void>
}

const KANBAN_COLUMNS: { status: string; label: string; color: string }[] = [
  { status: 'pending_manager', label: 'Ждут менеджера', color: 'border-t-[#18181b]' },
  { status: 'under_inspection', label: 'Проверка', color: 'border-t-[#18181b]' },
  { status: 'awaiting_deposit', label: 'Ожидают резерв', color: 'border-t-[#18181b]' },
  { status: 'deposit_paid', label: 'Резерв оплачен', color: 'border-t-[#18181b]' },
  { status: 'awaiting_payment', label: 'Ожидают оплату', color: 'border-t-[#18181b]' },
  { status: 'ready_for_shipment', label: 'Готовы к отправке', color: 'border-t-[#18181b]' },
  { status: 'in_transit', label: 'В пути', color: 'border-t-[#18181b]' },
  { status: 'delivered', label: 'Доставлено', color: 'border-t-[#18181b]' }
]

function extractOrderImage(order: OrderSummary): string | null {
  const snapshot = (() => {
    if (!order.bike_snapshot) return null
    if (typeof order.bike_snapshot === 'string') {
      try {
        return JSON.parse(order.bike_snapshot)
      } catch {
        return null
      }
    }
    return order.bike_snapshot
  })()

  const firstImage = (value: unknown) => {
    if (Array.isArray(value)) return value.find((v) => typeof v === 'string' && v.trim()) || null
    if (typeof value === 'string' && value.trim()) return value
    return null
  }

  const imageCandidate = firstImage(snapshot?.cached_images)
  return resolveImageUrl(imageCandidate)
}

function isArchivedBike(order: OrderSummary): boolean {
  let snapshot: unknown = order.bike_snapshot
  if (typeof snapshot === 'string') {
    try { snapshot = JSON.parse(snapshot) } catch { snapshot = null }
  }
  if (!snapshot || typeof snapshot !== 'object') return Boolean(order.bike_name)
  const data = snapshot as { archived_bike?: boolean; external_bike_ref?: string; bike_id?: string }
  return Boolean(data.archived_bike || data.external_bike_ref || data.bike_id || order.bike_name)
}

export default function KanbanBoard({ orders, onOrderClick, onStatusChange }: Props) {
  const [draggedOrder, setDraggedOrder] = React.useState<OrderSummary | null>(null)
  const [dragOverColumn, setDragOverColumn] = React.useState<string | null>(null)

  const columns: Column[] = React.useMemo(() => {
    return KANBAN_COLUMNS.map((column) => ({
      ...column,
      orders: orders.filter((order) => order.status === column.status)
    }))
  }, [orders])

  const handleDragStart = (e: React.DragEvent, order: OrderSummary) => {
    setDraggedOrder(order)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', order.order_id)
  }

  const handleDragEnd = () => {
    setDraggedOrder(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(status)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedOrder || draggedOrder.status === status) return

    try {
      await onStatusChange(draggedOrder.order_id, status)
    } catch (err) {
      console.error('Drop failed:', err)
    }

    setDraggedOrder(null)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <div
          key={column.status}
          onDragOver={(e) => handleDragOver(e, column.status)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.status)}
          className={`flex-shrink-0 w-72 rounded-xl border border-[#e4e4e7] bg-white shadow-sm border-t-4 ${column.color} transition-all ${
            dragOverColumn === column.status ? 'bg-[#f4f4f5] border-[#18181b]' : ''
          }`}
        >
          <div className="p-3 border-b border-[#e4e4e7]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[#18181b]">{column.label}</h3>
              <span className="text-xs bg-[#f4f4f5] text-slate-600 px-2 py-0.5 rounded-full">
                {column.orders.length}
              </span>
            </div>
          </div>

          <div className="p-2 space-y-2 min-h-[200px] max-h-[600px] overflow-y-auto">
            {column.orders.map((order) => {
              const imageUrl = extractOrderImage(order)
              return (
                <div
                  key={order.order_id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, order)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onOrderClick(order.order_id)}
                  className={`p-3 rounded-lg border border-[#e4e4e7] bg-white cursor-grab hover:border-[#18181b] hover:shadow-sm transition-all ${
                    draggedOrder?.order_id === order.order_id ? 'opacity-50 scale-95' : ''
                  }`}
                >
                  <div className="mb-2 h-20 w-full rounded-md bg-[#f4f4f5] overflow-hidden flex items-center justify-center">
                    {imageUrl ? (
                      <img src={imageUrl} alt={order.bike_name || 'Байк'} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center leading-tight">
                        <div className="text-[11px] text-slate-400">Нет фото</div>
                        {isArchivedBike(order) ? <div className="text-[10px] text-amber-600 mt-1">Архивный байк</div> : null}
                      </div>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#18181b] truncate">
                        {order.order_number || order.order_id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-1">
                        {order.bike_name || 'Без названия'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500 truncate max-w-[60%]">
                      {order.customer?.full_name || 'Без клиента'}
                    </span>
                    <span className="text-xs font-medium text-[#18181b]">
                      {order.total_amount_eur != null
                        ? `EUR ${Number(order.total_amount_eur).toLocaleString('ru-RU')}`
                        : order.total_amount_rub != null
                          ? `${Number(order.total_amount_rub).toLocaleString('ru-RU')} ₽`
                          : '-'}
                    </span>
                  </div>
                </div>
              )
            })}

            {column.orders.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400">
                Нет заказов
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
