import * as React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { crmManagerApi } from '@/api/crmManagerApi'

type Customer = {
  customer_id: string
  full_name?: string
  email?: string
  phone?: string
  city?: string
  country?: string
  contact_value?: string
  preferred_channel?: string
  total_orders?: number
  total_spent?: number
  total_spent_rub?: number
  created_at?: string
}

type Order = {
  order_id: string
  order_number: string
  status: string
  total_amount?: number
  total_amount_rub?: number
  created_at?: string
}

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = React.useState<Customer | null>(null)
  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let mounted = true

    const load = async () => {
      if (!customerId) return
      setLoading(true)
      try {
        const res = await crmManagerApi.getCustomer(customerId)
        if (!mounted) return
        if (res?.success) {
          setCustomer(res.customer || null)
          setOrders(res.orders || [])
        }
      } catch (e) {
        console.error('Customer detail load error', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [customerId])

  if (loading) {
    return <div className="text-sm text-slate-500">Загрузка...</div>
  }

  if (!customer) {
    return <div className="text-sm text-slate-500">Клиент не найден</div>
  }

  const totalOrders = customer.total_orders != null ? Number(customer.total_orders) : orders.length
  const totalSpentEur = customer.total_spent != null
    ? Number(customer.total_spent)
    : orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0)
  const totalSpentRub = customer.total_spent_rub != null
    ? Number(customer.total_spent_rub)
    : orders.reduce((sum, order) => sum + (Number(order.total_amount_rub) || 0), 0)

  const phoneDigits = (customer.phone || '').replace(/[^0-9]/g, '')

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold text-[#18181b]">{customer.full_name || 'Клиент'}</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase text-slate-400">Email</div>
            <div className="font-medium">{customer.email || '--'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Телефон</div>
            <div className="font-medium">
              {customer.phone ? (
                <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="text-blue-600 underline">
                  {customer.phone}
                </a>
              ) : (customer.contact_value || '--')}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Город</div>
            <div className="font-medium">{customer.city || customer.country || '--'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Всего заказов</div>
            <div className="font-medium" data-testid="customer-total-orders">{totalOrders}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Сумма заказов</div>
            <div className="font-medium" data-testid="customer-total-spent">
              {totalSpentRub > 0
                ? `${totalSpentRub.toLocaleString('ru-RU')} ₽`
                : `EUR ${totalSpentEur.toLocaleString('ru-RU')}`}
            </div>
          </div>
        </div>
        {(customer.phone || customer.email) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
            {customer.phone && (
              <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="flex items-center justify-center h-10 rounded-lg bg-[#18181b] text-white text-xs">
                Позвонить
              </a>
            )}
            {customer.phone && (
              <a
                href={`https://wa.me/${phoneDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center h-10 rounded-lg border border-[#18181b] text-xs text-[#18181b]"
              >
                WhatsApp
              </a>
            )}
            {customer.phone && (
              <a
                href={`https://t.me/+${phoneDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center h-10 rounded-lg border border-[#18181b] text-xs text-[#18181b]"
              >
                Telegram
              </a>
            )}
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                className="flex items-center justify-center h-10 rounded-lg border border-[#18181b] text-xs text-[#18181b]"
              >
                Email
              </a>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-[#18181b]">Заказы клиента</h3>
        <div className="mt-4 space-y-2">
          {orders.length === 0 && (
            <div className="text-sm text-slate-500">Заказов пока нет</div>
          )}
          {orders.map((order) => (
            <div
              key={order.order_id}
              data-testid="customer-order-item"
              onClick={() => navigate(`/crm/orders/${order.order_id}`)}
              className="rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] px-4 py-3 cursor-pointer hover:border-[#18181b] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[#18181b]">{order.order_number}</div>
                  <div className="text-xs text-slate-500">{order.status}</div>
                </div>
                <div className="text-sm font-medium">
                  {order.total_amount_rub != null
                    ? `${Number(order.total_amount_rub).toLocaleString('ru-RU')} ₽`
                    : order.total_amount != null
                      ? `EUR ${Number(order.total_amount).toLocaleString('ru-RU')}`
                      : '--'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
