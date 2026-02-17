import * as React from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { adminMetricsApi } from '@/api'
import { useAuth } from '@/lib/auth'

type ModuleHealth = {
  status?: string
  eventsLast5m?: number
  eventsTotal?: number
  sessions?: number
  sessionsWithAttribution?: number
  attributionCoveragePct?: number
  ratePerMinute?: number
  errorRatePct?: number
  profilesTotal?: number
  profilesUpdatedWindow?: number
  profilesWithInsight?: number
  avgIntent?: number
  activeExperiments?: number
  totalAssignments?: number
  goalsWindow?: number
  topProfileIntent?: number
  lastEventAt?: string | null
  keyCount?: number
  source?: string
}

type OverviewData = {
  window?: { hours?: number; since?: string; now?: string }
  health?: {
    lastEventAt?: string | null
    eventsTotal?: number
    errors?: number
    errorRatePct?: number
    modules?: Record<string, ModuleHealth>
  }
  funnel?: {
    impressions?: number
    detail_open?: number
    favorite?: number
    add_to_cart?: number
    order?: number
    ctrPct?: number
    atcPct?: number
    orderPct?: number
  }
  journey?: {
    sessions?: number
    sessionsWithFirstClick?: number
    sessionsCatalog?: number
    sessionsProduct?: number
    sessionsAtc?: number
    sessionsBookingStart?: number
    sessionsBookingSuccess?: number
    firstClickRatePct?: number
    catalogReachPct?: number
    productReachPct?: number
    atcReachPct?: number
    bookingStartReachPct?: number
    bookingSuccessReachPct?: number
    bounceRatePct?: number
    avgTimeToFirstActionSec?: number
    avgSessionDurationSec?: number
  }
  acquisition?: {
    sessionsWithAttribution?: number
    coveragePct?: number
    topChannels?: Array<{ source: string; medium: string; events: number; sessions: number }>
    topCampaigns?: Array<{ campaign: string; events: number; sessions: number }>
  }
  sessionFacts?: {
    sessions?: number
    sessionsCheckoutAttempt?: number
    sessionsBookingSuccess?: number
    avgSessionDurationSec?: number
    checkoutAttemptRatePct?: number
    bookingSuccessRatePct?: number
  }
  performance?: {
    webVitals?: {
      lcpP75?: number
      clsP75?: number
      inpP75?: number
      fcpP75?: number
      ttfbP75?: number
      samples?: number
    }
    apiLatency?: {
      p95Ms?: number
      avgMs?: number
      errorRatePct?: number
      samples?: number
      stageBreakdown?: Record<string, {
        webVitals?: {
          lcpP75?: number
          clsP75?: number
          inpP75?: number
          fcpP75?: number
          ttfbP75?: number
          samples?: number
        }
        apiLatency?: {
          p75Ms?: number
          p95Ms?: number
          errorRatePct?: number
          samples?: number
        }
      }>
      topSlowEndpoints?: Array<{
        endpoint: string
        avgMs: number
        p95Ms: number
        count: number
        errorRatePct: number
      }>
    }
  }
  identity?: {
    persons?: number
    linkedUserNodes?: number
    linkedLeadNodes?: number
  }
  featureStore?: {
    totalProfiles?: number
    byBudgetCluster?: Array<{ budgetCluster: string; profiles: number }>
  }
  checkoutTelemetry?: {
    topErrorFields?: Array<{ field: string; errors: number; sessions: number }>
    stageLoss?: Array<{
      stage: string
      seenEvents: number
      submitAttempts: number
      successEvents: number
      errorEvents: number
      lossPct: number
    }>
  }
  guardrails?: {
    cancelRatePct?: number
    refundRatePct?: number
    apiErrorRatePct?: number
    apiP95Ms?: number
    timeToBookingSecP50?: number
    timeToBookingSecP75?: number
    degraded?: boolean
    reasons?: string[]
  }
  funnelContract?: {
    version?: string
    minCoveragePct?: number
    criticalPath?: string[]
    criticalPathOk?: boolean
    checks?: Array<{
      eventType: string
      stage: string
      total: number
      valid: number
      coveragePct: number
      status: string
      missingGroups?: Array<{ index: number; count: number }>
    }>
  }
  churn?: {
    summary?: {
      totalEvaluated?: number
      highRisk?: number
      mediumRisk?: number
      lowRisk?: number
      highRiskPct?: number
      mediumRiskPct?: number
    }
    topReasons?: Array<{ reason: string; count: number }>
    suggestedActions?: Array<{ action: string; sessions: number }>
    topAtRiskSessions?: Array<{
      sessionId: string
      channel?: string
      riskScore: number
      riskLevel: string
      recommendedAction: string
      reasons?: string[]
    }>
  }
  anomalies?: Array<{
    anomalyKey: string
    severity: string
    metricName: string
    baselineValue: number
    currentValue: number
    deltaPct: number
    createdAt: string
  }>
  lossPoints?: Array<{
    stageFrom: string
    stageTo: string
    from: number
    to: number
    conversionPct: number
    lossPct: number
  }>
  trends?: Array<{ bucket: string; impressions: number; detail_open: number; add_to_cart: number; order: number }>
  trendMeta?: {
    direction?: 'up' | 'down' | 'flat'
    scorePct?: number
    firstHalf?: number
    secondHalf?: number
    points?: number
  }
  topEvents?: Array<{ event_type: string; events: number }>
  topSources?: Array<{ source_path: string; events: number }>
  topReferrers?: Array<{ referrer: string; events: number }>
  topBikes?: Array<{ id: number; brand?: string; model?: string; detail_open?: number; add_to_cart?: number; order?: number }>
  profiles?: {
    total?: number
    withInsight?: number
    avgIntent?: number
    topDisciplines?: Array<{ key: string; score: number }>
    topBrands?: Array<{ key: string; score: number }>
    topProfiles?: Array<{
      profile_key: string
      weighted_price?: number
      intent_score?: number
      top_discipline?: string | null
      top_brand?: string | null
      updated_at?: string
    }>
  }
  experiments?: {
    diagnostics?: {
      srmAlerts?: number
      aaSuspicious?: number
      segmentedSignals?: number
    }
    list?: Array<{
      experimentKey: string
      name: string
      srm?: {
        detected?: boolean
        chiSquare?: number
      }
      aa?: {
        enabled?: boolean
        suspicious?: boolean
      }
      causalSegments?: Array<{
        segment: string
        variant: string
        sampleSize: number
        drLiftPct: number
      }>
      variants: Array<{
        variant: string
        configuredWeight: number
        assignments: number
        conversionPct: number
        orderRatePct?: number
        upliftVsControlPct: number
        causalUpliftPct?: number
      }>
    }>
  }
  autoOptimization?: Record<string, { value?: string; updatedAt?: string }>
  ceoFlow?: {
    totalEntries?: number
    uniqueSessions?: number
    avgEntriesPerSession?: number
    avgCatalogDurationSec?: number
    avgCardsBeforeFirstClick?: number
    avgProductDwellSec?: number
  }
  ceoFunnel?: Array<{
    stage: string
    title: string
    totalTouches: number
    uniqueSessions: number
    reachPct: number
    avgRetentionSec?: number
    nextStage?: string | null
    nextStageRatePct?: number
    lossPct?: number
  }>
  behavior?: {
    ceoFlow?: OverviewData['ceoFlow']
    ceoFunnel?: OverviewData['ceoFunnel']
    behaviorStages?: Array<{
      stage: string
      title: string
      totalTouches: number
      uniqueSessions: number
      reachPct: number
      avgRetentionSec?: number
      avgDwellSec?: number
      avgScrollDepthPct?: number
      nextStage?: string | null
      nextStageRatePct?: number
    }>
    stageTransitions?: Array<{
      stageFrom: string
      stageTo: string
      events: number
      sessions: number
      transitionRatePct: number
    }>
    pathTransitions?: Array<{
      fromPath: string
      toPath: string
      events: number
      sessions: number
    }>
    infoTransitions?: Array<{
      fromPath: string
      toPath: string
      events: number
      sessions: number
    }>
    topClickTargets?: Array<{
      target: string
      clicks: number
    }>
    topFavoriteBikes?: Array<{
      id: number
      brand?: string | null
      model?: string | null
      favorites: number
    }>
    topBookedBikes?: Array<{
      id: number
      brand?: string | null
      model?: string | null
      bookings: number
      orders: number
    }>
  }
}

