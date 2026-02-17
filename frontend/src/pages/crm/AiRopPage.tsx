import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
  PlayCircle,
  RefreshCw,
  Search,
  XCircle
} from 'lucide-react'
import { crmManagerApi } from '@/api/crmManagerApi'
import OrderStatusBadge from '@/components/crm/OrderStatusBadge'
import { useToast } from '@/components/crm/ToastProvider'
import type { CrmScope } from '@/lib/crmScope'
import { getCurrentCrmUser, isCrmAdmin, resolveCrmScope, setGlobalCrmScope, subscribeCrmScopeChange } from '@/lib/crmScope'

type WorkspaceOrder = {
  order_id: string
  order_number?: string | null
  status?: string | null
  bike_name?: string | null
  total_amount_eur?: number | null
  total_amount_rub?: number | null
  created_at?: string | null
  updated_at?: string | null
  customer?: {
    full_name?: string | null
    email?: string | null
    phone?: string | null
    contact_value?: string | null
    preferred_channel?: string | null
  } | null
}

type WorkspaceTask = {
  id: string
  order_id?: string | null
  title: string
  description?: string | null
  due_at?: string | null
  created_at?: string | null
}

type WorkspaceFollowup = {
  id: string
  order_id?: string | null
  title?: string | null
  followup_type?: string | null
  status?: string | null
  due_at?: string | null
  created_at?: string | null
}

type WorkspaceSignal = {
  id: string
  title?: string | null
  insight?: string | null
  signal_type?: string | null
  severity?: string | null
  status?: string | null
  assigned_to?: string | null
  entity_type?: string | null
  entity_id?: string | null
  created_at?: string | null
  target?: string | null
  priority_score?: number | null
}

type AiRopWorkspace = {
  success?: boolean
  manager_scope?: string | null
  manager?: { id?: string | null; name?: string | null; email?: string | null; role?: string | null } | null
  autopilot_status?: {
    running?: boolean
    in_progress?: boolean
    last_run_at?: string | null
    last_summary?: Record<string, unknown> | null
  } | null
  summary?: {
    assigned_orders?: number
    pending_tasks?: number
    open_followups?: number
    open_signals?: number
  } | null
  assigned_orders?: WorkspaceOrder[]
  pending_tasks?: WorkspaceTask[]
  open_followups?: WorkspaceFollowup[]
  ai_signals?: WorkspaceSignal[]
}

type TabKey = 'focus' | 'orders' | 'tasks' | 'followups' | 'signals'
type SignalDecision = 'approve' | 'resolve' | 'snooze' | 'reject'
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low' | 'info'
type StatusFilter = 'all' | 'open' | 'in_progress' | 'snoozed' | 'resolved' | 'rejected'

const SIGNAL_SEVERITY_ORDER: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  reserve_payment_pending: 'ожидание предоплаты',
  reserve_paid: 'предоплата получена',
  seller_check_in_progress: 'проверка продавца',
  check_ready: 'отчёт готов',
  awaiting_client_decision: 'ожидание решения клиента',
  full_payment_pending: 'ожидание полной оплаты',
  full_payment_received: 'полная оплата получена',
  bike_buyout_completed: 'выкуп завершён',
  seller_shipped: 'продавец отправил велосипед',
  warehouse_received: 'велосипед на складе',
  delivered: 'доставлен'
}

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  sla_breach: 'Нарушение SLA',
  compliance_block: 'Блок по комплаенсу',
  generic: 'Системный сигнал'
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function titleCaseWords(value: string): string {
  return value
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

function translateStatusCode(status?: string | null): string {
  const code = normalizeText(status)
  if (!code) return 'статус не указан'
  if (ORDER_STATUS_LABELS[code]) return ORDER_STATUS_LABELS[code]
  return code.replace(/_/g, ' ')
}

function translateSignalType(value?: string | null): string {
  const code = normalizeText(value)
  if (!code) return 'Системный сигнал'
  return SIGNAL_TYPE_LABELS[code] || titleCaseWords(code.replace(/_/g, ' '))
}

function prettifySignalTitle(signal: WorkspaceSignal): string {
  const rawTitle = String(signal.title || '').trim()
  if (!rawTitle) return translateSignalType(signal.signal_type)

  const slaTitleMatch = rawTitle.match(/^sla breach:\s*([a-z0-9_]+)$/i)
  if (slaTitleMatch) {
    return `Нарушение SLA: ${translateStatusCode(slaTitleMatch[1])}`
  }

  const cleaned = rawTitle
    .replace(/^sla breach/i, 'Нарушение SLA')
    .replace(/^compliance block/i, 'Блок по комплаенсу')
    .replace(/_/g, ' ')
    .trim()

  return cleaned || translateSignalType(signal.signal_type)
}

function prettifySignalInsight(signal: WorkspaceSignal): string {
  const raw = String(signal.insight || '').trim()
  if (!raw) return 'Описание сигнала отсутствует.'

  const slaInsightMatch = raw.match(
    /^Order\s+([A-Z0-9-]+)\s+exceeded\s+SLA\s+\(([\d.]+)h\s*>\s*([\d.]+)h\)\.?$/i
  )
  if (slaInsightMatch) {
    const orderCode = slaInsightMatch[1]
    const actualHours = Number(slaInsightMatch[2])
    const plannedHours = Number(slaInsightMatch[3])
    return `Заказ ${orderCode} превысил SLA: ${actualHours.toLocaleString('ru-RU')} ч при норме ${plannedHours.toLocaleString('ru-RU')} ч.`
  }

  return raw
}

function metricValue(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? ts : 0
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('ru-RU')
}

function formatDateShort(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('ru-RU')
}

function formatMoneyEur(value?: number | null) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `€ ${num.toLocaleString('ru-RU')}`
}

