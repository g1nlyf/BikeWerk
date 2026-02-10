import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { crmManagerApi } from '@/api/crmManagerApi'
import OrderStatusBadge from '@/components/crm/OrderStatusBadge'
import KanbanBoard from '@/components/crm/KanbanBoard'
import { useToast } from '@/components/crm/ToastProvider'

type ViewMode = 'table' | 'kanban'

type Manager = {
  id: string
  name?: string
  email?: string
}

type CustomerSummary = {
  full_name?: string
  phone?: string
  email?: string
  contact_value?: string
  preferred_channel?: string
}

type OrderSummary = {
  order_id: string
  order_number?: string
  status?: string
  total_amount_rub?: number
  total_amount_eur?: number
  bike_name?: string
  bike_snapshot?: { main_image?: string; image_url?: string; image?: string; photos?: string[] | string; images?: string[] } | string
  items?: Array<{ image_url?: string; main_image?: string; image?: string }>
  assigned_manager?: string
  assigned_manager_name?: string
  created_at?: string
  customer?: CustomerSummary
}

type Filters = {
  status: string
  manager: string
  q: string
  date_from: string
  date_to: string
  min_amount: string
  max_amount: string
}

const STATUS_OPTIONS = [
  { value: 'pending_manager', label: 'Ждет менеджера' },
  { value: 'under_inspection', label: 'Инспекция' },
  { value: 'deposit_paid', label: 'Резерв оплачен' },
  { value: 'awaiting_payment', label: 'Ожидает оплату' },
  { value: 'awaiting_deposit', label: 'Ожидает резерв' },
  { value: 'ready_for_shipment', label: 'Готов к отправке' },
  { value: 'in_transit', label: 'В пути' },
  { value: 'delivered', label: 'Доставлен' },
  { value: 'closed', label: 'Закрыт' },
  { value: 'cancelled', label: 'Отменен' },
  { value: 'refunded', label: 'Возврат' }
]

const STORAGE_KEY = 'crm_orders_filters_v2'
const MAX_BULK = 50

function buildFiltersFromParams(params: URLSearchParams): Filters {
  return {
    status: params.get('status') || '',
    manager: params.get('manager') || '',
    q: params.get('q') || '',
    date_from: params.get('date_from') || '',
    date_to: params.get('date_to') || '',
    min_amount: params.get('min_amount') || '',
    max_amount: params.get('max_amount') || ''
  }
}

function formatCurrency(order: OrderSummary) {
  if (order.total_amount_rub != null) {
    return `${Number(order.total_amount_rub).toLocaleString('ru-RU')} ₽`
  }
  if (order.total_amount_eur != null) {
    return `€ ${Number(order.total_amount_eur).toLocaleString('ru-RU')}`
  }
  return '--'
}