type ReplayResult = {
  success?: boolean
  strategy?: string
  portfolio?: {
    experiments?: number
    assignments?: number
    expectedCurrent?: number
    expectedScenario?: number
    weightedUpliftPct?: number
  }
  experiments?: Array<{
    experimentKey: string
    assignments: number
    upliftPct: number
    currentWeights?: Record<string, number>
    scenarioWeights?: Record<string, number>
  }>
  error?: string
}

type GenericApiResponse = {
  success?: boolean
  error?: string
  updated?: number
  geminiUsed?: number
  decisions?: Array<{ action?: string }>
  created?: Array<unknown>
}

type WindowPreset = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'all'

const WINDOW_PRESET_OPTIONS: Array<{ key: WindowPreset; label: string; code: string }> = [
  { key: 'hourly', label: 'Почасовой', code: 'HOUR' },
  { key: 'daily', label: 'Дневной', code: 'DAY' },
  { key: 'weekly', label: 'Недельный', code: 'WEEK' },
  { key: 'monthly', label: 'Месячный', code: 'MONTH' },
  { key: 'all', label: 'За всё время', code: 'ALL' }
]

const WINDOW_PRESET_HOURS: Record<WindowPreset, number> = {
  hourly: 48,
  daily: 24 * 30,
  weekly: 24 * 182,
  monthly: 24 * 730,
  all: 24 * 3650
}

const MODULE_METRIC_PRIORITY: Record<string, string[]> = {
  ingest: ['eventsLast5m', 'eventsTotal', 'sessions', 'attributionCoveragePct', 'errorRatePct'],
  profiling: ['profilesTotal', 'profilesUpdatedWindow', 'profilesWithInsight', 'avgIntent'],
  experiments: ['activeExperiments', 'totalAssignments', 'goalsWindow', 'srmAlerts', 'aaSuspicious'],
  personalization: ['topProfileIntent', 'lastEventAt'],
  identity: ['persons', 'linkedUserNodes', 'linkedLeadNodes'],
  featurestore: ['profiles', 'topBudgetCluster'],
  performance: ['apiP95Ms', 'apiErrorRatePct', 'webVitalSamples', 'guardrailDegraded'],
  anomalydetection: ['activeAlerts'],
  contract: ['criticalPathOk', 'missingEvents', 'degradedEvents'],
  churn: ['highRiskPct', 'highRiskSessions', 'topAction'],
  gemini: ['keyCount', 'source']
}

function fmtNumber(value: unknown, fallback: string = '0'): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return n.toLocaleString('ru-RU')
}

function fmtPct(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0.00%'
  return `${n.toFixed(2)}%`
}

function fmtDate(value: unknown): string {
  if (!value) return '-'
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function fmtSec(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '0 c'
  if (n >= 60) return `${n.toFixed(1)} c`
  return `${n.toFixed(0)} c`
}

function fmtCurrencyEur(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '€0'
  return n.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  })
}

function ratioPct(part: unknown, total: unknown): number {
  const p = Number(part)
  const t = Number(total)
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return 0
  return (p / t) * 100
}

function estimateServiceFee(priceEur: unknown): number {
  const price = Number(priceEur)
  if (!Number.isFinite(price) || price <= 0) return 0
  if (price <= 1000) return 180
  if (price <= 1500) return 230
  if (price <= 2200) return 300
  if (price <= 3000) return 380
  if (price <= 4000) return 500
  if (price <= 5000) return 650
  return price * 0.1
}

function stageLabel(value: string): string {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'sessions') return 'Сессии'
  if (normalized === 'catalog') return 'Каталог'
  if (normalized === 'product') return 'Карточка товара'
  if (normalized === 'add_to_cart') return 'Добавили в корзину'
  if (normalized === 'booking_success') return 'Успешная бронь'
  return normalized || '-'
}

function moduleLabel(key: string): string {
  const normalized = String(key || '').toLowerCase()
  if (normalized === 'ingest') return 'Сбор событий'
  if (normalized === 'profiling') return 'Профилирование'
  if (normalized === 'experiments') return 'Эксперименты'
  if (normalized === 'personalization') return 'Персонализация'
  if (normalized === 'identity') return 'Сшивка идентичности'
  if (normalized === 'featurestore') return 'Feature Store'
  if (normalized === 'performance') return 'Производительность'
  if (normalized === 'anomalydetection') return 'Аномалии'
  if (normalized === 'contract') return 'Контракт воронки'
  if (normalized === 'churn') return 'Отток'
  if (normalized === 'gemini') return 'AI ключи'
  return key
}

function moduleStatusClass(status: string): string {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (normalized === 'degraded' || normalized === 'missing_keys') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (normalized === 'idle' || normalized === 'warming_up') return 'border-slate-200 bg-slate-50 text-slate-700'
  return 'border-red-200 bg-red-50 text-red-700'
}

function moduleMetricLabel(moduleKey: string, metricKey: string): string {
  const module = String(moduleKey || '').toLowerCase()
  const key = String(metricKey || '')
  const common: Record<string, string> = {
    eventsTotal: 'Событий',
    eventsLast5m: 'Событий за 5 мин',
    sessions: 'Сессий',
    attributionCoveragePct: 'Покрытие атрибуции',
    errorRatePct: 'Ошибки',
    profilesTotal: 'Профилей',
    profilesUpdatedWindow: 'Обновлено',
    profilesWithInsight: 'С инсайтами',
    avgIntent: 'Средний intent',
    activeExperiments: 'Активных A/B',
    totalAssignments: 'Назначений',
    goalsWindow: 'Целей',
    srmAlerts: 'SRM алерты',
    aaSuspicious: 'AA подозрения',
    topProfileIntent: 'Топ intent',
    lastEventAt: 'Последнее событие',
    persons: 'Людей',
    linkedUserNodes: 'Связано с user',
    linkedLeadNodes: 'Связано с CRM',
    profiles: 'Профилей в store',
    topBudgetCluster: 'Топ бюджет',
    apiP95Ms: 'API P95',
    apiErrorRatePct: 'API ошибки',
    webVitalSamples: 'Web Vitals samples',
    guardrailDegraded: 'Guardrail',
    activeAlerts: 'Активные алерты',
    criticalPathOk: 'Критический путь',
    missingEvents: 'Missing',
    degradedEvents: 'Degraded',
    highRiskPct: 'Высокий риск',
    highRiskSessions: 'Риск-сессии',
    topAction: 'Рекоменд. действие',
    keyCount: 'Ключей',
    source: 'Источник'
  }
  if (common[key]) return common[key]
  if (module === 'gemini' && key === 'status') return 'Статус'
  return key
}

function moduleMetricValue(metricKey: string, value: unknown): string {
  const key = String(metricKey || '')
  if (key.toLowerCase().includes('pct')) return fmtPct(value)
  if (key.toLowerCase().includes('ms')) return `${fmtNumber(value)} ms`
  if (key.toLowerCase().includes('at')) return fmtDate(value)
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  if (typeof value === 'number') return fmtNumber(value)
  return String(value ?? '-')
}

function trendDirectionClass(direction: string): string {
  const normalized = String(direction || '').toLowerCase()
  if (normalized === 'up') return 'text-emerald-700'
  if (normalized === 'down') return 'text-red-700'
  return 'text-slate-700'
}

function trendDirectionLabel(direction: string): string {
  const normalized = String(direction || '').toLowerCase()
  if (normalized === 'up') return 'Рост'
  if (normalized === 'down') return 'Снижение'
  return 'Стабильно'
}

function KpiCard({ title, code, value, hint }: { title: string; code: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title} ({code})</div>
      <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  )
}

