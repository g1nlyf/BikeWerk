import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { crmManagerApi } from '@/api/crmManagerApi'
import StatsCard from '@/components/crm/StatsCard'
import OrderCard from '@/components/crm/OrderCard'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type DashboardStats = {
    total_orders?: number
    active_orders?: number
    pending_manager?: number
    revenue_rub?: number
    last_7_days?: number
    conversion_rate?: number | null
    conversion_note?: string | null
    daily_orders?: Array<{ date: string; orders: number; revenue_rub?: number; revenue_eur?: number }>
}

type OrderSummary = {
    order_id?: string
    order_number?: string
    status?: string
    total_amount_rub?: number
    total_amount_eur?: number
    bike_name?: string
    customer?: { full_name?: string; phone?: string; email?: string }
}

type Task = {
    id: string
    title: string
    description?: string
    order_id?: string
    due_at?: string
}

const kanbanStatuses = [
    { key: 'pending_manager', label: 'Ждет менеджера' },
    { key: 'under_inspection', label: 'Проверка' },
    { key: 'deposit_paid', label: 'Резерв оплачен' },
    { key: 'delivered', label: 'Доставлен' }
]

export default function DashboardPage() {
    const navigate = useNavigate()
    const [stats, setStats] = React.useState<DashboardStats | null>(null)
    const [kanban, setKanban] = React.useState<Record<string, OrderSummary[]>>({})
    const [tasks, setTasks] = React.useState<Task[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        let mounted = true
        const load = async () => {
            try {
                const [statsRes, ...boards] = await Promise.all([
                    crmManagerApi.getDashboardStats(),
                    ...kanbanStatuses.map((s) => crmManagerApi.getOrders({ status: s.key, limit: 5 }))
                ])

                if (!mounted) return
                if (statsRes?.success) setStats(statsRes.stats as DashboardStats)

                const next: Record<string, OrderSummary[]> = {}
                boards.forEach((res, idx) => {
                    const key = kanbanStatuses[idx]?.key
                    next[key] = Array.isArray(res?.orders) ? res.orders : []
                })
                setKanban(next)

                const taskRes = await crmManagerApi.getTasks({ status: 'pending', limit: 5 })
                if (mounted) setTasks(Array.isArray(taskRes?.tasks) ? taskRes.tasks : [])
            } catch (e) {
                console.error('Dashboard load error', e)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [])

    const chartData = React.useMemo(() => {
        const daily = Array.isArray(stats?.daily_orders) ? stats?.daily_orders || [] : []
        if (!daily.length) return []
        return daily.map((d) => {
            const label = (() => {
                try {
                    return new Date(d.date).toLocaleDateString('ru-RU', { weekday: 'short' })
                } catch {
                    return d.date
                }
            })()
            return { day: label, orders: Number(d.orders || 0) }
        })
    }, [stats])

    const revenueValue = stats?.revenue_rub != null
        ? `${Number(stats.revenue_rub).toLocaleString('ru-RU')} ₽`
        : '--'

    const activeFilter = 'pending_manager,under_inspection,awaiting_deposit,deposit_paid,awaiting_payment,ready_for_shipment,in_transit'

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <StatsCard
                    title="Всего заказов"
                    value={stats?.total_orders ?? 0}
                    hint="За все время"
                    delta={stats?.last_7_days ? `+${stats.last_7_days} за 7 дней` : undefined}
                    onClick={() => navigate('/crm/orders')}
                />
                <StatsCard
                    title="Активные"
                    value={stats?.active_orders ?? 0}
                    hint="В работе"
                    onClick={() => navigate(`/crm/orders?status=${encodeURIComponent(activeFilter)}`)}
                />
                <StatsCard
                    title="Ждут менеджера"
                    value={stats?.pending_manager ?? 0}
                    hint="Новые заявки"
                    onClick={() => navigate('/crm/orders?status=pending_manager')}
                />
                <StatsCard
                    title="Конверсия"
                    value={stats?.conversion_rate != null ? `${stats.conversion_rate}%` : 'н/д'}
                    hint={stats?.conversion_note || 'Закрытые / Всего'}
                />
                <StatsCard
                    title="Выручка"
                    value={revenueValue}
                    hint="Сумма заказов"
                    onClick={() => navigate('/crm/orders')}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-slate-400">Динамика</div>
                            <div className="text-lg font-semibold text-[#18181b]">Заказы за неделю</div>
                        </div>
                    </div>
                    <div className="mt-4 h-56">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <XAxis dataKey="day" tickLine={false} axisLine={false} />
                                    <YAxis tickLine={false} axisLine={false} width={28} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="orders" stroke="#18181b" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full rounded-xl bg-[#f4f4f5]" />
                        )}
                    </div>
                </div>
                <div className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Срочные задачи</div>
                    <div className="mt-2 text-lg font-semibold text-[#18181b]">Сегодня</div>
                    <div className="mt-4 space-y-3">
                        {tasks.length === 0 && !loading && (
                            <div className="text-sm text-slate-500">Срочных задач нет</div>
                        )}
                        {tasks.map((task) => (
                            <div key={task.id} className="rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-4 py-3">
                                <div className="text-sm font-medium text-[#18181b]">{task.title}</div>
                                {task.description && <div className="text-xs text-slate-500 mt-1">{task.description}</div>}
                                <div className="mt-2 flex items-center justify-between">
                                    {task.order_id ? (
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/crm/orders/${task.order_id}`)}
                                            className="text-xs text-[#18181b] underline"
                                        >
                                            Открыть заказ
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/crm/tasks')}
                                            className="text-xs text-[#18181b] underline"
                                        >
                                            Открыть список задач
                                        </button>
                                    )}
                                    {task.due_at ? (
                                        <div className="text-[11px] text-slate-500">
                                            До {new Date(task.due_at).toLocaleDateString('ru-RU')}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/crm/tasks')}
                        className="mt-4 h-10 w-full rounded-lg bg-[#18181b] text-white text-xs"
                    >
                        Все задачи
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                {kanbanStatuses.map((status) => (
                    <div key={status.key} className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
                        <div className="mb-3 text-sm font-semibold text-[#18181b]">{status.label}</div>
                        <div className="space-y-3">
                            {(kanban[status.key] || []).map((order) => (
                                <OrderCard
                                    key={order.order_id || order.order_number}
                                    order={order}
                                    onClick={() => navigate(`/crm/orders/${order.order_id || order.order_number}`)}
                                />
                            ))}
                            {(kanban[status.key] || []).length === 0 && !loading && (
                                <div className="text-xs text-slate-500">Нет заказов</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