function isOverdue(value?: string | null): boolean {
  if (!value) return false
  const due = new Date(value)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() < Date.now()
}

function severityLabel(value?: string | null) {
  switch (normalizeText(value)) {
    case 'critical':
      return 'Критично'
    case 'high':
      return 'Высокий'
    case 'medium':
      return 'Средний'
    case 'low':
      return 'Низкий'
    case 'info':
      return 'Инфо'
    default:
      return 'Средний'
  }
}

function signalStatusLabel(value?: string | null) {
  switch (normalizeText(value)) {
    case 'open':
      return 'Открыт'
    case 'in_progress':
      return 'В работе'
    case 'snoozed':
      return 'Отложен'
    case 'resolved':
      return 'Закрыт'
    case 'rejected':
      return 'Отклонён'
    default:
      return 'Открыт'
  }
}

function followupStatusLabel(value?: string | null) {
  switch (normalizeText(value)) {
    case 'open':
      return 'Открыт'
    case 'pending':
      return 'Ожидает'
    case 'in_progress':
      return 'В работе'
    case 'done':
    case 'completed':
      return 'Завершён'
    default:
      return value || '—'
  }
}

function severityBadgeClass(value?: string | null) {
  switch (normalizeText(value)) {
    case 'critical':
      return 'bg-rose-100 text-rose-700 border border-rose-200'
    case 'high':
      return 'bg-orange-100 text-orange-700 border border-orange-200'
    case 'low':
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    case 'info':
      return 'bg-sky-100 text-sky-700 border border-sky-200'
    default:
      return 'bg-amber-100 text-amber-700 border border-amber-200'
  }
}

function statusBadgeClass(value?: string | null) {
  switch (normalizeText(value)) {
    case 'in_progress':
      return 'bg-indigo-100 text-indigo-700 border border-indigo-200'
    case 'snoozed':
      return 'bg-slate-100 text-slate-700 border border-slate-200'
    case 'resolved':
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    case 'rejected':
      return 'bg-rose-100 text-rose-700 border border-rose-200'
    default:
      return 'bg-blue-100 text-blue-700 border border-blue-200'
  }
}

function signalCardClass(value?: string | null) {
  switch (normalizeText(value)) {
    case 'critical':
      return 'border-rose-300 bg-gradient-to-br from-rose-50 via-white to-rose-100 shadow-rose-100'
    case 'high':
      return 'border-orange-300 bg-gradient-to-br from-orange-50 via-white to-orange-100 shadow-orange-100'
    case 'low':
      return 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 shadow-emerald-100'
    case 'info':
      return 'border-sky-300 bg-gradient-to-br from-sky-50 via-white to-sky-100 shadow-sky-100'
    default:
      return 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-100 shadow-amber-100'
  }
}

function signalAccentClass(value?: string | null) {
  switch (normalizeText(value)) {
    case 'critical':
      return 'bg-rose-600'
    case 'high':
      return 'bg-orange-500'
    case 'low':
      return 'bg-emerald-500'
    case 'info':
      return 'bg-sky-500'
    default:
      return 'bg-amber-500'
  }
}