function CeoKpiCard({
  title,
  code,
  value,
  hint,
  accentClass
}: {
  title: string
  code: string
  value: string
  hint?: string
  accentClass?: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 ${accentClass || 'bg-slate-900'}`} />
      <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">{title} ({code})</div>
      <div className="mt-2 text-3xl font-black leading-none text-slate-900">{value}</div>
      {hint ? <div className="mt-2 text-xs text-slate-600">{hint}</div> : null}
    </div>
  )
}

export default function AdminMetricsCorePage() {
  const { user } = useAuth()
  const [windowPreset, setWindowPreset] = React.useState<WindowPreset>('daily')
  const [viewMode, setViewMode] = React.useState<'ceo' | 'cto'>('ceo')
  const [loading, setLoading] = React.useState<boolean>(true)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string>('')
  const [notice, setNotice] = React.useState<string>('')
  const [data, setData] = React.useState<OverviewData | null>(null)
  const [sessionRows, setSessionRows] = React.useState<Array<Record<string, unknown>>>([])
  const [replay, setReplay] = React.useState<ReplayResult | null>(null)

  const isAdmin = String(user?.role || '').toLowerCase() === 'admin'

  const load = React.useCallback(async (preset?: WindowPreset) => {
    setLoading(true)
    setError('')
    try {
      const effectivePreset = preset ?? windowPreset
      const effectiveHours = WINDOW_PRESET_HOURS[effectivePreset]
      const [res, factsRes] = await Promise.all([
        adminMetricsApi.getCoreOverview({ windowHours: effectiveHours, windowPreset: effectivePreset }),
        adminMetricsApi.getSessionFacts({ windowHours: effectiveHours, windowPreset: effectivePreset, limit: 30, offset: 0 })
      ])
      if (!res?.success) {
        setError(String((res as { error?: string })?.error || 'Не удалось загрузить центр метрик'))
        setData(null)
        setSessionRows([])
      } else {
        setData(res as OverviewData)
        if (factsRes?.success && Array.isArray((factsRes as { rows?: unknown[] }).rows)) {
          setSessionRows((factsRes as { rows: unknown[] }).rows as Array<Record<string, unknown>>)
        } else {
          setSessionRows([])
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Network error'
      setError(String(message))
      setData(null)
      setSessionRows([])
    } finally {
      setLoading(false)
    }
  }, [windowPreset])

  React.useEffect(() => {
    if (isAdmin) {
      void load()
    }
  }, [isAdmin, load])

  const refreshInsights = async (force: boolean) => {
    setBusy('insights')
    setNotice('')
    try {
      const res = await adminMetricsApi.refreshInsights({ limit: 25, force })
      if (!res?.success) {
        setNotice(String((res as { error?: string })?.error || 'Ошибка обновления инсайтов'))
      } else {
        const payload = res as GenericApiResponse
        setNotice(`Инсайты обновлены: ${fmtNumber(payload.updated)} | Gemini запусков: ${fmtNumber(payload.geminiUsed)}`)
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const optimize = async (dryRun: boolean) => {
    setBusy(dryRun ? 'dryrun' : 'apply')
    setNotice('')
    try {
      const res = await adminMetricsApi.optimizeExperiments({
        dryRun,
        windowDays: 14,
        minAssignments: 120
      })
      if (!res?.success) {
        setNotice(String((res as { error?: string })?.error || 'Ошибка оптимизации экспериментов'))
      } else {
        const payload = res as GenericApiResponse
        const decisions = Array.isArray(payload.decisions) ? payload.decisions : []
        const applied = decisions.filter((d) => d.action === 'reweighted' || d.action === 'fallback_reweighted').length
        const previews = decisions.filter((d) => d.action === 'preview_reweight' || d.action === 'preview_fallback_reweight').length
        setNotice(dryRun
          ? `Симуляция готова: потенциальных изменений ${previews}`
          : `Оптимизация применена: изменено экспериментов ${applied}`)
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const runAnomalyScan = async () => {
    setBusy('anomaly')
    setNotice('')
    try {
      const res = await adminMetricsApi.runAnomalies({ lookbackHours: 72, baselineHours: 24 })
      if (!res?.success) {
        setNotice(String((res as { error?: string })?.error || 'Ошибка сканирования аномалий'))
      } else {
        const createdCount = Array.isArray((res as { created?: unknown[] }).created) ? ((res as { created: unknown[] }).created.length) : 0
        setNotice(`Скан завершён: новых аномалий ${fmtNumber(createdCount)}`)
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const runDailyDigest = async () => {
    setBusy('digest')
    setNotice('')
    try {
      const res = await adminMetricsApi.runDailyDigest({ lookbackHours: 168, baselineHours: 24 })
      if (!res?.success) {
        setNotice(String((res as { error?: string })?.error || 'Ошибка daily digest'))
      } else {
        const alerts = Array.isArray((res as { alerts?: unknown[] }).alerts) ? (res as { alerts: unknown[] }).alerts.length : 0
        setNotice(`Daily digest сформирован: активных алертов ${fmtNumber(alerts)}`)
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const runContractCheck = async () => {
    setBusy('contract')
    setNotice('')
    try {
      const windowHours = WINDOW_PRESET_HOURS[windowPreset]
      const res = await adminMetricsApi.checkFunnelContract({ windowHours, windowPreset, minCoveragePct: 90 })
      if (!res?.success) {
        setNotice(String((res as { error?: string })?.error || 'Ошибка проверки контракта воронки'))
      } else {
        const payload = res as { criticalPathOk?: boolean; checks?: Array<{ status?: string }> }
        const broken = Array.isArray(payload.checks) ? payload.checks.filter((r) => r.status === 'missing' || r.status === 'degraded').length : 0
        setNotice(payload.criticalPathOk
          ? `Контракт воронки в норме. Нарушений: ${fmtNumber(broken)}`
          : `Контракт воронки нарушен. Нарушений: ${fmtNumber(broken)}`)
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const runReplay = async (strategy: 'causal_best' | 'bandit_mean') => {
    setBusy(`replay_${strategy}`)
    setNotice('')
    try {
      const res = await adminMetricsApi.runReplay({ windowDays: 14, minAssignments: 80, strategy })
      if (!res?.success) {
        setNotice(String((res as { error?: string })?.error || 'Ошибка replay simulation'))
      } else {
        const payload = res as ReplayResult
        setReplay(payload)
        setNotice(`Replay (${strategy}) выполнен. Portfolio uplift: ${fmtPct(payload?.portfolio?.weightedUpliftPct)}`)
      }
    } finally {
      setBusy(null)
    }
  }

  const runDemoSeed = async () => {
    setBusy('demo_seed')
    setNotice('')
    try {
      const seed = Date.now()
      const res = await adminMetricsApi.runDemoSeed({ sessions: 1000, daysBack: 35, seed })
      if (!res?.success) {
        setNotice(String((res as { error?: string })?.error || 'Не удалось сгенерировать демо-данные'))
      } else {
        const payload = res as { sessionsGenerated?: number; eventsInserted?: number }
        setNotice(`Demo-датасет готов: сессий ${fmtNumber(payload.sessionsGenerated)} | событий ${fmtNumber(payload.eventsInserted)}`)
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const modules = data?.health?.modules || {}
  const moduleRows = Object.entries(modules)
  const experiments = data?.experiments?.list || []
  const trends = data?.trends || []
  const topChannels = data?.acquisition?.topChannels || []
  const topCampaigns = data?.acquisition?.topCampaigns || []
  const topEvents = data?.topEvents || []
  const topSources = data?.topSources || []
  const topReferrers = data?.topReferrers || []
  const showFunnelChart = !loading && trends.length > 0
  const stageBreakdown = Object.entries(data?.performance?.apiLatency?.stageBreakdown || {})
  const ceoFlow = data?.ceoFlow || data?.behavior?.ceoFlow || {}
  const behaviorStages = data?.behavior?.behaviorStages || []
  const topClickTargets = data?.behavior?.topClickTargets || []
  const infoTransitions = data?.behavior?.infoTransitions || []
  const topFavoriteBikes = data?.behavior?.topFavoriteBikes || []
  const topBookedBikes = data?.behavior?.topBookedBikes || []
  const importantAlerts = React.useMemo(() => {
    const alerts: Array<{ key: string; severity: 'critical' | 'warning' | 'info'; message: string }> = []
    if (data?.guardrails?.degraded) {
      alerts.push({
        key: 'guardrail',
        severity: 'critical',
        message: `Guardrail в деградации: ${(data?.guardrails?.reasons || []).join(', ') || 'проверьте API/качество заказов'}`
      })
    }
    if (data?.funnelContract && !data.funnelContract.criticalPathOk) {
      const broken = (data.funnelContract.checks || []).filter((row) => row.status === 'missing' || row.status === 'degraded').length
      alerts.push({
        key: 'contract',
        severity: 'critical',
        message: `Контракт воронки нарушен: ${fmtNumber(broken)} проблемных событий`
      })
    }
    if ((data?.anomalies || []).length > 0) {
      const severe = (data?.anomalies || []).filter((row) => row.severity === 'critical' || row.severity === 'warning').length
      if (severe > 0) {
        alerts.push({
          key: 'anomaly',
          severity: 'warning',
          message: `Обнаружены аномалии: ${fmtNumber(severe)} важных сигналов`
        })
      }
    }
    if (Number(data?.journey?.bookingSuccessReachPct || 0) < 5 && Number(data?.journey?.sessions || 0) > 30) {
      alerts.push({
        key: 'booking_drop',
        severity: 'warning',
        message: `Низкий проход до брони: ${fmtPct(data?.journey?.bookingSuccessReachPct)}`
      })
    }
    if (alerts.length === 0) {
      alerts.push({
        key: 'all_good',
        severity: 'info',
        message: 'Критических сигналов нет. Система выглядит стабильно.'
      })
    }
    return alerts.slice(0, 4)
  }, [data])

  const sessionsTotal = Number(ceoFlow?.uniqueSessions ?? data?.journey?.sessions ?? 0)
  const entriesTotal = Number(ceoFlow?.totalEntries ?? 0)
  const repeatEntries = Math.max(0, entriesTotal - sessionsTotal)
  const catalogReached = Number(data?.journey?.sessionsCatalog ?? 0)
  const productReached = Number(data?.journey?.sessionsProduct ?? 0)
  const checkoutReached = Number(data?.journey?.sessionsBookingStart ?? 0)
  const ordersTotal = Number(data?.journey?.sessionsBookingSuccess ?? data?.funnel?.order ?? 0)
  const firstClickPct = Number(data?.journey?.firstClickRatePct ?? 0)
  const avgCatalogSec = Number(ceoFlow?.avgCatalogDurationSec ?? 0)
  const avgProductSec = Number(ceoFlow?.avgProductDwellSec ?? 0)
  const avgTouches = Number(ceoFlow?.avgEntriesPerSession ?? 0)
  const avgTicket = (() => {
    const prices = (data?.profiles?.topProfiles || [])
      .map((row) => Number(row.weighted_price))
      .filter((value) => Number.isFinite(value) && value > 0)
    if (prices.length === 0) return 0
    return prices.reduce((sum, value) => sum + value, 0) / prices.length
  })()
  const estimatedGmv = ordersTotal * avgTicket
  const estimatedServiceRevenue = ordersTotal * estimateServiceFee(avgTicket)
  const sessionLossPct = Math.max(0, 100 - ratioPct(ordersTotal, sessionsTotal))
  const checkoutStepPct = ratioPct(ordersTotal, checkoutReached)
  const uniqueSharePct = ratioPct(sessionsTotal, entriesTotal)

  const ceoStages = [
    { key: 'sessions', label: 'Сессии', value: sessionsTotal, subtitle: 'Все уникальные пользователи' },
    { key: 'catalog', label: 'Каталог', value: catalogReached, subtitle: 'Дошли до каталога' },
    { key: 'product', label: 'Карточка', value: productReached, subtitle: 'Открыли карточку товара' },
    { key: 'checkout', label: 'Checkout', value: checkoutReached, subtitle: 'Начали оформление' },
    { key: 'booking_success', label: 'Бронь', value: ordersTotal, subtitle: 'Успешно завершили' }
  ]

  const ceoStageTransitions = ceoStages.slice(0, -1).map((stage, index) => {
    const next = ceoStages[index + 1]
    const conversionPct = ratioPct(next.value, stage.value)
    const lossPct = Math.max(0, 100 - conversionPct)
    return {
      id: `${stage.key}_${next.key}`,
      label: `${stage.label} → ${next.label}`,
      from: stage.value,
      to: next.value,
      conversionPct,
      lossPct
    }
  })

  const primaryDrop = ceoStageTransitions
    .slice()
    .sort((a, b) => b.lossPct - a.lossPct)[0]

  const topChannel = topChannels[0]
  const topHotspot = topClickTargets[0]
  const topBooked = topBookedBikes[0]

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-slate-900">Центр метрик конверсии</h1>
          <p className="mt-2 text-sm text-slate-600">Доступ доступен только для роли admin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e2e8f0_0%,#f8fafc_35%,#ffffff_100%)] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Центр метрик конверсии (CONVERSION_HUB)</h1>
              <p className="mt-1 text-sm text-slate-600">Бизнес-панель: воронка, потери, качество данных, техриски и управление экспериментами в одном месте.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/admin" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Назад в Admin</Link>
              <Link to="/admin/growth-attribution" className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700">Партнёрские ссылки</Link>
              <div className="flex overflow-hidden rounded-lg border border-slate-300">
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-semibold transition ${
                    viewMode === 'ceo' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => setViewMode('ceo')}
                >
                  CEO
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-semibold transition ${
                    viewMode === 'cto' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => setViewMode('cto')}
                >
                  CTO
                </button>
              </div>
              <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {WINDOW_PRESET_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                      windowPreset === option.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                    onClick={() => {
                      setWindowPreset(option.key)
                      void load(option.key)
                    }}
                    disabled={loading}
                    title={`${option.label} режим (${option.code})`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => void load()} disabled={loading}>
                {loading ? 'Обновление...' : 'Обновить'}
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">Порядок периодов: Почасовой → Дневной → Недельный → Месячный → За всё время.</div>
          {!!notice && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}
          {!!error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>
        {viewMode === 'ceo' ? (
          <>
            <div
              className="relative overflow-hidden rounded-3xl border border-slate-200 bg-[linear-gradient(140deg,#111827_0%,#172554_42%,#0f766e_100%)] p-5 text-white shadow-[0_20px_70px_-35px_rgba(15,23,42,0.65)] md:p-7"
              style={{ fontFamily: '"Sora","Manrope","Segoe UI",sans-serif' }}
            >
              <div className="pointer-events-none absolute -right-28 -top-20 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
              <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
              <h2 className="text-2xl font-black tracking-tight md:text-3xl">CEO Cockpit</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-200">Весь путь клиента: от первого входа до брони. Ключевые деньги, потери и точки управленческого воздействия.</p>
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-[11px] uppercase tracking-[0.09em] text-slate-200">Тренд спроса</div>
                  <div className={`mt-1 text-2xl font-black ${trendDirectionClass(String(data?.trendMeta?.direction || 'flat'))}`}>
                    {trendDirectionLabel(String(data?.trendMeta?.direction || 'flat'))}
                  </div>
                  <div className="mt-1 text-xs text-slate-200/90">Дельта: {fmtPct(data?.trendMeta?.scorePct)} · Точек: {fmtNumber(data?.trendMeta?.points)}</div>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-[11px] uppercase tracking-[0.09em] text-slate-200">Оценка GMV окна</div>
                  <div className="mt-1 text-2xl font-black">{fmtCurrencyEur(estimatedGmv)}</div>
                  <div className="mt-1 text-xs text-slate-200/90">Заказов: {fmtNumber(ordersTotal)} · Средний чек: {fmtCurrencyEur(avgTicket)}</div>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-[11px] uppercase tracking-[0.09em] text-slate-200">Сервисная выручка</div>
                  <div className="mt-1 text-2xl font-black">{fmtCurrencyEur(estimatedServiceRevenue)}</div>
                  <div className="mt-1 text-xs text-slate-200/90">Оценка по тарифной сетке сервиса</div>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-[11px] uppercase tracking-[0.09em] text-slate-200">Главная точка потерь</div>
                  <div className="mt-1 text-xl font-black">{primaryDrop?.label || 'Недостаточно данных'}</div>
                  <div className="mt-1 text-xs text-slate-200/90">Потери: {fmtPct(primaryDrop?.lossPct)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" style={{ fontFamily: '"Sora","Manrope","Segoe UI",sans-serif' }}>
              <CeoKpiCard title="Уникальные сессии" code="SES_UNQ" value={fmtNumber(sessionsTotal)} hint={`С первым кликом: ${fmtPct(firstClickPct)}`} accentClass="bg-cyan-500" />
              <CeoKpiCard title="Повторные входы" code="ENT_REPEAT" value={fmtNumber(repeatEntries)} hint={`Доля уникальных входов: ${fmtPct(uniqueSharePct)}`} accentClass="bg-violet-500" />
              <CeoKpiCard title="Средняя глубина" code="SES_TOUCH_AVG" value={avgTouches.toFixed(2)} hint="Касаний/входов на 1 сессию" accentClass="bg-blue-600" />
              <CeoKpiCard title="Проход до брони" code="SES_BOOK_REACH" value={fmtPct(ratioPct(ordersTotal, sessionsTotal))} hint={`Общий отток: ${fmtPct(sessionLossPct)}`} accentClass="bg-emerald-500" />
              <CeoKpiCard title="CR checkout → бронь" code="CHK_BOOK_CR" value={fmtPct(checkoutStepPct)} hint={`Начали checkout: ${fmtNumber(checkoutReached)}`} accentClass="bg-amber-500" />
              <CeoKpiCard title="Удержание в каталоге" code="CAT_TIME_AVG" value={fmtSec(avgCatalogSec)} hint="Среднее время на этапе каталога" accentClass="bg-sky-500" />
              <CeoKpiCard title="Изучение карточки" code="PROD_DWELL_AVG" value={fmtSec(avgProductSec)} hint="Среднее время на карточке товара" accentClass="bg-teal-500" />
              <CeoKpiCard title="Событий в окне" code="EVT_WIN" value={fmtNumber(data?.health?.eventsTotal)} hint={`Последнее событие: ${fmtDate(data?.health?.lastEventAt)}`} accentClass="bg-slate-700" />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global Trend (TREND_GLOBAL)</div>
              <div className={`mt-1 text-2xl font-black ${trendDirectionClass(String(data?.trendMeta?.direction || 'flat'))}`}>
                {trendDirectionLabel(String(data?.trendMeta?.direction || 'flat'))}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Delta: {fmtPct(data?.trendMeta?.scorePct)} | Points: {fmtNumber(data?.trendMeta?.points)}
              </div>
            </div>
            <KpiCard title="Events in Window" code="EVT_WIN" value={fmtNumber(data?.health?.eventsTotal)} hint={`Last event: ${fmtDate(data?.health?.lastEventAt)}`} />
            <KpiCard title="Unique Sessions" code="SES_UNQ" value={fmtNumber(data?.journey?.sessions)} hint={`With first click: ${fmtPct(data?.journey?.firstClickRatePct)}`} />
            <KpiCard title="All Site Entries" code="ENT_ALL" value={fmtNumber(ceoFlow?.totalEntries)} hint={`Touches/session: ${Number(ceoFlow?.avgEntriesPerSession || 0).toFixed(2)}`} />
            <KpiCard title="Pipeline Errors" code="PIPE_ERR" value={fmtNumber(data?.health?.errors)} hint={`Error rate: ${fmtPct(data?.health?.errorRatePct)}`} />
            <KpiCard title="Attribution Coverage" code="ATTR_COV" value={fmtPct(data?.acquisition?.coveragePct)} hint={`Sessions with attribution: ${fmtNumber(data?.acquisition?.sessionsWithAttribution)}`} />
            <KpiCard title="Reached Catalog" code="SES_CAT" value={fmtNumber(data?.journey?.sessionsCatalog)} hint={`Reach: ${fmtPct(data?.journey?.catalogReachPct)}`} />
            <KpiCard title="Reached Product" code="SES_PROD" value={fmtNumber(data?.journey?.sessionsProduct)} hint={`Reach: ${fmtPct(data?.journey?.productReachPct)}`} />
            <KpiCard title="Started Checkout" code="SES_CHK_START" value={fmtNumber(data?.journey?.sessionsBookingStart)} hint={`Reach: ${fmtPct(data?.journey?.bookingStartReachPct)}`} />
            <KpiCard title="Successful Booking" code="SES_BOOK_OK" value={fmtNumber(data?.journey?.sessionsBookingSuccess)} hint={`Reach: ${fmtPct(data?.journey?.bookingSuccessReachPct)}`} />
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm md:p-6" style={{ fontFamily: '"Sora","Manrope","Segoe UI",sans-serif' }}>
          <h2 className="text-lg font-bold text-slate-900">Приоритетные сигналы CEO (ALERT_CENTER)</h2>
          <p className="mt-1 text-sm text-slate-600">Короткий список проблем, которые напрямую влияют на деньги и конверсию.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {importantAlerts.map((alert) => (
              <div
                key={alert.key}
                className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
                  alert.severity === 'critical'
                    ? 'border-red-200 bg-red-50/80 text-red-700'
                    : alert.severity === 'warning'
                      ? 'border-amber-200 bg-amber-50/80 text-amber-800'
                      : 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
                }`}
              >
                {alert.message}
              </div>
            ))}
          </div>
        </div>

        {viewMode === 'ceo' ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6" style={{ fontFamily: '"Sora","Manrope","Segoe UI",sans-serif' }}>
            <h2 className="text-lg font-bold text-slate-900">Воронка пути клиента: где теряем людей</h2>
            <p className="mt-1 text-sm text-slate-600">Показывает каждый шаг, конверсию на следующий этап и точный размер потерь.</p>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 xl:col-span-3">
                <h3 className="text-sm font-bold text-slate-900">Объём на этапах (уникальные пользователи)</h3>
                <div className="mt-2 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ceoStages} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => fmtNumber(value)} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                        {ceoStages.map((entry, index) => (
                          <Cell
                            key={`cell_${entry.key}`}
                            fill={['#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444'][index % 5]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 xl:col-span-2">
                <h3 className="text-sm font-bold text-slate-900">Переходы и потери (LOSS_PATH)</h3>
                <div className="mt-2 space-y-2">
                  {ceoStageTransitions.map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-semibold text-slate-800">{row.label}</span>
                        <span className="text-red-600">Потери {fmtPct(row.lossPct)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, row.conversionPct))}%` }} />
                      </div>
                      <div className="mt-1 text-xs text-slate-600">Было {fmtNumber(row.from)} → стало {fmtNumber(row.to)} · CR {fmtPct(row.conversionPct)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Этап</th>
                    <th className="px-2 py-2">Уникальные</th>
                    <th className="px-2 py-2">Описание шага</th>
                  </tr>
                </thead>
                <tbody>
                  {ceoStages.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100">
                      <td className="px-2 py-2 font-semibold text-slate-800">{row.label}</td>
                      <td className="px-2 py-2">{fmtNumber(row.value)}</td>
                      <td className="px-2 py-2 text-slate-600">{row.subtitle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 xl:col-span-2">
                <h3 className="text-sm font-bold text-slate-900">Тренд этапов воронки</h3>
                <div className="mt-3 h-64">
                  {showFunnelChart ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
                      <AreaChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="impressions" stroke="#0f172a" fill="#cbd5e1" name="Показы" />
                        <Area type="monotone" dataKey="detail_open" stroke="#2563eb" fill="#93c5fd" name="Открытия карточек" />
                        <Area type="monotone" dataKey="add_to_cart" stroke="#f59e0b" fill="#fcd34d" name="Добавления в корзину" />
                        <Area type="monotone" dataKey="order" stroke="#16a34a" fill="#86efac" name="Брони" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                      Пока нет данных тренда в выбранном окне.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-bold text-slate-900">Ключевые драйверы</h3>
                <div className="mt-2 space-y-3 text-sm text-slate-700">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Топ-канал</div>
                    {topChannel ? (
                      <div className="mt-1">
                        <div className="font-semibold">{topChannel.source}/{topChannel.medium}</div>
                        <div className="text-xs text-slate-600">Сессии: {fmtNumber(topChannel.sessions)} · События: {fmtNumber(topChannel.events)}</div>
                      </div>
                    ) : <div className="mt-1 text-slate-500">Нет данных по каналам.</div>}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Самая кликабельная точка</div>
                    {topHotspot ? (
                      <div className="mt-1">
                        <div className="font-semibold break-all">{topHotspot.target}</div>
                        <div className="text-xs text-slate-600">Клики: {fmtNumber(topHotspot.clicks)}</div>
                      </div>
                    ) : <div className="mt-1 text-slate-500">Нет сигналов кликов.</div>}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Топ-модель по заказам</div>
                    {topBooked ? (
                      <div className="mt-1">
                        <div className="font-semibold">#{topBooked.id} {topBooked.brand || ''} {topBooked.model || ''}</div>
                        <div className="text-xs text-slate-600">Заказы: {fmtNumber(topBooked.orders || topBooked.bookings)}</div>
                      </div>
                    ) : <div className="mt-1 text-slate-500">Нет данных по заказам.</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-bold text-slate-900">Click Hotspots</h3>
                <div className="mt-2 space-y-1 text-sm">
                  {topClickTargets.length === 0 ? (
                    <div className="text-slate-500">Нет сигналов кликов в выбранном окне.</div>
                  ) : topClickTargets.slice(0, 8).map((row) => (
                    <div key={row.target} className="flex justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
                      <span className="truncate">{row.target}</span>
                      <b>{fmtNumber(row.clicks)}</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-bold text-slate-900">Переходы product → info</h3>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {infoTransitions.length === 0 ? (
                    <div className="text-slate-500">Переходов нет.</div>
                  ) : infoTransitions.slice(0, 8).map((row) => (
                    <div key={`info_${row.fromPath}_${row.toPath}`} className="flex justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
                      <span className="truncate">{row.fromPath} → {row.toPath}</span>
                      <b>{fmtNumber(row.sessions)}</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-bold text-slate-900">Избранное и заказы по моделям</h3>
                <div className="text-xs uppercase tracking-wide text-slate-500">Избранное</div>
                <div className="mt-2 space-y-1 text-sm">
                  {topFavoriteBikes.slice(0, 5).map((bike) => (
                    <div key={`fav_${bike.id}`} className="flex justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
                      <span className="truncate">#{bike.id} {bike.brand || ''} {bike.model || ''}</span>
                      <b>{fmtNumber(bike.favorites)}</b>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs uppercase tracking-wide text-slate-500">Заказы</div>
                <div className="mt-2 space-y-1 text-sm">
                  {topBookedBikes.slice(0, 5).map((bike) => (
                    <div key={`book_${bike.id}`} className="flex justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
                      <span className="truncate">#{bike.id} {bike.brand || ''} {bike.model || ''}</span>
                      <b>{fmtNumber(bike.orders || bike.bookings)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Строк по поведению: {fmtNumber(behaviorStages.length)} · Входы: {fmtNumber(entriesTotal)} · Уникальные: {fmtNumber(sessionsTotal)}
            </div>
          </div>
        ) : null}

        {viewMode === 'cto' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <h2 className="text-lg font-bold text-slate-900">Customer Journey and Loss Points (FUNNEL_PATH)</h2>
            <p className="mt-1 text-sm text-slate-600">Shows how many users pass each stage and where conversion is being lost.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <KpiCard title="Показы карточек" code="FNL_IMP" value={fmtNumber(data?.funnel?.impressions)} />
              <KpiCard title="Открытия деталей" code="FNL_DTL" value={fmtNumber(data?.funnel?.detail_open)} hint={`CTR: ${fmtPct(data?.funnel?.ctrPct)}`} />
              <KpiCard title="Добавления в корзину" code="FNL_ATC" value={fmtNumber(data?.funnel?.add_to_cart)} hint={`ATC: ${fmtPct(data?.funnel?.atcPct)}`} />
              <KpiCard title="Заказы" code="FNL_ORD" value={fmtNumber(data?.funnel?.order)} hint={`Order rate: ${fmtPct(data?.funnel?.orderPct)}`} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <h3 className="text-sm font-bold text-slate-900">Динамика этапов воронки (FUNNEL_TREND)</h3>
                <div className="mt-3 h-64">
                  {showFunnelChart ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
                      <AreaChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="impressions" stroke="#0f172a" fill="#cbd5e1" name="Показы (FNL_IMP)" />
                        <Area type="monotone" dataKey="detail_open" stroke="#2563eb" fill="#93c5fd" name="Детали (FNL_DTL)" />
                        <Area type="monotone" dataKey="add_to_cart" stroke="#f59e0b" fill="#fcd34d" name="Корзина (FNL_ATC)" />
                        <Area type="monotone" dataKey="order" stroke="#16a34a" fill="#86efac" name="Заказы (FNL_ORD)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                      Пока нет данных тренда в выбранном окне.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <h3 className="text-sm font-bold text-slate-900">Переходы и потери между этапами (LOSS_PATH)</h3>
                <div className="mt-2 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-2">Переход</th>
                        <th className="px-2 py-2">Из</th>
                        <th className="px-2 py-2">В</th>
                        <th className="px-2 py-2">Конверсия</th>
                        <th className="px-2 py-2">Потери</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.lossPoints || []).map((row) => (
                        <tr key={`${row.stageFrom}_${row.stageTo}`} className="border-b border-slate-100">
                          <td className="px-2 py-2">{stageLabel(row.stageFrom)} → {stageLabel(row.stageTo)}</td>
                          <td className="px-2 py-2">{fmtNumber(row.from)}</td>
                          <td className="px-2 py-2">{fmtNumber(row.to)}</td>
                          <td className="px-2 py-2">{fmtPct(row.conversionPct)}</td>
                          <td className="px-2 py-2 text-red-600">{fmtPct(row.lossPct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className={`rounded-2xl border border-slate-200 bg-white p-4 md:p-5 ${viewMode === 'cto' ? '' : 'hidden'}`}>
          <h2 className="text-lg font-bold text-slate-900">Качество сбора данных (DATA_QUALITY)</h2>
          <p className="mt-1 text-sm text-slate-600">Контроль корректности трекинга: модули, контракт воронки и детализация ошибок checkout-форм.</p>
          <div className="mt-2 text-xs text-slate-500">Статусы: `ok` = всё стабильно, `degraded` = есть риск потерь, `idle`/`warming_up` = мало данных.</div>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Состояние модулей (MODULE_HEALTH)</h3>
              <div className="mt-2 space-y-2">
                {moduleRows.map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{moduleLabel(key)}</div>
                        <div className="text-xs text-slate-500">{key}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${moduleStatusClass(String(value.status || 'unknown'))}`}>{String(value.status || 'unknown')}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      {(MODULE_METRIC_PRIORITY[String(key || '').toLowerCase()] || Object.keys(value || {}).filter((k) => k !== 'status').slice(0, 6))
                        .map((metricKey) => [metricKey, (value as Record<string, unknown>)?.[metricKey]] as const)
                        .filter(([, metricValue]) => metricValue != null)
                        .map(([metricKey, metricValue]) => (
                          <div key={metricKey} className="rounded-md bg-white px-2 py-1">
                            <span className="font-semibold">{moduleMetricLabel(String(key), metricKey)}:</span> {moduleMetricValue(metricKey, metricValue)}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Контракт воронки (FUNNEL_CONTRACT)</h3>
              <div className="mt-1 text-xs text-slate-600">Версия: {data?.funnelContract?.version || '-'} | Критический путь: <b>{data?.funnelContract?.criticalPathOk ? 'OK' : 'DEGRADED'}</b></div>
              <div className="mt-2 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Событие</th>
                      <th className="px-2 py-2">Этап</th>
                      <th className="px-2 py-2">Coverage</th>
                      <th className="px-2 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.funnelContract?.checks || []).map((row) => (
                      <tr key={`${row.eventType}_${row.stage}`} className="border-b border-slate-100">
                        <td className="px-2 py-2">{row.eventType}</td>
                        <td className="px-2 py-2">{row.stage}</td>
                        <td className="px-2 py-2">{fmtPct(row.coveragePct)}</td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${moduleStatusClass(String(row.status || 'unknown'))}`}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Ошибки полей формы (FORM_FIELD_ERRORS)</h3>
              <div className="mt-2 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Поле</th>
                      <th className="px-2 py-2">Ошибки</th>
                      <th className="px-2 py-2">Сессии</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.checkoutTelemetry?.topErrorFields || []).map((row) => (
                      <tr key={row.field} className="border-b border-slate-100">
                        <td className="px-2 py-2">{row.field}</td>
                        <td className="px-2 py-2">{fmtNumber(row.errors)}</td>
                        <td className="px-2 py-2">{fmtNumber(row.sessions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Потери по шагам checkout (FORM_STAGE_LOSS)</h3>
              <div className="mt-2 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Этап</th>
                      <th className="px-2 py-2">Попытки</th>
                      <th className="px-2 py-2">Успех</th>
                      <th className="px-2 py-2">Потери</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.checkoutTelemetry?.stageLoss || []).map((row) => (
                      <tr key={row.stage} className="border-b border-slate-100">
                        <td className="px-2 py-2">{row.stage}</td>
                        <td className="px-2 py-2">{fmtNumber(row.submitAttempts)}</td>
                        <td className="px-2 py-2">{fmtNumber(row.successEvents)}</td>
                        <td className="px-2 py-2 text-red-600">{fmtPct(row.lossPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-lg font-bold text-slate-900">Источники спроса и контент (TRAFFIC_INTEL)</h2>
          <p className="mt-1 text-sm text-slate-600">Какие каналы приводят сессии и какие страницы/события дают наибольший вклад в воронку.</p>

          <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Каналы и кампании (ATTR_CHANNELS)</h3>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-2">Source / Medium</th>
                        <th className="px-2 py-2">Сессии</th>
                        <th className="px-2 py-2">События</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topChannels.map((row) => (
                        <tr key={`${row.source}_${row.medium}`} className="border-b border-slate-100">
                          <td className="px-2 py-2">{row.source}/{row.medium}</td>
                          <td className="px-2 py-2">{fmtNumber(row.sessions)}</td>
                          <td className="px-2 py-2">{fmtNumber(row.events)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-2">Кампания</th>
                        <th className="px-2 py-2">Сессии</th>
                        <th className="px-2 py-2">События</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCampaigns.map((row) => (
                        <tr key={row.campaign} className="border-b border-slate-100">
                          <td className="px-2 py-2">{row.campaign}</td>
                          <td className="px-2 py-2">{fmtNumber(row.sessions)}</td>
                          <td className="px-2 py-2">{fmtNumber(row.events)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">События, страницы и рефереры (TOP_CONTENT)</h3>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">События (TOP_EVT)</div>
                  <div className="mt-2 space-y-1 text-sm">
                    {topEvents.slice(0, 8).map((row) => (
                      <div key={row.event_type} className="flex justify-between gap-2"><span className="truncate">{row.event_type}</span><b>{fmtNumber(row.events)}</b></div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">Страницы (TOP_SRC)</div>
                  <div className="mt-2 space-y-1 text-sm">
                    {topSources.slice(0, 8).map((row) => (
                      <div key={row.source_path} className="flex justify-between gap-2"><span className="truncate">{row.source_path}</span><b>{fmtNumber(row.events)}</b></div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">Рефереры (TOP_REF)</div>
                  <div className="mt-2 space-y-1 text-sm">
                    {topReferrers.slice(0, 8).map((row) => (
                      <div key={row.referrer} className="flex justify-between gap-2"><span className="truncate">{row.referrer || 'direct'}</span><b>{fmtNumber(row.events)}</b></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border border-slate-200 bg-white p-4 md:p-5 ${viewMode === 'cto' ? '' : 'hidden'}`}>
          <h2 className="text-lg font-bold text-slate-900">Техническая устойчивость и риски (TECH_GUARD)</h2>
          <p className="mt-1 text-sm text-slate-600">Проверка влияния производительности и ошибок на конверсию: web-vitals, API, аномалии и риск оттока.</p>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard title="LCP p75" code="WEB_LCP" value={`${fmtNumber(data?.performance?.webVitals?.lcpP75)} ms`} />
            <KpiCard title="INP p75" code="WEB_INP" value={`${fmtNumber(data?.performance?.webVitals?.inpP75)} ms`} />
            <KpiCard title="CLS p75" code="WEB_CLS" value={fmtNumber(data?.performance?.webVitals?.clsP75)} />
            <KpiCard title="API p95" code="API_P95" value={`${fmtNumber(data?.performance?.apiLatency?.p95Ms)} ms`} />
            <KpiCard title="Ошибки API" code="API_ERR" value={fmtPct(data?.performance?.apiLatency?.errorRatePct)} />
            <KpiCard title="Guardrails" code="GR_STATE" value={data?.guardrails?.degraded ? 'DEGRADED' : 'OK'} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Производительность по этапам (STAGE_PERF)</h3>
              <div className="mt-2 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Этап</th>
                      <th className="px-2 py-2">LCP p75</th>
                      <th className="px-2 py-2">INP p75</th>
                      <th className="px-2 py-2">API p95</th>
                      <th className="px-2 py-2">API err</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageBreakdown.map(([stage, row]) => (
                      <tr key={stage} className="border-b border-slate-100">
                        <td className="px-2 py-2">{stage}</td>
                        <td className="px-2 py-2">{fmtNumber(row.webVitals?.lcpP75)}</td>
                        <td className="px-2 py-2">{fmtNumber(row.webVitals?.inpP75)}</td>
                        <td className="px-2 py-2">{fmtNumber(row.apiLatency?.p95Ms)}</td>
                        <td className="px-2 py-2">{fmtPct(row.apiLatency?.errorRatePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Аномалии и риск оттока (ANOM_CHURN)</h3>
              <div className="mt-2 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">Аномалии (ANOM_FEED)</div>
                  {(data?.anomalies || []).length === 0 ? (
                    <div className="mt-1 text-sm text-slate-500">Активных аномалий нет.</div>
                  ) : (
                    <div className="mt-2 space-y-1 text-sm">
                      {(data?.anomalies || []).slice(0, 6).map((row) => (
                        <div key={row.anomalyKey} className="flex items-start justify-between gap-2">
                          <span className="truncate">{row.metricName}</span>
                          <span className="text-red-600">{fmtPct(row.deltaPct)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">Риск оттока (CHURN)</div>
                  <div className="mt-1 text-sm text-slate-700">
                    High: <b>{fmtNumber(data?.churn?.summary?.highRisk)}</b> ({fmtPct(data?.churn?.summary?.highRiskPct)}) | Medium: <b>{fmtNumber(data?.churn?.summary?.mediumRisk)}</b> | Low: <b>{fmtNumber(data?.churn?.summary?.lowRisk)}</b>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    {(data?.churn?.topReasons || []).slice(0, 5).map((row) => (
                      <div key={row.reason} className="flex justify-between gap-2"><span className="truncate">{row.reason}</span><b>{fmtNumber(row.count)}</b></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-bold text-slate-900">Факты по последним сессиям (SESSION_FACTS)</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
              <KpiCard title="Сессии" code="SES" value={fmtNumber(data?.sessionFacts?.sessions)} />
              <KpiCard title="Доля checkout" code="SES_CHK_RATE" value={fmtPct(data?.sessionFacts?.checkoutAttemptRatePct)} />
              <KpiCard title="Доля броней" code="SES_BOOK_RATE" value={fmtPct(data?.sessionFacts?.bookingSuccessRatePct)} />
              <KpiCard title="Средняя длина" code="SES_DUR_AVG" value={`${fmtNumber(data?.sessionFacts?.avgSessionDurationSec)} sec`} />
            </div>

            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Session</th>
                    <th className="px-2 py-2">Последний путь</th>
                    <th className="px-2 py-2">ATC</th>
                    <th className="px-2 py-2">Checkout</th>
                    <th className="px-2 py-2">Success</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionRows.map((row) => {
                    const sessionId = String(row.sessionId || row.session_id || '-')
                    const path = String(row.lastSourcePath || row.last_source_path || '-')
                    return (
                      <tr key={sessionId} className="border-b border-slate-100">
                        <td className="px-2 py-2">{sessionId}</td>
                        <td className="px-2 py-2">{path}</td>
                        <td className="px-2 py-2">{fmtNumber(row.addToCart || row.add_to_cart || 0)}</td>
                        <td className="px-2 py-2">{fmtNumber(row.checkoutStarts || row.checkout_starts || 0)}</td>
                        <td className="px-2 py-2">{fmtNumber(row.bookingSuccess || row.booking_success || 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-lg font-bold text-slate-900">Профили клиентов и рекомендации (PROFILE_AI)</h2>
          <p className="mt-1 text-sm text-slate-600">Показывает качество персонализации: сшивка идентичности, feature store и топ-модели, где есть конверсионный сигнал.</p>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <KpiCard title="Людей в сшивке" code="ID_PERSONS" value={fmtNumber(data?.identity?.persons)} />
            <KpiCard title="Связано с user" code="ID_USERS" value={fmtNumber(data?.identity?.linkedUserNodes)} />
            <KpiCard title="Профилей в store" code="FS_PROFILES" value={fmtNumber(data?.featureStore?.totalProfiles)} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Кластеры бюджета (FS_BUDGET_CLUSTER)</h3>
              <div className="mt-2 space-y-1 text-sm">
                {(data?.featureStore?.byBudgetCluster || []).map((row) => (
                  <div key={row.budgetCluster} className="flex justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
                    <span>{row.budgetCluster}</span>
                    <b>{fmtNumber(row.profiles)}</b>
                  </div>
                ))}
              </div>

              <h3 className="mt-4 text-sm font-bold text-slate-900">Топ дисциплины/бренды (PROFILE_TOP)</h3>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 text-sm">
                <div className="rounded-md border border-slate-200 p-2">
                  <div className="text-xs uppercase text-slate-500">Дисциплины</div>
                  {(data?.profiles?.topDisciplines || []).slice(0, 5).map((row) => (
                    <div key={row.key} className="mt-1 flex justify-between"><span>{row.key}</span><b>{fmtNumber(row.score)}</b></div>
                  ))}
                </div>
                <div className="rounded-md border border-slate-200 p-2">
                  <div className="text-xs uppercase text-slate-500">Бренды</div>
                  {(data?.profiles?.topBrands || []).slice(0, 5).map((row) => (
                    <div key={row.key} className="mt-1 flex justify-between"><span>{row.key}</span><b>{fmtNumber(row.score)}</b></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Профили с максимальным intent (PROFILE_TOP_ROWS)</h3>
              <div className="mt-2 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Профиль</th>
                      <th className="px-2 py-2">Intent</th>
                      <th className="px-2 py-2">Дисциплина</th>
                      <th className="px-2 py-2">Бренд</th>
                      <th className="px-2 py-2">EUR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.profiles?.topProfiles || []).slice(0, 8).map((row) => (
                      <tr key={row.profile_key} className="border-b border-slate-100">
                        <td className="px-2 py-2">{row.profile_key}</td>
                        <td className="px-2 py-2">{fmtNumber(row.intent_score)}</td>
                        <td className="px-2 py-2">{row.top_discipline || '-'}</td>
                        <td className="px-2 py-2">{row.top_brand || '-'}</td>
                        <td className="px-2 py-2">{fmtNumber(row.weighted_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-bold text-slate-900">Велосипеды с сильным конверсионным сигналом (TOP_BIKES_SIGNAL)</h3>
            <div className="mt-2 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Bike</th>
                    <th className="px-2 py-2">Detail</th>
                    <th className="px-2 py-2">ATC</th>
                    <th className="px-2 py-2">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topBikes || []).slice(0, 10).map((bike) => (
                    <tr key={bike.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">#{bike.id} {bike.brand || ''} {bike.model || ''}</td>
                      <td className="px-2 py-2">{fmtNumber(bike.detail_open)}</td>
                      <td className="px-2 py-2">{fmtNumber(bike.add_to_cart)}</td>
                      <td className="px-2 py-2">{fmtNumber(bike.order)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border border-slate-200 bg-white p-4 md:p-5 ${viewMode === 'cto' ? '' : 'hidden'}`}>
          <h2 className="text-lg font-bold text-slate-900">Эксперименты и автооптимизация (EXP_ENGINE)</h2>
          <p className="mt-1 text-sm text-slate-600">Управление A/B и bandit логикой: запуск проверок, симуляции и применение оптимизаций с guardrail-контролем.</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold" onClick={() => void refreshInsights(false)} disabled={busy !== null}>
              {busy === 'insights' ? 'Обновление...' : 'Обновить инсайты (INS_REFRESH)'}
            </button>
            <button className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700" onClick={() => void optimize(true)} disabled={busy !== null}>
              {busy === 'dryrun' ? 'Расчёт...' : 'Симуляция оптимизации (EXP_DRYRUN)'}
            </button>
            <button className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => void optimize(false)} disabled={busy !== null}>
              {busy === 'apply' ? 'Применение...' : 'Применить оптимизацию (EXP_APPLY)'}
            </button>
            <button className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700" onClick={() => void runAnomalyScan()} disabled={busy !== null}>
              {busy === 'anomaly' ? 'Скан...' : 'Скан аномалий (ANOM_SCAN)'}
            </button>
            <button className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700" onClick={() => void runDailyDigest()} disabled={busy !== null}>
              {busy === 'digest' ? 'Digest...' : 'Дневной digest (ANOM_DAILY)'}
            </button>
            <button className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700" onClick={() => void runContractCheck()} disabled={busy !== null}>
              {busy === 'contract' ? 'Проверка...' : 'Контракт воронки (CONTRACT_CHECK)'}
            </button>
            <button className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-700" onClick={() => void runReplay('causal_best')} disabled={busy !== null}>
              {busy === 'replay_causal_best' ? 'Replay...' : 'Replay causal (REPLAY_CAUSAL)'}
            </button>
            <button className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-3 py-2 text-sm font-semibold text-fuchsia-700" onClick={() => void runReplay('bandit_mean')} disabled={busy !== null}>
              {busy === 'replay_bandit_mean' ? 'Replay...' : 'Replay bandit (REPLAY_BANDIT)'}
            </button>
            <button className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700" onClick={() => void runDemoSeed()} disabled={busy !== null}>
              {busy === 'demo_seed' ? 'Генерация...' : 'Сгенерировать демо 1000 (DEMO_SEED)'}
            </button>
          </div>

          <div className="mt-3 text-sm text-slate-600">
            Последний авто-прогон: {fmtDate(data?.autoOptimization?.metrics_auto_optimize_last_run?.value)}
          </div>

          <div className="mt-2 text-sm text-slate-600">
            SRM alerts: <b>{fmtNumber(data?.experiments?.diagnostics?.srmAlerts)}</b> | AA suspicious: <b>{fmtNumber(data?.experiments?.diagnostics?.aaSuspicious)}</b> | DR signals: <b>{fmtNumber(data?.experiments?.diagnostics?.segmentedSignals)}</b>
          </div>

          <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Эксперимент</th>
                  <th className="px-2 py-2">Вариант</th>
                  <th className="px-2 py-2">Вес</th>
                  <th className="px-2 py-2">Назначений</th>
                  <th className="px-2 py-2">Conversion</th>
                  <th className="px-2 py-2">Order rate</th>
                  <th className="px-2 py-2">Uplift vs control</th>
                  <th className="px-2 py-2">Causal uplift</th>
                </tr>
              </thead>
              <tbody>
                {experiments.flatMap((exp) => exp.variants.map((variant) => (
                  <tr key={`${exp.experimentKey}_${variant.variant}`} className="border-b border-slate-100">
                    <td className="px-2 py-2">{exp.name || exp.experimentKey}</td>
                    <td className="px-2 py-2">{variant.variant}</td>
                    <td className="px-2 py-2">{fmtPct(Number(variant.configuredWeight || 0) * 100)}</td>
                    <td className="px-2 py-2">{fmtNumber(variant.assignments)}</td>
                    <td className="px-2 py-2">{fmtPct(variant.conversionPct)}</td>
                    <td className="px-2 py-2">{fmtPct(variant.orderRatePct)}</td>
                    <td className="px-2 py-2">{fmtPct(variant.upliftVsControlPct)}</td>
                    <td className="px-2 py-2">{fmtPct(variant.causalUpliftPct)}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-bold text-slate-900">Replay simulation (REPLAY_RESULT)</h3>
            {replay?.success ? (
              <>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <KpiCard title="Стратегия" code="RPL_STRAT" value={String(replay.strategy || '-')} />
                  <KpiCard title="Эксперименты" code="RPL_EXP" value={fmtNumber(replay.portfolio?.experiments)} />
                  <KpiCard title="Assignments" code="RPL_ASN" value={fmtNumber(replay.portfolio?.assignments)} />
                  <KpiCard title="Portfolio uplift" code="RPL_UPLIFT" value={fmtPct(replay.portfolio?.weightedUpliftPct)} />
                </div>

                <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-2">Experiment</th>
                        <th className="px-2 py-2">Assignments</th>
                        <th className="px-2 py-2">Uplift</th>
                        <th className="px-2 py-2">Current Weights</th>
                        <th className="px-2 py-2">Scenario Weights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(replay.experiments || []).map((row) => (
                        <tr key={row.experimentKey} className="border-b border-slate-100 align-top">
                          <td className="px-2 py-2">{row.experimentKey}</td>
                          <td className="px-2 py-2">{fmtNumber(row.assignments)}</td>
                          <td className="px-2 py-2">{fmtPct(row.upliftPct)}</td>
                          <td className="px-2 py-2 text-xs">{JSON.stringify(row.currentWeights || {})}</td>
                          <td className="px-2 py-2 text-xs">{JSON.stringify(row.scenarioWeights || {})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-slate-500">Запусти Replay causal или Replay bandit, чтобы получить прогноз uplift до выката.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