export default function OrdersListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()

  const [orders, setOrders] = React.useState<OrderSummary[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [managers, setManagers] = React.useState<Manager[]>([])

  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [bulkManager, setBulkManager] = React.useState('')
  const [bulkStatus, setBulkStatus] = React.useState('')
  const [exportFormat, setExportFormat] = React.useState<'csv' | 'excel'>('csv')
  const [taskModal, setTaskModal] = React.useState<{ open: boolean; order: OrderSummary | null }>({ open: false, order: null })
  const [taskTitle, setTaskTitle] = React.useState('')
  const [taskDue, setTaskDue] = React.useState('')
  const [taskAssignee, setTaskAssignee] = React.useState('')

  const searchRef = React.useRef<HTMLInputElement | null>(null)
  const restoredRef = React.useRef(false)
  const requestIdRef = React.useRef(0)

  const filters = React.useMemo(() => buildFiltersFromParams(searchParams), [searchParams])
  const viewMode = (searchParams.get('view') as ViewMode) || 'table'
  const sortBy = searchParams.get('sort_by') || 'created_at'
  const sortDir = searchParams.get('sort_dir') === 'asc' ? 'asc' : 'desc'
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)
  const limit = viewMode === 'table' ? 20 : 200

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

  React.useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (searchParams.toString()) return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setSearchParams(saved)
      }
    } catch (error) {
      console.warn('Failed to restore CRM order filters', error)
    }
  }, [searchParams, setSearchParams])

  React.useEffect(() => {
    try {
      const value = searchParams.toString()
      if (value) localStorage.setItem(STORAGE_KEY, value)
    } catch (error) {
      console.warn('Failed to save CRM order filters', error)
    }
  }, [searchParams])

  React.useEffect(() => {
    if (viewMode === 'kanban' && selected.size) {
      setSelected(new Set())
    }
  }, [viewMode, selected.size])

  const updateParams = React.useCallback((patch: Record<string, string | null>, resetPage = false) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
    })

    if (resetPage) next.delete('page')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const showEmpty = !loading && orders.length === 0

  const load = React.useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)

    try {
      const ordersRes = await crmManagerApi.getOrders({
        ...filters,
        limit,
        offset: page * limit,
        sort_by: sortBy,
        sort_dir: sortDir
      })

      if (requestId !== requestIdRef.current) return

      if (ordersRes?.success) {
        setOrders(ordersRes.orders || [])
        const nextTotal = Number(ordersRes.total)
        setTotal(Number.isFinite(nextTotal) ? nextTotal : (ordersRes.orders || []).length)
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      console.error('Orders load error', error)
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [filters, page, limit, sortBy, sortDir])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    let mounted = true

    crmManagerApi.getManagers()
      .then((res) => {
        if (!mounted) return
        if (res?.success) setManagers(res.managers || [])
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [])

  React.useEffect(() => {
    if (currentManagerId && !taskAssignee) {
      setTaskAssignee(currentManagerId)
    }
  }, [currentManagerId, taskAssignee])

  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.order_id))
  const someSelected = orders.some((o) => selected.has(o.order_id))
  const selectAllRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected
    }
  }, [someSelected, allSelected])

  const toggleSelectAll = React.useCallback((checked: boolean) => {
    if (checked) {
      setSelected((prev) => {
        const next = new Set(prev)
        const available = MAX_BULK - next.size
        const toAdd = orders.map((o) => o.order_id).filter((id) => !next.has(id))
        const limited = toAdd.slice(0, Math.max(0, available))

        limited.forEach((id) => next.add(id))

        if (toAdd.length > limited.length) {
          toast.warning(`Можно выбрать не больше ${MAX_BULK} заказов`)
        }

        return next
      })
    } else {
      setSelected(new Set())
    }
  }, [orders, toast])

  const toggleSelect = React.useCallback((orderId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        if (next.size >= MAX_BULK) {
          toast.warning(`Можно выбрать не больше ${MAX_BULK} заказов`)
          return next
        }
        next.add(orderId)
      }
      return next
    })
  }, [toast])

  const handleBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return

    const ids = Array.from(selected)
    const ok = window.confirm(`Изменить статус для ${ids.length} заказов?`)
    if (!ok) return

    const res = await crmManagerApi.bulkUpdateStatus(ids, bulkStatus)
    if (res?.success) {
      setOrders((prev) => prev.map((o) => (ids.includes(o.order_id) ? { ...o, status: bulkStatus } : o)))
      setSelected(new Set())
      setBulkStatus('')
      toast.success('Статус обновлен')
    } else {
      toast.error('Не удалось обновить статус')
    }
  }

  const handleBulkAssign = async (managerOverride?: string) => {
    const managerId = managerOverride || bulkManager
    if (!managerId || selected.size === 0) return

    const ids = Array.from(selected)
    const ok = window.confirm(`Назначить менеджера для ${ids.length} заказов?`)
    if (!ok) return

    const res = await crmManagerApi.bulkAssignManager(ids, managerId)
    if (res?.success) {
      setOrders((prev) => prev.map((o) => (ids.includes(o.order_id) ? { ...o, assigned_manager: managerId } : o)))
      setSelected(new Set())
      setBulkManager('')
      toast.success('Менеджер назначен')
    } else {
      toast.error('Не удалось назначить менеджера')
    }
  }

  const handleExport = async () => {
    try {
      toast.info('Формирую выгрузку...')
      const res = await crmManagerApi.exportOrders({
        ...filters,
        sort_by: sortBy,
        sort_dir: sortDir,
        format: exportFormat
      })
      if (!res.ok) {
        toast.error('Не удалось выгрузить заказы')
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `crm-orders-${stamp}.${exportFormat === 'excel' ? 'xls' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Выгрузка готова')
    } catch (error) {
      console.error('Export error', error)
      toast.error('Не удалось выгрузить заказы')
    }
  }

  const openTaskModal = (order: OrderSummary) => {
    setTaskModal({ open: true, order })
    setTaskTitle('')
    setTaskDue('')
    setTaskAssignee(currentManagerId || '')
  }

  const createTaskFromModal = async () => {
    if (!taskModal.order || !taskTitle.trim()) return

    const res = await crmManagerApi.createTask({
      title: taskTitle.trim(),
      order_id: taskModal.order.order_id,
      assigned_to: taskAssignee || null,
      due_at: taskDue || null
    })

    if (res?.success) {
      toast.success('Задача создана')
      setTaskModal({ open: false, order: null })
      setTaskTitle('')
      setTaskDue('')
    } else {
      toast.error('Не удалось создать задачу')
    }
  }

  const toggleSort = (column: string) => {
    let nextDir = 'desc'
    if (sortBy === column) {
      nextDir = sortDir === 'asc' ? 'desc' : 'asc'
    }
    updateParams({ sort_by: column, sort_dir: nextDir }, true)
  }

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        setSelected(new Set())
        if (taskModal.open) {
          setTaskModal({ open: false, order: null })
        }
        return
      }

      if (isTyping) return

      if (e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        searchRef.current?.focus()
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        toggleSelectAll(true)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSelectAll, taskModal.open])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <input
            ref={searchRef}
            value={filters.q}
            onChange={(e) => updateParams({ q: e.target.value }, true)}
            placeholder="Поиск по заказу, клиенту или байку"
            className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
          />
          <select
            value={filters.status}
            onChange={(e) => updateParams({ status: e.target.value }, true)}
            className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
          >
            <option value="">Все статусы</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={filters.manager}
            onChange={(e) => updateParams({ manager: e.target.value }, true)}
            className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
          >
            <option value="">Все менеджеры</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email}</option>
            ))}
          </select>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => updateParams({ date_from: e.target.value }, true)}
            className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => updateParams({ date_to: e.target.value }, true)}
            className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={filters.min_amount}
              onChange={(e) => updateParams({ min_amount: e.target.value }, true)}
              placeholder="Мин. ₽"
              className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
            />
            <input
              type="number"
              value={filters.max_amount}
              onChange={(e) => updateParams({ max_amount: e.target.value }, true)}
              placeholder="Макс. ₽"
              className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">Всего заказов: {total}</div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel')}
                className="h-10 rounded-lg border border-[#e4e4e7] bg-white px-2 text-xs"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
              </select>
              <button
                type="button"
                onClick={handleExport}
                className="h-10 rounded-lg bg-[#18181b] px-4 text-xs text-white"
              >
                Экспорт
              </button>
            </div>

            <div className="flex rounded-lg border border-[#e4e4e7] overflow-hidden">
              <button
                type="button"
                onClick={() => updateParams({ view: 'table' }, false)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-[#18181b] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Таблица
              </button>
              <button
                type="button"
                onClick={() => updateParams({ view: 'kanban' }, false)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-[#18181b] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Канбан
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelected(new Set())
                updateParams({
                  status: null,
                  manager: null,
                  q: null,
                  date_from: null,
                  date_to: null,
                  min_amount: null,
                  max_amount: null,
                  page: null
                }, true)
              }}
              className="text-xs text-slate-500 underline"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>

      {selected.size > 0 && viewMode === 'table' && (
        <div className="fixed bottom-6 left-1/2 z-40 w-[min(960px,calc(100vw-2rem))] -translate-x-1/2">
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[#18181b]">Выбрано: {selected.size}</div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkManager}
                onChange={(e) => setBulkManager(e.target.value)}
                className="h-10 rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] px-2 text-xs"
              >
                <option value="">Назначить менеджера</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkAssign}
                className="h-10 rounded-lg bg-[#18181b] px-4 text-xs text-white"
              >
                Назначить
              </button>
              {currentManagerId && (
                <button
                  type="button"
                  onClick={() => handleBulkAssign(currentManagerId)}
                  className="h-10 rounded-lg border border-[#18181b] px-4 text-xs text-[#18181b]"
                >
                  Назначить мне
                </button>
              )}
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="h-10 rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] px-2 text-xs"
              >
                <option value="">Изменить статус</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkStatus}
                className="h-10 rounded-lg bg-[#18181b] px-4 text-xs text-white"
              >
                Обновить
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="h-10 rounded-lg border border-[#e4e4e7] px-4 text-xs text-slate-600"
              >
                Очистить
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'kanban' && (
        <KanbanBoard
          orders={orders}
          onOrderClick={(orderId) => navigate(`/crm/orders/${orderId}`)}
          onStatusChange={async (orderId, status) => {
            const res = await crmManagerApi.updateOrderStatus(orderId, status)
            if (res?.success) {
              setOrders((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, status } : o)))
            }
          }}
        />
      )}

      {viewMode === 'table' && showEmpty && (
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-10 text-center shadow-sm">
          <div className="text-lg font-semibold text-[#18181b]">Заказы не найдены</div>
          <div className="mt-2 text-sm text-slate-500">Попробуйте изменить фильтры или сбросить условия поиска.</div>
          <button
            type="button"
            onClick={() => updateParams({ status: null, manager: null, q: null, date_from: null, date_to: null, min_amount: null, max_amount: null, page: null }, true)}
            className="mt-4 h-10 rounded-lg border border-[#18181b] px-4 text-xs text-[#18181b]"
          >
            Сбросить фильтры
          </button>
        </div>
      )}

      {viewMode === 'table' && !showEmpty && (
        <div className="rounded-xl border border-[#e4e4e7] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f4f4f5] text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="h-4 w-4 rounded border-[#e4e4e7]"
                    />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('order_code')}>
                    Заказ {sortBy === 'order_code' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                  </th>
                  <th className="px-4 py-3 text-left">Клиент</th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('created_at')}>
                    Создан {sortBy === 'created_at' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                  </th>
                  <th className="px-4 py-3 text-left">Статус</th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('final_price_eur')}>
                    Сумма {sortBy === 'final_price_eur' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                  </th>
                  <th className="px-4 py-3 text-left">Менеджер</th>
                  <th className="px-4 py-3 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`loading-${idx}`} className="border-t border-[#e4e4e7]">
                    <td className="px-4 py-4" colSpan={8}>
                      <div className="h-8 w-full rounded-lg bg-[#f4f4f5]" />
                    </td>
                  </tr>
                ))}
                {!loading && orders.map((order) => {
                  const contact = order.customer?.phone || order.customer?.email || order.customer?.contact_value || ''

                  return (
                    <tr
                      key={order.order_id}
                      className={`border-t border-[#e4e4e7] cursor-pointer hover:bg-[#fafafa] h-16 ${selected.has(order.order_id) ? 'bg-[#f4f4f5]' : ''}`}
                      onClick={() => navigate(`/crm/orders/${order.order_number || order.order_id}`)}
                    >
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(order.order_id)}
                          onChange={() => toggleSelect(order.order_id)}
                          className="h-4 w-4 rounded border-[#e4e4e7]"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-base font-semibold text-[#18181b]">{order.order_number}</div>
                        <div className="text-sm text-slate-500">{order.bike_name || '--'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-[#18181b]">{order.customer?.full_name || '--'}</div>
                        <div className="text-xs text-slate-500">
                          {order.customer?.phone ? (
                            <a
                              href={`tel:${order.customer.phone.replace(/\s/g, '')}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-[#18181b]"
                            >
                              {order.customer.phone}
                            </a>
                          ) : (contact || '--')}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString('ru-RU') : '--'}
                      </td>
                      <td className="px-4 py-4">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-4">
                        {formatCurrency(order)}
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={order.assigned_manager || ''}
                          onChange={(e) => {
                            e.stopPropagation()
                            crmManagerApi.updateOrderManager(order.order_id, e.target.value).then((res) => {
                              if (res?.success) {
                                setOrders((prev) => prev.map((o) => (o.order_id === order.order_id ? { ...o, assigned_manager: e.target.value } : o)))
                              }
                            })
                          }}
                          className="h-10 rounded-lg border border-[#e4e4e7] bg-white px-2 text-xs"
                        >
                          <option value="">Не назначен</option>
                          {managers.map((m) => (
                            <option key={m.id} value={m.id}>{m.name || m.email}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <select
                            value={order.status}
                            onChange={(e) => {
                              e.stopPropagation()
                              crmManagerApi.updateOrderStatus(order.order_id, e.target.value).then((res) => {
                                if (res?.success) {
                                  setOrders((prev) => prev.map((o) => (o.order_id === order.order_id ? { ...o, status: e.target.value } : o)))
                                }
                              })
                            }}
                            className="h-10 rounded-lg border border-[#e4e4e7] bg-white px-2 text-xs"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => openTaskModal(order)}
                            className="h-10 rounded-lg border border-[#e4e4e7] px-3 text-xs text-slate-600"
                          >
                            Задача
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/crm/orders/${order.order_number || order.order_id}`)}
                            className="h-10 rounded-lg border border-[#18181b] px-3 text-xs text-[#18181b]"
                          >
                            Открыть
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#e4e4e7] text-xs text-slate-500">
            <div>Страница {page + 1} из {totalPages}</div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => updateParams({ page: String(Math.max(0, page - 1)) }, false)}
                className="rounded-lg border border-[#e4e4e7] px-3 py-1 disabled:opacity-50"
              >
                Назад
              </button>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => updateParams({ page: String(Math.min(totalPages - 1, page + 1)) }, false)}
                className="rounded-lg border border-[#e4e4e7] px-3 py-1 disabled:opacity-50"
              >
                Вперед
              </button>
            </div>
          </div>
        </div>
      )}

      {taskModal.open && taskModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Быстрая задача</div>
                <div className="text-lg font-semibold text-[#18181b]">Создать задачу</div>
              </div>
              <button
                type="button"
                onClick={() => setTaskModal({ open: false, order: null })}
                className="h-9 w-9 rounded-full border border-[#e4e4e7] text-slate-500 hover:text-[#18181b]"
              >
                ×
              </button>
            </div>
            <div className="mt-3 text-sm text-slate-500">
              Заказ: {taskModal.order.order_number || taskModal.order.order_id} {taskModal.order.bike_name ? `- ${taskModal.order.bike_name}` : ''}
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Что нужно сделать"
                className="h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <select
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                >
                  <option value="">Назначить менеджера</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {['Позвонить клиенту', 'Запросить фото', 'Отправить счет'].map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => setTaskTitle(template)}
                    className="h-9 rounded-lg border border-[#e4e4e7] px-3 text-xs text-slate-600 hover:border-[#18181b] hover:text-[#18181b]"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTaskModal({ open: false, order: null })}
                className="h-10 rounded-lg border border-[#e4e4e7] px-4 text-xs text-slate-600"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={createTaskFromModal}
                className="h-10 rounded-lg bg-[#18181b] px-4 text-xs text-white"
              >
                Создать задачу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