function signalIsUrgent(signal: WorkspaceSignal) {
  const severity = normalizeText(signal.severity)
  const status = normalizeText(signal.status)
  return (severity === 'critical' || severity === 'high') && (status === 'open' || status === 'in_progress')
}

function summaryEntries(summary?: Record<string, unknown> | null) {
  if (!summary || typeof summary !== 'object') return [] as Array<{ key: string; value: string }>
  return Object.entries(summary)
    .slice(0, 8)
    .map(([key, value]) => {
      if (value == null) return { key, value: '—' }
      if (typeof value === 'number') return { key, value: value.toLocaleString('ru-RU') }
      if (typeof value === 'string') return { key, value }
      if (typeof value === 'boolean') return { key, value: value ? 'Да' : 'Нет' }
      return { key, value: JSON.stringify(value) }
    })
}

function includesQuery(value: string, query: string) {
  if (!query) return true
  return normalizeText(value).includes(query)
}

export default function AiRopPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const currentUser = React.useMemo(() => getCurrentCrmUser(), [])
  const isAdmin = isCrmAdmin(currentUser)
  const [scope, setScope] = React.useState<CrmScope>(() => resolveCrmScope(currentUser))

  const [isInitialLoading, setIsInitialLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [isRunningCycle, setIsRunningCycle] = React.useState(false)
  const [autoRefresh, setAutoRefresh] = React.useState(false)
  const [lastLoadedAt, setLastLoadedAt] = React.useState<string | null>(null)
  const [actionLoadingBySignal, setActionLoadingBySignal] = React.useState<Record<string, boolean>>({})
  const [workspace, setWorkspace] = React.useState<AiRopWorkspace | null>(null)

  const [activeTab, setActiveTab] = React.useState<TabKey>('focus')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [severityFilter, setSeverityFilter] = React.useState<SeverityFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')

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

  const loadWorkspace = React.useCallback(
    async ({ initial = false, silent = false }: { initial?: boolean; silent?: boolean } = {}) => {
      if (initial) {
        setIsInitialLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const res = await crmManagerApi.getAiRopWorkspace({ scope })
        if (res?.success) {
          setWorkspace(res as AiRopWorkspace)
          setLastLoadedAt(new Date().toISOString())
        } else if (!silent) {
          toast.error('Не удалось загрузить рабочее пространство AI-РОПа')
        }
      } catch (error) {
        console.error('AI-ROP workspace load error', error)
        if (!silent) {
          toast.error('Не удалось загрузить рабочее пространство AI-РОПа')
        }
      } finally {
        setIsInitialLoading(false)
        setIsRefreshing(false)
      }
    },
    [scope, toast]
  )

  React.useEffect(() => {
    void loadWorkspace({ initial: true })
  }, [loadWorkspace])

  React.useEffect(() => {
    if (!autoRefresh) return

    const timer = window.setInterval(() => {
      void loadWorkspace({ silent: true })
    }, 60_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [autoRefresh, loadWorkspace])

  const runCycle = async () => {
    setIsRunningCycle(true)
    try {
      const res = await crmManagerApi.runAiRopCycle(false)
      if (res?.success) {
        toast.success('Цикл AI-РОПа выполнен')
      } else {
        toast.error('Не удалось выполнить цикл AI-РОПа')
      }
      await loadWorkspace({ silent: true })
    } catch (error) {
      console.error('AI-ROP run error', error)
      toast.error('Не удалось выполнить цикл AI-РОПа')
    } finally {
      setIsRunningCycle(false)
    }
  }

  const decideSignal = async (signalId: string, decision: SignalDecision) => {
    const decisionNote: Record<SignalDecision, string> = {
      approve: 'Сигнал принят менеджером из интерфейса AI-РОПа',
      resolve: 'Сигнал закрыт менеджером из интерфейса AI-РОПа',
      snooze: 'Сигнал отложен менеджером из интерфейса AI-РОПа',
      reject: 'Сигнал отклонён менеджером из интерфейса AI-РОПа'
    }

    setActionLoadingBySignal((prev) => ({ ...prev, [signalId]: true }))

    try {
      const payload = decision === 'snooze'
        ? {
            decision,
            note: decisionNote[decision],
            snooze_until: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
          }
        : {
            decision,
            note: decisionNote[decision]
          }

      const res = await crmManagerApi.decideAiRopSignal(signalId, payload)
      if (res?.success) {
        toast.success('Сигнал обновлён')
      } else {
        toast.error('Не удалось обновить сигнал')
      }

      await loadWorkspace({ silent: true })
    } catch (error) {
      console.error('AI-ROP signal decision error', error)
      toast.error('Не удалось обновить сигнал')
    } finally {
      setActionLoadingBySignal((prev) => ({ ...prev, [signalId]: false }))
    }
  }

  const summary = React.useMemo(() => workspace?.summary ?? {}, [workspace?.summary])
  const orders = React.useMemo(() => workspace?.assigned_orders ?? [], [workspace?.assigned_orders])
  const tasks = React.useMemo(() => workspace?.pending_tasks ?? [], [workspace?.pending_tasks])
  const followups = React.useMemo(() => workspace?.open_followups ?? [], [workspace?.open_followups])
  const signals = React.useMemo(() => workspace?.ai_signals ?? [], [workspace?.ai_signals])
  const autopilotStatus = React.useMemo(() => workspace?.autopilot_status ?? {}, [workspace?.autopilot_status])

  const urgentSignals = React.useMemo(() => signals.filter(signalIsUrgent), [signals])
  const overdueTasks = React.useMemo(() => tasks.filter((task) => isOverdue(task.due_at)), [tasks])
  const overdueFollowups = React.useMemo(
    () => followups.filter((item) => isOverdue(item.due_at) && normalizeText(item.status) !== 'completed'),
    [followups]
  )

  const normalizedQuery = normalizeText(searchQuery)

  const filteredOrders = React.useMemo(() => {
    return [...orders]
      .filter((order) => {
        if (!normalizedQuery) return true
        return [
          order.order_number,
          order.order_id,
          order.bike_name,
          order.customer?.full_name,
          order.customer?.email,
          order.customer?.phone,
          order.customer?.contact_value
        ].some((part) => includesQuery(String(part ?? ''), normalizedQuery))
      })
      .sort((a, b) => toTimestamp(b.updated_at || b.created_at) - toTimestamp(a.updated_at || a.created_at))
  }, [orders, normalizedQuery])

  const filteredTasks = React.useMemo(() => {
    return [...tasks]
      .filter((task) => {
        if (!normalizedQuery) return true
        return [task.title, task.description, task.order_id].some((part) => includesQuery(String(part ?? ''), normalizedQuery))
      })
      .sort((a, b) => {
        const aDue = toTimestamp(a.due_at)
        const bDue = toTimestamp(b.due_at)
        if (aDue === 0 && bDue === 0) return toTimestamp(b.created_at) - toTimestamp(a.created_at)
        if (aDue === 0) return 1
        if (bDue === 0) return -1
        return aDue - bDue
      })
  }, [tasks, normalizedQuery])

  const filteredFollowups = React.useMemo(() => {
    return [...followups]
      .filter((item) => {
        if (!normalizedQuery) return true
        return [item.title, item.followup_type, item.order_id, item.status]
          .some((part) => includesQuery(String(part ?? ''), normalizedQuery))
      })
      .sort((a, b) => {
        const aDue = toTimestamp(a.due_at)
        const bDue = toTimestamp(b.due_at)
        if (aDue === 0 && bDue === 0) return toTimestamp(b.created_at) - toTimestamp(a.created_at)
        if (aDue === 0) return 1
        if (bDue === 0) return -1
        return aDue - bDue
      })
  }, [followups, normalizedQuery])

  const filteredSignals = React.useMemo(() => {
    return [...signals]
      .filter((signal) => {
        if (severityFilter !== 'all' && normalizeText(signal.severity) !== severityFilter) return false
        if (statusFilter !== 'all' && normalizeText(signal.status) !== statusFilter) return false
        if (!normalizedQuery) return true

        return [
          signal.title,
          signal.insight,
          signal.signal_type,
          signal.entity_id,
          signal.entity_type
        ].some((part) => includesQuery(String(part ?? ''), normalizedQuery))
      })
      .sort((a, b) => {
        const severityDelta =
          (SIGNAL_SEVERITY_ORDER[normalizeText(b.severity)] || 0) -
          (SIGNAL_SEVERITY_ORDER[normalizeText(a.severity)] || 0)
        if (severityDelta !== 0) return severityDelta
        return toTimestamp(b.created_at) - toTimestamp(a.created_at)
      })
  }, [signals, normalizedQuery, severityFilter, statusFilter])

  const autopilotSummary = React.useMemo(() => summaryEntries(autopilotStatus.last_summary), [autopilotStatus.last_summary])

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'focus', label: 'Фокус', count: urgentSignals.length + overdueTasks.length + overdueFollowups.length },
    { key: 'orders', label: 'Заказы', count: filteredOrders.length },
    { key: 'tasks', label: 'Задачи', count: filteredTasks.length },
    { key: 'followups', label: 'Фоллоу-апы', count: filteredFollowups.length },
    { key: 'signals', label: 'AI-сигналы', count: filteredSignals.length }
  ]

  if (isInitialLoading) {
    return (
      <div className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка AI-РОПа...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 p-6 text-white shadow-[0_18px_40px_rgba(2,6,23,0.35)]">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-20 h-52 w-52 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
              <Bot className="h-4 w-4" />
              AI-РОП
            </div>
            <h1 className="mt-2 text-3xl font-semibold">Центр принятия решений</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Единая панель для срочных сигналов, SLA-рисков и задач менеджера.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-slate-200">
                Менеджер: {scope === 'all' ? '\u0412\u0441\u0435 \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u044b' : (workspace?.manager?.name || workspace?.manager?.email || workspace?.manager_scope || '—')}
              </span>
              {isAdmin ? (
                <div className="inline-flex overflow-hidden rounded-full border border-slate-600 bg-slate-900/90">
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalCrmScope('mine', currentUser)
                      setScope('mine')
                    }}
                    className={`px-3 py-1.5 transition ${scope === 'mine' ? 'bg-cyan-400 text-slate-950' : 'text-slate-200 hover:bg-slate-800'}`}
                  >
                    {'\u0422\u043e\u043b\u044c\u043a\u043e \u043c\u043e\u0438'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalCrmScope('all', currentUser)
                      setScope('all')
                    }}
                    className={`px-3 py-1.5 transition ${scope === 'all' ? 'bg-cyan-400 text-slate-950' : 'text-slate-200 hover:bg-slate-800'}`}
                  >
                    {'\u0412\u0441\u0435 \u0437\u0430\u043a\u0430\u0437\u044b'}
                  </button>
                </div>
              ) : (
                <span className="rounded-full border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-slate-200">
                  {'\u0420\u0435\u0436\u0438\u043c: \u0442\u043e\u043b\u044c\u043a\u043e \u043c\u043e\u0438 \u0437\u0430\u043a\u0430\u0437\u044b'}
                </span>
              )}
              <span className="rounded-full border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-slate-300">
                Синхронизация: {formatDate(lastLoadedAt)}
              </span>
            </div>
          </div>

          <div className="flex min-w-[300px] flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${autopilotStatus.running ? 'bg-emerald-500/25 text-emerald-100' : 'bg-slate-700 text-slate-200'}`}>
                Автопилот: {autopilotStatus.running ? 'включён' : 'выключен'}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${autopilotStatus.in_progress ? 'bg-amber-400/25 text-amber-100' : 'bg-slate-700 text-slate-200'}`}>
                {autopilotStatus.in_progress ? 'Идёт цикл' : 'Ожидание'}
              </span>
            </div>

            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/90 px-3 py-2 text-xs text-slate-100">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 accent-cyan-500"
              />
              Автообновление 60с
            </label>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void loadWorkspace()}
                disabled={isRefreshing || isRunningCycle}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-500 bg-slate-800 px-4 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Обновить
              </button>

              <button
                type="button"
                onClick={runCycle}
                disabled={isRunningCycle || Boolean(autopilotStatus.in_progress)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRunningCycle ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                {isRunningCycle ? 'Запуск...' : 'Запустить цикл'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setActiveTab('signals')
            setSeverityFilter('all')
            setStatusFilter('open')
          }}
          className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-left transition hover:bg-rose-100/80"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-rose-500">Критичный фокус</div>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-rose-700">{urgentSignals.length}</div>
          <div className="mt-1 text-xs text-rose-600">Сигналы, требующие реакции</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className="rounded-xl border border-[#e4e4e7] bg-white p-4 text-left shadow-sm transition hover:border-slate-300"
        >
          <div className="text-xs uppercase text-slate-400">Назначенные заказы</div>
          <div className="mt-2 text-2xl font-semibold text-[#18181b]">{metricValue(summary.assigned_orders)}</div>
          <div className="mt-1 text-xs text-slate-500">В активной работе менеджера</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-left transition hover:bg-amber-100/70"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-amber-600">Просроченные задачи</div>
            <Clock3 className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-amber-700">{overdueTasks.length}</div>
          <div className="mt-1 text-xs text-amber-700">Из {metricValue(summary.pending_tasks)} активных задач</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('followups')}
          className="rounded-xl border border-[#e4e4e7] bg-white p-4 text-left shadow-sm transition hover:border-slate-300"
        >
          <div className="text-xs uppercase text-slate-400">Открытые фоллоу-апы</div>
          <div className="mt-2 text-2xl font-semibold text-[#18181b]">{metricValue(summary.open_followups)}</div>
          <div className="mt-1 text-xs text-slate-500">Просрочено: {overdueFollowups.length}</div>
        </button>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[#18181b]">Приоритетные сигналы</div>
              <div className="text-xs text-slate-500">Сначала показываются сигналы с высоким приоритетом</div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('signals')}
              className="text-xs font-medium text-[#18181b] underline"
            >
              Открыть все сигналы
            </button>
          </div>

          <div className="space-y-2">
            {urgentSignals.slice(0, 4).map((signal) => {
              const busy = Boolean(actionLoadingBySignal[signal.id])
              return (
                <div key={signal.id} className={`rounded-xl border p-4 shadow-sm ${signalCardClass(signal.severity)}`}>
                  <div className={`mb-3 h-1 w-16 rounded-full ${signalAccentClass(signal.severity)}`} />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-semibold text-[#18181b]">{prettifySignalTitle(signal)}</div>
                      <div className="mt-1 text-sm text-slate-700">{prettifySignalInsight(signal)}</div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className={`rounded-full px-2 py-1 ${severityBadgeClass(signal.severity)}`}>{severityLabel(signal.severity)}</span>
                      <span className={`rounded-full px-2 py-1 ${statusBadgeClass(signal.status)}`}>{signalStatusLabel(signal.status)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {signal.entity_type === 'order' && signal.entity_id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/crm/orders/${signal.entity_id}`)}
                        className="h-9 rounded-lg border border-[#d4d4d8] bg-white px-3 text-xs font-medium text-[#18181b]"
                      >
                        Открыть заказ
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decideSignal(signal.id, 'approve')}
                      className="h-9 rounded-lg border border-[#d4d4d8] bg-white px-3 text-xs font-medium text-[#18181b] disabled:opacity-60"
                    >
                      Принять
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decideSignal(signal.id, 'resolve')}
                      className="h-9 rounded-lg bg-[#18181b] px-3 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              )
            })}

            {urgentSignals.length === 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-700">
                Срочных сигналов нет. Можно работать по плановым задачам.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-[#18181b]">Состояние автопилота</div>
          <div className="mt-2 text-xs text-slate-500">Последний запуск: {formatDate(autopilotStatus.last_run_at)}</div>

          <div className="mt-4 space-y-2">
            {autopilotSummary.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-lg border border-[#e4e4e7] bg-[#fafafa] px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{item.key.replace(/_/g, ' ')}</div>
                <div className="text-sm font-semibold text-[#18181b]">{item.value}</div>
              </div>
            ))}

            {autopilotSummary.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#e4e4e7] p-3 text-xs text-slate-500">
                Данные последнего цикла пока отсутствуют.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  activeTab === tab.key
                    ? 'bg-[#18181b] text-white'
                    : 'bg-[#f4f4f5] text-[#18181b] hover:bg-[#e9e9ec]'
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-1 flex-col gap-2 lg:max-w-2xl lg:flex-row lg:items-center lg:justify-end">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по заказам, задачам и сигналам"
                className="h-10 w-full rounded-lg border border-[#e4e4e7] bg-white pl-9 pr-3 text-sm"
              />
            </div>

            {activeTab === 'signals' && (
              <div className="flex items-center gap-2">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                  className="h-10 rounded-lg border border-[#e4e4e7] bg-white px-3 text-xs"
                >
                  <option value="all">Все приоритеты</option>
                  <option value="critical">Критично</option>
                  <option value="high">Высокий</option>
                  <option value="medium">Средний</option>
                  <option value="low">Низкий</option>
                  <option value="info">Инфо</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="h-10 rounded-lg border border-[#e4e4e7] bg-white px-3 text-xs"
                >
                  <option value="all">Все статусы</option>
                  <option value="open">Открыт</option>
                  <option value="in_progress">В работе</option>
                  <option value="snoozed">Отложен</option>
                  <option value="resolved">Закрыт</option>
                  <option value="rejected">Отклонён</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </section>

      {activeTab === 'focus' && (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#18181b]">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Срочные сигналы
            </div>
            <div className="space-y-2">
              {urgentSignals.slice(0, 6).map((signal) => (
                <div key={signal.id} className={`rounded-xl border p-4 shadow-sm ${signalCardClass(signal.severity)}`}>
                  <div className={`mb-2 h-1 w-14 rounded-full ${signalAccentClass(signal.severity)}`} />
                  <div className="text-base font-semibold text-[#18181b]">{prettifySignalTitle(signal)}</div>
                  <div className="mt-1 text-sm text-slate-700">{prettifySignalInsight(signal)}</div>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span className={`rounded-full px-2 py-1 ${severityBadgeClass(signal.severity)}`}>{severityLabel(signal.severity)}</span>
                    <span className={`rounded-full px-2 py-1 ${statusBadgeClass(signal.status)}`}>{signalStatusLabel(signal.status)}</span>
                  </div>
                </div>
              ))}
              {urgentSignals.length === 0 && <div className="text-xs text-slate-500">Срочных сигналов нет.</div>}
            </div>
          </div>

          <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#18181b]">
              <Clock3 className="h-4 w-4 text-amber-600" />
              Просроченные задачи
            </div>
            <div className="space-y-2">
              {overdueTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <div className="text-sm font-medium text-[#18181b]">{task.title}</div>
                  <div className="mt-1 text-xs text-amber-800">Дедлайн: {formatDate(task.due_at)}</div>
                  {task.order_id ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/crm/orders/${task.order_id}`)}
                      className="mt-2 text-xs text-[#18181b] underline"
                    >
                      Открыть заказ
                    </button>
                  ) : null}
                </div>
              ))}
              {overdueTasks.length === 0 && <div className="text-xs text-slate-500">Просроченных задач нет.</div>}
            </div>
          </div>

          <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#18181b]">
              <XCircle className="h-4 w-4 text-slate-500" />
              Фоллоу-апы под риском
            </div>
            <div className="space-y-2">
              {overdueFollowups.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-lg border border-[#e4e4e7] p-3">
                  <div className="text-sm font-medium text-[#18181b]">{item.title || item.followup_type || item.id}</div>
                  <div className="mt-1 text-xs text-slate-500">Статус: {followupStatusLabel(item.status)}</div>
                  <div className="mt-1 text-xs text-slate-500">Срок: {formatDate(item.due_at)}</div>
                </div>
              ))}
              {overdueFollowups.length === 0 && <div className="text-xs text-slate-500">Просроченных фоллоу-апов нет.</div>}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'orders' && (
        <section className="space-y-3">
          {filteredOrders.map((order) => (
            <div key={order.order_id} className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-[#18181b]">{order.order_number || order.order_id}</div>
                  <div className="mt-1 text-xs text-slate-500">{order.bike_name || 'Велосипед не указан'}</div>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Сумма: {formatMoneyEur(order.total_amount_eur)}</span>
                <span>Создан: {formatDateShort(order.created_at)}</span>
                <span>Обновлён: {formatDateShort(order.updated_at || order.created_at)}</span>
                {order.customer?.full_name ? <span>Клиент: {order.customer.full_name}</span> : null}
                {!order.customer?.full_name && order.customer?.contact_value ? <span>Контакт: {order.customer.contact_value}</span> : null}
              </div>

              <button
                type="button"
                onClick={() => navigate(`/crm/orders/${order.order_id}`)}
                className="mt-3 h-9 rounded-lg border border-[#e4e4e7] px-3 text-xs font-medium text-[#18181b]"
              >
                Открыть заказ
              </button>
            </div>
          ))}

          {filteredOrders.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#e4e4e7] bg-white p-6 text-center text-sm text-slate-500">
              По текущему фильтру заказов не найдено.
            </div>
          )}
        </section>
      )}

      {activeTab === 'tasks' && (
        <section className="space-y-3">
          {filteredTasks.map((task) => {
            const overdue = isOverdue(task.due_at)
            return (
              <div
                key={task.id}
                className={`rounded-xl border p-4 shadow-sm ${overdue ? 'border-amber-200 bg-amber-50/60' : 'border-[#e4e4e7] bg-white'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[#18181b]">{task.title}</div>
                    {task.description ? <div className="mt-1 text-xs text-slate-500">{task.description}</div> : null}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] ${overdue ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'}`}>
                    {overdue ? 'Просрочено' : 'Активно'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Срок: {formatDate(task.due_at)}</span>
                  <span>Создано: {formatDate(task.created_at)}</span>
                </div>

                {task.order_id ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/crm/orders/${task.order_id}`)}
                    className="mt-3 h-9 rounded-lg border border-[#e4e4e7] px-3 text-xs font-medium text-[#18181b]"
                  >
                    Открыть заказ
                  </button>
                ) : null}
              </div>
            )
          })}

          {filteredTasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#e4e4e7] bg-white p-6 text-center text-sm text-slate-500">
              По текущему фильтру задач не найдено.
            </div>
          )}
        </section>
      )}

      {activeTab === 'followups' && (
        <section className="space-y-3">
          {filteredFollowups.map((item) => {
            const overdue = isOverdue(item.due_at)
            return (
              <div key={item.id} className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[#18181b]">{item.title || item.followup_type || item.id}</div>
                    <div className="mt-1 text-xs text-slate-500">Тип: {item.followup_type || 'общий'}</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] ${overdue ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                    {followupStatusLabel(item.status)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Срок: {formatDate(item.due_at)}</span>
                  <span>Создано: {formatDate(item.created_at)}</span>
                </div>

                {item.order_id ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/crm/orders/${item.order_id}`)}
                    className="mt-3 h-9 rounded-lg border border-[#e4e4e7] px-3 text-xs font-medium text-[#18181b]"
                  >
                    Открыть заказ
                  </button>
                ) : null}
              </div>
            )
          })}

          {filteredFollowups.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#e4e4e7] bg-white p-6 text-center text-sm text-slate-500">
              По текущему фильтру фоллоу-апы не найдены.
            </div>
          )}
        </section>
      )}

      {activeTab === 'signals' && (
        <section className="space-y-3">
          {filteredSignals.map((signal) => {
            const busy = Boolean(actionLoadingBySignal[signal.id])
            return (
              <div key={signal.id} className={`rounded-2xl border p-5 shadow-sm ${signalCardClass(signal.severity)}`}>
                <div className={`mb-3 h-1 w-20 rounded-full ${signalAccentClass(signal.severity)}`} />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold text-[#18181b]">{prettifySignalTitle(signal)}</div>
                    <div className="mt-1 text-sm text-slate-700">{prettifySignalInsight(signal)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2.5 py-1 ${severityBadgeClass(signal.severity)}`}>{severityLabel(signal.severity)}</span>
                    <span className={`rounded-full px-2.5 py-1 ${statusBadgeClass(signal.status)}`}>{signalStatusLabel(signal.status)}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>Тип: {translateSignalType(signal.signal_type)}</span>
                  <span>Создан: {formatDate(signal.created_at)}</span>
                  {signal.entity_id ? <span>Сущность: {signal.entity_type || 'сущность'} / {signal.entity_id}</span> : null}
                  {signal.priority_score != null ? <span>Приоритет: {Number(signal.priority_score).toFixed(1)}</span> : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {signal.entity_type === 'order' && signal.entity_id ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/crm/orders/${signal.entity_id}`)}
                      className="h-10 rounded-lg border border-[#d4d4d8] bg-white px-4 text-xs font-medium text-[#18181b]"
                    >
                      Открыть заказ
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decideSignal(signal.id, 'approve')}
                    className="h-10 rounded-lg border border-[#d4d4d8] bg-white px-4 text-xs font-medium disabled:opacity-60"
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decideSignal(signal.id, 'snooze')}
                    className="h-10 rounded-lg border border-[#d4d4d8] bg-white px-4 text-xs font-medium disabled:opacity-60"
                  >
                    Отложить 6ч
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decideSignal(signal.id, 'reject')}
                    className="inline-flex h-10 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-4 text-xs font-medium text-rose-700 disabled:opacity-60"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Отклонить
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decideSignal(signal.id, 'resolve')}
                    className="inline-flex h-10 items-center gap-1 rounded-lg bg-[#18181b] px-4 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Закрыть
                  </button>
                </div>
              </div>
            )
          })}

          {filteredSignals.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#e4e4e7] bg-white p-6 text-center text-sm text-slate-500">
              По текущим фильтрам сигналов не найдено.
            </div>
          )}
        </section>
      )}

      {isRefreshing && (
        <div className="fixed bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-[#e4e4e7] bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Обновление данных...
        </div>
      )}
    </div>
  )
}
