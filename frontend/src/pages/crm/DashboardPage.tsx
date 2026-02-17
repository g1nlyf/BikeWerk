import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { crmManagerApi } from '@/api/crmManagerApi'
import StatsCard from '@/components/crm/StatsCard'
import OrderCard from '@/components/crm/OrderCard'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ORDER_STATUS, getOrderStatusPresentation } from '@/lib/orderLifecycle'
import type { CrmScope } from '@/lib/crmScope'
import { getCurrentCrmUser, isCrmAdmin, resolveCrmScope, setGlobalCrmScope, subscribeCrmScopeChange } from '@/lib/crmScope'

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
    ORDER_STATUS.BOOKED,
    ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
    ORDER_STATUS.FULL_PAYMENT_PENDING,
    ORDER_STATUS.DELIVERED
].map((status) => ({
    key: status,
    label: getOrderStatusPresentation(status).shortLabel
}))

export default function DashboardPage() {
    const navigate = useNavigate()
    const [stats, setStats] = React.useState<DashboardStats | null>(null)
    const [kanban, setKanban] = React.useState<Record<string, OrderSummary[]>>({})
    const [tasks, setTasks] = React.useState<Task[]>([])
    const [loading, setLoading] = React.useState(true)
    const currentUser = React.useMemo(() => getCurrentCrmUser(), [])
    const [scope, setScope] = React.useState<CrmScope>(() => resolveCrmScope(currentUser))
    const isAdmin = isCrmAdmin(currentUser)
    const currentUserId = String(currentUser?.id || '').trim()

    React.useEffect(() => {
        setScope(resolveCrmScope(currentUser))
    }, [currentUser, isAdmin])

    React.useEffect(() => {
        if (!isAdmin && scope !== 'mine') {
            setScope('mine')
            return
        }
        setGlobalCrmScope(scope, currentUser)
    }, [scope, isAdmin, currentUser])

    React.useEffect(() => {
        return subscribeCrmScopeChange(() => {
            setScope(resolveCrmScope(currentUser))
        })
    }, [currentUser])

    React.useEffect(() => {
        let mounted = true
        const load = async () => {
            try {
                const statsFilters = { scope }
                const ordersFilters = { scope }
                const taskFilters: Record<string, unknown> = {
                    status: 'pending',
                    limit: 5
                }
                if (scope === 'mine' && currentUserId) {
                    taskFilters.manager = currentUserId
                }

                const [statsRes, ...boards] = await Promise.all([
                    crmManagerApi.getDashboardStats(statsFilters),
                    ...kanbanStatuses.map((s) => crmManagerApi.getOrders({ status: s.key, limit: 5, ...ordersFilters }))
                ])

                if (!mounted) return
                if (statsRes?.success) setStats(statsRes.stats as DashboardStats)

                const next: Record<string, OrderSummary[]> = {}
                boards.forEach((res, idx) => {
                    const key = kanbanStatuses[idx]?.key
                    next[key] = Array.isArray(res?.orders) ? res.orders : []
                })
                setKanban(next)

                const taskRes = await crmManagerApi.getTasks(taskFilters)
                if (mounted) setTasks(Array.isArray(taskRes?.tasks) ? taskRes.tasks : [])
            } catch (e) {
                console.error('Dashboard load error', e)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [scope, currentUserId])

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

    const activeFilter = [ORDER_STATUS.BOOKED, ORDER_STATUS.RESERVE_PAYMENT_PENDING, ORDER_STATUS.RESERVE_PAID, ORDER_STATUS.SELLER_CHECK_IN_PROGRESS, ORDER_STATUS.CHECK_READY, ORDER_STATUS.AWAITING_CLIENT_DECISION, ORDER_STATUS.FULL_PAYMENT_PENDING, ORDER_STATUS.FULL_PAYMENT_RECEIVED, ORDER_STATUS.BIKE_BUYOUT_COMPLETED, ORDER_STATUS.SELLER_SHIPPED, ORDER_STATUS.EXPERT_RECEIVED, ORDER_STATUS.EXPERT_INSPECTION_IN_PROGRESS, ORDER_STATUS.EXPERT_REPORT_READY, ORDER_STATUS.AWAITING_CLIENT_DECISION_POST_INSPECTION, ORDER_STATUS.WAREHOUSE_RECEIVED, ORDER_STATUS.WAREHOUSE_REPACKED, ORDER_STATUS.SHIPPED_TO_RUSSIA].join(',')

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">Режим данных</div>
                        <div className="text-sm font-semibold text-[#18181b]">
                            {scope === 'mine' ? 'Показываются только ваши заказы и KPI' : 'Показываются все заказы и KPI'}
                        </div>
                    </div>
                    {isAdmin ? (
                        <div className="flex rounded-lg border border-[#e4e4e7] overflow-hidden">
                            <button
                                type="button"
                                onClick={() => {
                                    setGlobalCrmScope('mine', currentUser)
                                    setScope('mine')
                                }}
                                className={`px-3 py-2 text-xs font-medium transition-colors ${
                                    scope === 'mine' ? 'bg-[#18181b] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Только мои
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setGlobalCrmScope('all', currentUser)
                                    setScope('all')
                                }}
                                className={`px-3 py-2 text-xs font-medium transition-colors ${
                                    scope === 'all' ? 'bg-[#18181b] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Все заказы
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-full border border-[#e4e4e7] bg-[#f4f4f5] px-3 py-1.5 text-xs text-slate-600">
                            Режим менеджера: только мои
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <StatsCard
                    title="Всего заказов"
                    value={stats?.total_orders ?? 0}
                    hint="За все время"
                    delta={stats?.last_7_days ? `+${stats.last_7_days} за 7 дней` : undefined}
                    onClick={() => navigate(`/crm/orders?scope=${scope}`)}
                />
                <StatsCard
                    title="Активные"
                    value={stats?.active_orders ?? 0}
                    hint="В работе"
                    onClick={() => navigate(`/crm/orders?status=${encodeURIComponent(activeFilter)}&scope=${scope}`)}
                />
                <StatsCard
                    title="Ждут менеджера"
                    value={stats?.pending_manager ?? 0}
                    hint="Новые заявки"
                    onClick={() => navigate(`/crm/orders?status=${encodeURIComponent([ORDER_STATUS.BOOKED, ORDER_STATUS.RESERVE_PAYMENT_PENDING].join(','))}&scope=${scope}`)}
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
                    onClick={() => navigate(`/crm/orders?scope=${scope}`)}
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
