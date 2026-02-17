
import * as React from 'react'
import { useParams } from 'react-router-dom'
import { crmManagerApi } from '@/api/crmManagerApi'
import { resolveImageUrl } from '@/api'
import OrderStatusBadge from '@/components/crm/OrderStatusBadge'
import InspectionChecklist from '@/components/crm/InspectionChecklist'
import ChecklistItemModal from '@/components/crm/ChecklistItemModal'
import { useToast } from '@/components/crm/ToastProvider'
import { ORDER_STATUS_OPTIONS, getOrderStatusPresentation, normalizeOrderStatus } from '@/lib/orderLifecycle'

type Manager = {
    id: string
    name?: string
    email?: string
}

type OrderItem = {
    main_image?: string
    image_url?: string
    image?: string
    photos?: string | string[]
    basic_info?: { name?: string; brand?: string; model?: string }
    name?: string
}

type OrderDetail = {
    order_id?: string
    order_number?: string
    status?: string
    total_amount?: number
    total_amount_rub?: number
    created_at?: string
    booking_amount?: number
    assigned_manager?: string
    assigned_manager_name?: string
    bike_name?: string
    bike_url?: string
    bike_snapshot?: {
        bike_id?: string
        archived_bike?: boolean
        external_bike_ref?: string
        bike_url?: string
        source_url?: string
        url?: string
        listing_url?: string
        offer_url?: string
        original_url?: string
        link?: string
        links?: { listing?: string; source?: string }
        source?: { url?: string; link?: string }
        internal?: { source_url?: string; source_link?: string }
        main_photo_url?: string
        main_image?: string
        image_url?: string
        image?: string
        photos?: string[] | string
        images?: string[] | string
        cached_images?: string[] | string
    } | string
    customer?: { full_name?: string; phone?: string; email?: string; city?: string; contact_value?: string; preferred_channel?: string }
}

type OrderHistory = {
    old_status?: string
    status?: string
    new_status?: string
    change_notes?: string
    note?: string
    created_at?: string
}

type Shipment = {
    id: string
    provider?: string
    carrier?: string
    tracking_number?: string
    estimated_delivery_date?: string
    estimated_delivery?: string
    warehouse_received?: boolean
    warehouse_photos_received?: boolean
    client_received?: boolean
    ruspost_status?: unknown
}

type Transaction = {
    id: string
    amount: number
    type?: string
    method?: string
    description?: string
    transaction_date?: string
    status?: string
    currency?: string
}

type FinanceSummary = {
    total_paid?: number
    total_refunded?: number
    balance?: number
}

type Task = {
    id: string
    title: string
    description?: string
    completed?: boolean | number
    due_at?: string
    assigned_to?: string
}

type OrderDetailResponse = {
    success?: boolean
    order?: OrderDetail
    items?: OrderItem[]
    history?: OrderHistory[]
    logistics?: Shipment[]
}

const STATUS_OPTIONS = ORDER_STATUS_OPTIONS.map((status) => ({
    value: status.value,
    label: getOrderStatusPresentation(status.value).label
}))

export default function OrderDetailPage() {
    const { orderId } = useParams()
    const toast = useToast()
    const [detail, setDetail] = React.useState<OrderDetailResponse | null>(null)
    const [managers, setManagers] = React.useState<Manager[]>([])
    const [loading, setLoading] = React.useState(true)

    const [checklist, setChecklist] = React.useState<Record<string, { status: boolean | null; comment: string; photos: string[] }>>({})
    const [checklistProgress, setChecklistProgress] = React.useState({ total: 28, completed: 0, passed: 0, failed: 0, percentage: 0 })
    const [checklistLoading, setChecklistLoading] = React.useState(true)
    const [modalOpen, setModalOpen] = React.useState(false)
    const [selectedItem, setSelectedItem] = React.useState<{ id: string; label: string; data: { status: boolean | null; comment: string; photos: string[] } } | null>(null)

    const [shipments, setShipments] = React.useState<Shipment[]>([])
    const [transactions, setTransactions] = React.useState<Transaction[]>([])
    const [financeSummary, setFinanceSummary] = React.useState<FinanceSummary | null>(null)
    const [tasks, setTasks] = React.useState<Task[]>([])

    const [transactionForm, setTransactionForm] = React.useState({ amount: '', type: 'payment', method: 'bank_transfer', description: '' })
    const [shipmentForm, setShipmentForm] = React.useState({ provider: '', tracking_number: '', estimated_delivery_date: '' })
    const [taskForm, setTaskForm] = React.useState({ assigned_to: '', due_at: '' })
    const [quickTask, setQuickTask] = React.useState('')
    const [priceDraft, setPriceDraft] = React.useState('')
    const [priceSaving, setPriceSaving] = React.useState(false)

    const currentUser = React.useMemo(() => {
        try {
            const raw = localStorage.getItem('currentUser')
            return raw ? JSON.parse(raw) : null
        } catch {
            return null
        }
    }, [])

    const currentManagerId = React.useMemo(() => {
        if (!currentUser?.email) return ''
        const match = managers.find((m) => (m.email || '').toLowerCase() === String(currentUser.email).toLowerCase())
        return match?.id || ''
    }, [managers, currentUser])

    const canonicalOrderId = React.useMemo(() => {
        return detail?.order?.order_id || orderId || ''
    }, [detail?.order?.order_id, orderId])

    const CHECKLIST_LABELS: Record<string, string> = {
        '1_brand_verified': 'Brand verified',
        '2_model_verified': 'Model verified',
        '3_year_verified': 'Year verified',
        '4_frame_size_verified': 'Frame size verified',
        '5_serial_number': 'Serial number checked',
        '6_frame_condition': 'Frame condition',
        '7_fork_condition': 'Fork condition',
        '8_shock_condition': 'Shock condition',
        '9_drivetrain_condition': 'Drivetrain condition',
        '10_brakes_condition': 'Brakes condition',
        '11_wheels_condition': 'Wheels condition',
        '12_tires_condition': 'Tires condition',
        '13_headset_check': 'Headset check',
        '14_bottom_bracket_check': 'Bottom bracket check',
        '15_suspension_service_history': 'Suspension service history',
        '16_brake_pads_percentage': 'Brake pads wear (%)',
        '17_chain_wear': 'Chain wear',
        '18_cassette_wear': 'Cassette wear',
        '19_rotor_condition': 'Rotor condition',
        '20_bearing_play': 'Bearing play',
        '21_original_owner': 'Original owner',
        '22_proof_of_purchase': 'Proof of purchase',
        '23_warranty_status': 'Warranty status',
        '24_crash_history': 'Crash history',
        '25_reason_for_sale': 'Reason for sale',
        '26_upgrades_verified': 'Upgrades verified',
        '27_test_ride_completed': 'Test ride completed',
        '28_final_approval': 'Final approval'
    }

    const loadChecklist = React.useCallback(async () => {
        if (!orderId) return
        setChecklistLoading(true)
        try {
            const res = await crmManagerApi.getChecklist(orderId)
            if (res?.success) {
                setChecklist(res.checklist || {})
                setChecklistProgress(res.progress || { total: 28, completed: 0, passed: 0, failed: 0, percentage: 0 })
            }
        } catch (e) {
            console.error('Load checklist error', e)
        } finally {
            setChecklistLoading(false)
        }
    }, [orderId])

    const loadShipments = React.useCallback(async () => {
        if (!canonicalOrderId) return
        try {
            const res = await crmManagerApi.getShipments(canonicalOrderId)
            if (res?.success) setShipments(res.shipments || [])
        } catch (e) {
            console.error('Load shipments error', e)
        }
    }, [canonicalOrderId])

    const loadTransactions = React.useCallback(async () => {
        if (!canonicalOrderId) return
        try {
            const res = await crmManagerApi.getTransactions(canonicalOrderId)
            if (res?.success) {
                setTransactions(res.transactions || [])
                setFinanceSummary(res.summary || null)
            }
        } catch (e) {
            console.error('Load transactions error', e)
        }
    }, [canonicalOrderId])

    const loadTasks = React.useCallback(async () => {
        if (!canonicalOrderId) return
        try {
            const res = await crmManagerApi.getTasks({ order_id: canonicalOrderId, limit: 50 })
            if (res?.success) setTasks(res.tasks || [])
        } catch (e) {
            console.error('Load tasks error', e)
        }
    }, [canonicalOrderId])

    React.useEffect(() => {
        let mounted = true
        const load = async () => {
            if (!orderId) return
            setLoading(true)
            try {
                const [detailRes, managersRes] = await Promise.all([
                    crmManagerApi.getOrder(orderId),
                    crmManagerApi.getManagers()
                ])
                if (!mounted) return
                if (detailRes?.order || detailRes?.success) {
                    const nextDetail = detailRes as OrderDetailResponse
                    setDetail(nextDetail)
                    const amount = nextDetail?.order?.total_amount
                    if (amount != null && Number.isFinite(Number(amount))) {
                        setPriceDraft(String(amount))
                    }
                }
                if (managersRes?.success) setManagers(managersRes.managers || [])
            } catch (e) {
                console.error('Order detail load error', e)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        loadChecklist()
        loadShipments()
        loadTransactions()
        loadTasks()
        return () => { mounted = false }
    }, [orderId, loadChecklist, loadShipments, loadTransactions, loadTasks])

    React.useEffect(() => {
        if (currentManagerId && !taskForm.assigned_to) {
            setTaskForm((prev) => ({ ...prev, assigned_to: currentManagerId }))
        }
    }, [currentManagerId, taskForm.assigned_to])

    const order = detail?.order
    const items = detail?.items || []
    const item = items[0]
    const orderSnapshot = (() => {
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
    const snapshotImage = firstImage(orderSnapshot?.cached_images)
    const image = resolveImageUrl(snapshotImage)
    const archivedBike = !image && Boolean(orderSnapshot?.archived_bike || orderSnapshot?.external_bike_ref || orderSnapshot?.bike_id || order?.bike_name)
    const listingUrl = (() => {
        const candidates = [
            order?.bike_url,
            orderSnapshot?.bike_url,
            orderSnapshot?.source_url,
            orderSnapshot?.url,
            orderSnapshot?.listing_url,
            orderSnapshot?.offer_url,
            orderSnapshot?.original_url,
            orderSnapshot?.link,
            orderSnapshot?.links?.listing,
            orderSnapshot?.links?.source,
            orderSnapshot?.source?.url,
            orderSnapshot?.source?.link,
            orderSnapshot?.internal?.source_url,
            orderSnapshot?.internal?.source_link,
            (item as { source_url?: string; bike_url?: string; url?: string } | undefined)?.source_url,
            (item as { source_url?: string; bike_url?: string; url?: string } | undefined)?.bike_url,
            (item as { source_url?: string; bike_url?: string; url?: string } | undefined)?.url
        ]
        for (const raw of candidates) {
            if (typeof raw !== 'string') continue
            const value = raw.trim()
            if (!value) continue
            if (/^https?:\/\//i.test(value)) return value
            if (value.startsWith('//')) return `https:${value}`
        }
        return null
    })()

    const customer = order?.customer

    React.useEffect(() => {
        if (order?.total_amount != null) {
            setPriceDraft(String(order.total_amount))
        } else {
            setPriceDraft('')
        }
    }, [order?.order_id, order?.total_amount])

    const updateStatus = async (status: string) => {
        if (!canonicalOrderId) return
        const normalized = normalizeOrderStatus(status) || status
        const res = await crmManagerApi.updateOrderStatus(canonicalOrderId, status)
        if (res?.success) {
            setDetail((prev) => prev ? { ...prev, order: { ...prev.order, status: normalized } } : prev)
            toast.success('Статус заказа обновлен')
            return
        }
        toast.error('Не удалось обновить статус заказа')
    }

    const updateManager = async (managerId: string) => {
        if (!canonicalOrderId) return
        const res = await crmManagerApi.updateOrderManager(canonicalOrderId, managerId)
        if (res?.success) {
            setDetail((prev) => prev ? { ...prev, order: { ...prev.order, assigned_manager: managerId } } : prev)
            toast.success('Менеджер обновлен')
            return
        }
        toast.error('Не удалось обновить менеджера')
    }

    const updatePrice = async () => {
        if (!canonicalOrderId) return
        const parsed = Number(priceDraft)
        if (!Number.isFinite(parsed) || parsed < 0) {
            toast.error('Введите корректную цену')
            return
        }
        setPriceSaving(true)
        try {
            const res = await crmManagerApi.updateOrder(canonicalOrderId, { final_price_eur: parsed })
            if (res?.success) {
                setDetail((prev) => prev ? { ...prev, order: { ...prev.order, total_amount: parsed } } : prev)
                toast.success('Цена сохранена')
            } else {
                toast.error('Не удалось сохранить цену')
            }
        } catch (error) {
            console.error('Update price error', error)
            toast.error('Не удалось сохранить цену')
        } finally {
            setPriceSaving(false)
        }
    }

    const createOrderTask = React.useCallback(async (title: string) => {
        const normalized = title.trim()
        if (!normalized || !canonicalOrderId) return false
        try {
            const res = await crmManagerApi.createTask({
                title: normalized,
                order_id: canonicalOrderId,
                assigned_to: taskForm.assigned_to || currentManagerId || null,
                due_at: taskForm.due_at || null
            })
            if (res?.success) {
                await loadTasks()
                toast.success('Задача создана')
                return true
            }
            toast.error('Не удалось создать задачу')
            return false
        } catch (error) {
            console.error('Create task error', error)
            toast.error('Не удалось создать задачу')
            return false
        }
    }, [canonicalOrderId, currentManagerId, loadTasks, taskForm.assigned_to, taskForm.due_at, toast])

    const normalizeShipmentProvider = (value: string) => {
        const normalized = value.trim().toLowerCase()
        if (!normalized) return undefined
        if (normalized === 'rusbid') return 'rusbid'
        // Keep persistence stable with strict provider enums in backend.
        return 'rusbid'
    }

    if (loading) {
        return <div className="text-sm text-slate-500">Загрузка...</div>
    }

    if (!order) {
        return <div className="text-sm text-slate-500">Заказ не найден</div>
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
                <div className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="h-40 w-full md:w-56 rounded-xl bg-[#f4f4f5] overflow-hidden flex items-center justify-center">
                            {image ? (
                                <img src={image} alt={item?.basic_info?.name || item?.name || order?.bike_name || 'Bike'} className="h-full w-full object-cover" />
                            ) : (
                                <div className="text-center leading-tight">
                                    <div className="text-xs text-slate-400">Нет фото</div>
                                    {archivedBike ? <div className="text-[11px] text-amber-600 mt-1">Архивный байк</div> : null}
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-semibold text-[#18181b]">{item?.basic_info?.name || item?.name || order.bike_name || order.order_number}</h2>
                                <OrderStatusBadge status={order.status} />
                            </div>
                            <div className="mt-2 text-sm text-slate-500">{order.order_number}</div>
                            {listingUrl ? (
                                <div className="mt-2">
                                    <a
                                        href={listingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex h-9 items-center rounded-lg border border-[#18181b] px-3 text-xs font-medium text-[#18181b] hover:bg-[#18181b] hover:text-white"
                                    >
                                        Открыть объявление
                                    </a>
                                </div>
                            ) : null}
                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs uppercase text-slate-400">Сумма</div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            value={priceDraft}
                                            onChange={(e) => setPriceDraft(e.target.value)}
                                            data-testid="order-price-input"
                                            className="h-10 w-full rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm"
                                            placeholder="Цена в EUR"
                                        />
                                        <button
                                            type="button"
                                            onClick={updatePrice}
                                            disabled={priceSaving}
                                            data-testid="order-price-save"
                                            className="h-10 rounded-lg border border-[#18181b] px-3 text-xs text-[#18181b] disabled:opacity-60"
                                        >
                                            {priceSaving ? 'Сохранение...' : 'Сохранить'}
                                        </button>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        {order.total_amount_rub != null
                                            ? `Текущая: ${Number(order.total_amount_rub).toLocaleString('ru-RU')} ₽`
                                            : order.total_amount != null
                                                ? `Текущая: EUR ${Number(order.total_amount).toLocaleString('ru-RU')}`
                                                : 'Текущая: --'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase text-slate-400">Создан</div>
                                    <div className="font-medium">{order.created_at ? new Date(order.created_at).toLocaleDateString('ru-RU') : '--'}</div>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <select
                                    value={normalizeOrderStatus(order.status) || ''}
                                    onChange={(e) => updateStatus(e.target.value)}
                                    className="h-12 rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm"
                                >
                                    {STATUS_OPTIONS.map((s) => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                                <select
                                    value={order.assigned_manager || ''}
                                    onChange={(e) => updateManager(e.target.value)}
                                    className="h-12 rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm"
                                >
                                    <option value="">Назначить менеджера</option>
                                    {managers.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name || m.email}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <InspectionChecklist
                    orderId={orderId || ''}
                    checklist={checklist}
                    progress={checklistProgress}
                    loading={checklistLoading}
                    onItemClick={(itemId, itemData) => {
                        setSelectedItem({
                            id: itemId,
                            label: CHECKLIST_LABELS[itemId] || itemId,
                            data: itemData
                        })
                        setModalOpen(true)
                    }}
                    onRefresh={loadChecklist}
                />

                <ChecklistItemModal
                    isOpen={modalOpen}
                    onClose={() => {
                        setModalOpen(false)
                        setSelectedItem(null)
                    }}
                    itemId={selectedItem?.id || ''}
                    itemLabel={selectedItem?.label || ''}
                    item={selectedItem?.data || { status: null, comment: '', photos: [] }}
                    onSave={async (status, comment) => {
                        if (!orderId || !selectedItem) return
                        const res = await crmManagerApi.updateChecklistItem(orderId, selectedItem.id, { status, comment })
                        if (res?.success) await loadChecklist()
                    }}
                    onAddPhoto={async (photoUrl) => {
                        if (!orderId || !selectedItem) return
                        const res = await crmManagerApi.uploadChecklistPhotos(orderId, selectedItem.id, [photoUrl])
                        if (res?.success) await loadChecklist()
                    }}
                />

                <div className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
                    <div className="text-lg font-semibold text-[#18181b]">История</div>
                    <div className="mt-4 space-y-3">
                        {(detail?.history || []).map((event: OrderHistory, idx: number) => (
                            <div key={`${event.created_at}-${idx}`} className="rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-4 py-3">
                                <div className="text-sm font-medium text-[#18181b]">{event.new_status || event.status}</div>
                                <div className="text-xs text-slate-500 mt-1">{event.change_notes || event.note || 'Обновление статуса'}</div>
                                <div className="text-xs text-slate-400 mt-1">{event.created_at ? new Date(event.created_at).toLocaleString('ru-RU') : ''}</div>
                            </div>
                        ))}
                        {(!detail?.history || detail.history.length === 0) && (
                            <div className="text-sm text-slate-500">Событий пока нет</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
                    <div className="text-sm uppercase tracking-wide text-slate-400">Клиент</div>
                    <div className="mt-2 text-lg font-semibold text-[#18181b]">{customer?.full_name || order.order_number || '--'}</div>
                    <div className="mt-2 text-sm text-slate-500">{customer?.phone || customer?.email || customer?.contact_value || 'Нет контакта'}</div>
                    <div className="mt-1 text-sm text-slate-500">{customer?.city || 'Город не указан'}</div>
                    {(customer?.phone || customer?.email) && (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            {customer?.phone && (
                                <a
                                    href={`tel:${customer.phone.replace(/\s/g, '')}`}
                                    className="flex items-center justify-center h-10 rounded-lg bg-[#18181b] text-white text-xs"
                                >
                                    Позвонить
                                </a>
                            )}
                            {customer?.phone && (
                                <a
                                    href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center h-10 rounded-lg border border-[#18181b] text-xs text-[#18181b]"
                                >
                                    WhatsApp
                                </a>
                            )}
                            {customer?.phone && (
                                <a
                                    href={`https://t.me/+${customer.phone.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center h-10 rounded-lg border border-[#18181b] text-xs text-[#18181b]"
                                >
                                    Telegram
                                </a>
                            )}
                            {customer?.email && (
                                <a
                                    href={`mailto:${customer.email}`}
                                    className="flex items-center justify-center h-10 rounded-lg border border-[#18181b] text-xs text-[#18181b]"
                                >
                                    Email
                                </a>
                            )}
                            {customer?.phone && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(customer.phone || '').catch((error) => {
                                            console.warn('Clipboard write failed', error)
                                        })
                                    }}
                                    className="flex items-center justify-center h-10 rounded-lg border border-[#e4e4e7] text-xs text-slate-600"
                                >
                                    Копировать
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="text-sm uppercase tracking-wide text-slate-400">Задачи</div>
                        <button
                            type="button"
                            onClick={loadTasks}
                            className="text-xs text-slate-500 underline"
                        >
                            Обновить
                        </button>
                    </div>
                    <div className="mt-3 space-y-2">
                        {tasks.length === 0 && (
                            <div className="text-sm text-slate-500">Для этого заказа задач пока нет</div>
                        )}
                        {tasks.map((task) => (
                            <div key={task.id} className="rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] px-3 py-2">
                                <div className="text-sm font-medium text-[#18181b]">{task.title}</div>
                                {task.description && <div className="text-xs text-slate-500">{task.description}</div>}
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 space-y-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">Быстрая задача</div>
                        <div className="flex gap-2">
                            <input
                                value={quickTask}
                                onChange={(e) => setQuickTask(e.target.value)}
                                data-testid="order-quick-task-input"
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        const ok = await createOrderTask(quickTask)
                                        if (ok) setQuickTask('')
                                    }
                                }}
                                placeholder="Что нужно сделать?"
                                className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                            />
                            <button
                                type="button"
                                onClick={async () => {
                                    const ok = await createOrderTask(quickTask)
                                    if (ok) setQuickTask('')
                                }}
                                data-testid="order-quick-task-add"
                                className="h-12 rounded-lg bg-[#18181b] px-4 text-sm text-white"
                            >
                                Добавить
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {['Позвонить клиенту', 'Запросить фото', 'Отправить счет'].map((template) => (
                                <button
                                    key={template}
                                    type="button"
                                    onClick={async () => {
                                        await createOrderTask(template)
                                    }}
                                    className="h-9 rounded-lg border border-[#e4e4e7] px-3 text-xs text-slate-600 hover:border-[#18181b] hover:text-[#18181b]"
                                >
                                    {template}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            <select
                                value={taskForm.assigned_to}
                                onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                                className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                            >
                                <option value="">Назначить менеджера</option>
                                {managers.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                                ))}
                            </select>
                            <input
                                type="date"
                                value={taskForm.due_at}
                                onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })}
                                className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
                    <div className="text-sm uppercase tracking-wide text-slate-400">Финансы</div>
                    <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Итого</span>
                            <span className="font-medium">
                                {order.total_amount_rub != null
                                    ? `${Number(order.total_amount_rub).toLocaleString('ru-RU')} ₽`
                                    : order.total_amount != null
                                        ? `EUR ${Number(order.total_amount).toLocaleString('ru-RU')}`
                                        : '--'}
                            </span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                            <span>Оплачено</span>
                            <span>{financeSummary?.total_paid != null ? `EUR ${Number(financeSummary.total_paid).toLocaleString('ru-RU')}` : '--'}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                            <span>Возвраты</span>
                            <span>{financeSummary?.total_refunded != null ? `EUR ${Number(financeSummary.total_refunded).toLocaleString('ru-RU')}` : '--'}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                            <span>Баланс</span>
                            <span>{financeSummary?.balance != null ? `EUR ${Number(financeSummary.balance).toLocaleString('ru-RU')}` : '--'}</span>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        {transactions.map((txn) => (
                            <div key={txn.id} className="flex items-center justify-between rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] px-3 py-2 text-sm">
                                <div>
                                    <div className="font-medium text-[#18181b]">{txn.type || 'payment'}</div>
                                    <div className="text-xs text-slate-500">{txn.transaction_date ? new Date(txn.transaction_date).toLocaleDateString('ru-RU') : ''}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-sm">EUR {Number(txn.amount || 0).toLocaleString('ru-RU')}</div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const res = await crmManagerApi.deleteTransaction(txn.id)
                                            if (res?.success) {
                                                await loadTransactions()
                                                toast.success('Транзакция удалена')
                                            } else {
                                                toast.error('Не удалось удалить транзакцию')
                                            }
                                        }}
                                        className="text-xs text-slate-500 underline"
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        ))}
                        {transactions.length === 0 && (
                            <div className="text-sm text-slate-500">Транзакций пока нет</div>
                        )}
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={transactionForm.amount}
                                onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                                placeholder="Сумма (EUR)"
                                className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                            />
                            <select
                                value={transactionForm.type}
                                onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value })}
                                className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                            >
                                <option value="payment">Оплата</option>
                                <option value="refund">Возврат</option>
                            </select>
                        </div>
                        <input
                            value={transactionForm.method}
                            onChange={(e) => setTransactionForm({ ...transactionForm, method: e.target.value })}
                            placeholder="Способ оплаты"
                            className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                        />
                        <input
                            value={transactionForm.description}
                            onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                            placeholder="Описание"
                            className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                        />
                        <button
                            type="button"
                            onClick={async () => {
                                if (!transactionForm.amount || !canonicalOrderId) return
                                const res = await crmManagerApi.addTransaction(canonicalOrderId, {
                                    amount: Number(transactionForm.amount),
                                    type: transactionForm.type,
                                    method: transactionForm.method,
                                    description: transactionForm.description || undefined
                                })
                                if (res?.success) {
                                    setTransactionForm({ amount: '', type: 'payment', method: 'bank_transfer', description: '' })
                                    await loadTransactions()
                                    toast.success('Транзакция добавлена')
                                } else {
                                    toast.error('Не удалось добавить транзакцию')
                                }
                            }}
                            className="h-12 w-full rounded-lg bg-[#18181b] text-white text-sm"
                        >
                            Добавить транзакцию
                        </button>
                    </div>
                </div>

                <div className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
                    <div className="text-sm uppercase tracking-wide text-slate-400">Логистика</div>
                    <div className="mt-3 space-y-2">
                        {shipments.map((s) => (
                            <div key={s.id} className="rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] p-3 space-y-2">
                                <div className="text-sm font-medium text-[#18181b]">{s.provider || s.carrier || 'Провайдер'}</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <input
                                        value={s.tracking_number || ''}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setShipments((prev) => prev.map((x) => (x.id === s.id ? { ...x, tracking_number: val } : x)))
                                        }}
                                        placeholder="Трек-номер"
                                        className="h-10 rounded-lg border border-[#e4e4e7] bg-white px-3 text-xs"
                                    />
                                    <input
                                        type="date"
                                        value={(s.estimated_delivery_date || '').slice(0, 10)}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setShipments((prev) => prev.map((x) => (x.id === s.id ? { ...x, estimated_delivery_date: val } : x)))
                                        }}
                                        className="h-10 rounded-lg border border-[#e4e4e7] bg-white px-3 text-xs"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const res = await crmManagerApi.updateShipment(s.id, {
                                            tracking_number: s.tracking_number,
                                            carrier: s.provider || s.carrier,
                                            status: undefined
                                        })
                                        if (res?.success) {
                                            await loadShipments()
                                            toast.success('Отправка сохранена')
                                        } else {
                                            toast.error('Не удалось сохранить отправку')
                                        }
                                    }}
                                    className="h-10 rounded-lg bg-[#18181b] text-white text-xs px-4"
                                >
                                    Сохранить
                                </button>
                            </div>
                        ))}
                        {shipments.length === 0 && (
                            <div className="text-sm text-slate-500">Данных по логистике пока нет</div>
                        )}
                    </div>
                    <div className="mt-4 space-y-2">
                        <input
                            value={shipmentForm.provider}
                            onChange={(e) => setShipmentForm({ ...shipmentForm, provider: e.target.value })}
                            data-testid="order-shipment-provider"
                            placeholder="Провайдер (Rusbid)"
                            className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                        />
                        <input
                            value={shipmentForm.tracking_number}
                            onChange={(e) => setShipmentForm({ ...shipmentForm, tracking_number: e.target.value })}
                            data-testid="order-shipment-tracking"
                            placeholder="Трек-номер"
                            className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                        />
                        <input
                            type="date"
                            value={shipmentForm.estimated_delivery_date}
                            onChange={(e) => setShipmentForm({ ...shipmentForm, estimated_delivery_date: e.target.value })}
                            data-testid="order-shipment-date"
                            className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                        />
                        <button
                            type="button"
                            onClick={async () => {
                                if (!canonicalOrderId) return
                                const res = await crmManagerApi.createShipment(canonicalOrderId, {
                                    provider: normalizeShipmentProvider(shipmentForm.provider),
                                    tracking_number: shipmentForm.tracking_number || undefined,
                                    estimated_delivery_date: shipmentForm.estimated_delivery_date || undefined
                                })
                                if (res?.success) {
                                    setShipmentForm({ provider: '', tracking_number: '', estimated_delivery_date: '' })
                                    await loadShipments()
                                    toast.success('Отправка добавлена')
                                } else {
                                    toast.error('Не удалось добавить отправку')
                                }
                            }}
                            data-testid="order-shipment-add"
                            className="h-12 w-full rounded-lg bg-[#18181b] text-white text-sm"
                        >
                            Добавить отправку
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!canonicalOrderId) return
                                    const res = await crmManagerApi.notifyTracking(canonicalOrderId, 'whatsapp')
                                    if (res?.success) toast.success('Уведомление WhatsApp поставлено в очередь')
                                    else toast.error('Не удалось поставить уведомление WhatsApp в очередь')
                                }}
                                className="h-10 w-full rounded-lg border border-[#18181b] text-xs text-[#18181b]"
                            >
                                Уведомить в WhatsApp
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!canonicalOrderId) return
                                    const res = await crmManagerApi.notifyTracking(canonicalOrderId, 'telegram')
                                    if (res?.success) toast.success('Уведомление Telegram поставлено в очередь')
                                    else toast.error('Не удалось поставить уведомление Telegram в очередь')
                                }}
                                className="h-10 w-full rounded-lg border border-[#18181b] text-xs text-[#18181b]"
                            >
                                Уведомить в Telegram
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


