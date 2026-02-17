import * as React from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { adminGrowthApi, adminMetricsApi } from '@/api'
import { useAuth } from '@/lib/auth'

type GrowthOverview = {
  success?: boolean
  windowDays?: number
  windowPreset?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'all'
  windowBucket?: 'hour' | 'day' | 'week' | 'month'
  summary?: {
    sessions?: number
    orders?: number
    checkoutSessions?: number
    bookingSessions?: number
    orderRatePct?: number
    referralSessions?: number
    referralOrders?: number
    referralSharePct?: number
    referralOrderSharePct?: number
  }
  channels?: Array<{
    source: string
    medium: string
    sessions: number
    productSessions: number
    checkoutSessions: number
    orderSessions: number
    productPct: number
    checkoutPct: number
    orderPct: number
  }>
  trend?: Array<{
    day: string
    bucket?: string
    sessions: number
    orders: number
    checkoutSessions: number
    referralSessions: number
    referralOrders: number
  }>
  trendMeta?: {
    direction?: 'up' | 'down' | 'flat'
    scorePct?: number
    firstHalf?: number
    secondHalf?: number
    points?: number
  }
  topReferralLinks?: Array<{
    id: number
    slug: string
    channelName: string
    targetPath: string
    maskedUrl: string
    isActive: boolean
    stats?: {
      visits: number
      uniqueVisits: number
      sessions: number
      checkoutSessions: number
      bookingSessions: number
      orderSessions: number
      orderPct: number
    }
  }>
  landings?: Array<{
    landingPath: string
    sessions: number
    orderSessions: number
    orderPct: number
  }>
}

type ReferralStats = {
  visits?: number
  uniqueVisits?: number
  sessions?: number
  productSessions?: number
  addToCartSessions?: number
  checkoutSessions?: number
  bookingSessions?: number
  orderSessions?: number
  visitToSessionPct?: number
  productOpenPct?: number
  checkoutPct?: number
  bookingPct?: number
  orderPct?: number
}

type ReferralLink = {
  id: number
  slug: string
  channelName: string
  codeWord?: string
  creatorTag?: string
  targetPath: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmContent?: string
  isActive: boolean
  maskedUrl: string
  notes?: string
  createdAt?: string
  stats?: ReferralStats
}

type ReferralListResponse = {
  success?: boolean
  links?: ReferralLink[]
}

type CoreDeep = {
  success?: boolean
  lossPoints?: Array<{
    stageFrom: string
    stageTo: string
    from: number
    to: number
    conversionPct: number
    lossPct: number
  }>
  guardrails?: {
    cancelRatePct?: number
    refundRatePct?: number
    apiErrorRatePct?: number
    apiP95Ms?: number
    timeToBookingSecP75?: number
    degraded?: boolean
    reasons?: string[]
  }
  churn?: {
    topReasons?: Array<{ reason: string; count: number }>
    summary?: { highRisk?: number; highRiskPct?: number }
  }
  funnelContract?: {
    criticalPathOk?: boolean
    checks?: Array<{ eventType: string; status: string; coveragePct: number }>
  }
}

type CreateForm = {
  channelName: string
  codeWord: string
  slug: string
  targetPath: string
  utmSource: string
  utmMedium: string
  notes: string
}

type StagePoint = {
  key: string
  name: string
  code: string
  value: number
}

type WindowPreset = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'all'

const WINDOW_PRESET_OPTIONS: Array<{ key: WindowPreset; label: string; code: string }> = [
  { key: 'hourly', label: 'Почасовой', code: 'HOUR' },
  { key: 'daily', label: 'Дневной', code: 'DAY' },
  { key: 'weekly', label: 'Недельный', code: 'WEEK' },
  { key: 'monthly', label: 'Месячный', code: 'MONTH' },
  { key: 'all', label: 'За всё время', code: 'ALL' }
]

const WINDOW_PRESET_DAYS: Record<WindowPreset, number> = {
  hourly: 2,
  daily: 30,
  weekly: 182,
  monthly: 730,
  all: 3650
}

function fmtNum(value: unknown): string {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('ru-RU')
}

function fmtPct(value: unknown): string {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '0.00%'
  return `${n.toFixed(2)}%`
}

function fmtDate(value: unknown): string {
  if (!value) return '-'
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('ru-RU')
}

function stageName(value: string): string {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'sessions') return 'Сессии'
  if (normalized === 'catalog') return 'Каталог'
  if (normalized === 'product') return 'Карточка товара'
  if (normalized === 'add_to_cart') return 'Добавление в корзину'
  if (normalized === 'booking_success') return 'Успешная бронь'
  return normalized || '-'
}

function statusBadge(active: boolean): string {
  return active
    ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700'
    : 'rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600'
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

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
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

export default function AdminGrowthAttributionPage() {
  const { user } = useAuth()
  const [windowPreset, setWindowPreset] = React.useState<WindowPreset>('daily')
  const [loading, setLoading] = React.useState<boolean>(true)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string>('')
  const [notice, setNotice] = React.useState<string>('')
  const [overview, setOverview] = React.useState<GrowthOverview | null>(null)
  const [referrals, setReferrals] = React.useState<ReferralLink[]>([])
  const [coreDeep, setCoreDeep] = React.useState<CoreDeep | null>(null)
  const [createdLink, setCreatedLink] = React.useState<string>('')
  const [selectedLinkId, setSelectedLinkId] = React.useState<number | null>(null)
  const [search, setSearch] = React.useState<string>('')
  const [onlyActive, setOnlyActive] = React.useState<boolean>(false)
  const [form, setForm] = React.useState<CreateForm>({
    channelName: '',
    codeWord: '',
    slug: '',
    targetPath: '/',
    utmSource: 'creator',
    utmMedium: 'referral',
    notes: ''
  })

  const isAdmin = String(user?.role || '').toLowerCase() === 'admin'

  const load = React.useCallback(async (preset?: WindowPreset) => {
    const effectivePreset = preset ?? windowPreset
    const effectiveDays = WINDOW_PRESET_DAYS[effectivePreset]
    setLoading(true)
    setError('')
    try {
      const [ov, rf, core] = await Promise.all([
        adminGrowthApi.getOverview({ windowDays: effectiveDays, windowPreset: effectivePreset }),
        adminGrowthApi.listReferrals({ windowDays: effectiveDays, windowPreset: effectivePreset, limit: 500, offset: 0 }),
        adminMetricsApi.getCoreOverview({ windowHours: effectiveDays * 24, windowPreset: effectivePreset })
      ])

      if (!ov?.success) {
        setError(String((ov as { error?: string })?.error || 'Не удалось загрузить сводку роста'))
        setOverview(null)
      } else {
        setOverview(ov as GrowthOverview)
      }

      const list = Array.isArray((rf as ReferralListResponse)?.links) ? ((rf as ReferralListResponse).links || []) : []
      setReferrals(list)
      setCoreDeep((core as CoreDeep) || null)
      setSelectedLinkId((prev) => {
        if (!list.length) return null
        if (prev && list.some((row) => row.id === prev)) return prev
        return list[0].id
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Network error'
      setError(String(message))
      setOverview(null)
      setReferrals([])
      setSelectedLinkId(null)
    } finally {
      setLoading(false)
    }
  }, [windowPreset])

  React.useEffect(() => {
    if (isAdmin) {
      void load()
    }
  }, [isAdmin, load])

  const createReferral = async () => {
    setBusy('create')
    setNotice('')
    setCreatedLink('')
    try {
      const res = await adminGrowthApi.createReferral({
        channelName: form.channelName,
        codeWord: form.codeWord || undefined,
        slug: form.slug || undefined,
        targetPath: form.targetPath || '/',
        utmSource: form.utmSource || 'creator',
        utmMedium: form.utmMedium || 'referral',
        notes: form.notes || undefined
      })
      if (!res?.success) {
        setNotice(String((res as { error?: string })?.error || 'Ошибка создания партнёрской ссылки'))
      } else {
        const masked = String((res as { link?: { maskedUrl?: string } })?.link?.maskedUrl || '')
        setCreatedLink(masked)
        setNotice(masked ? 'Ссылка создана и готова к использованию.' : 'Ссылка создана.')
        if (masked) {
          const copied = await copyText(masked)
          if (copied) setNotice('Ссылка создана и скопирована в буфер обмена.')
        }
        setForm((prev) => ({ ...prev, channelName: '', codeWord: '', slug: '', notes: '' }))
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const toggleReferral = async (id: number, isActive: boolean) => {
    setBusy(`toggle:${id}`)
    try {
      const res = await adminGrowthApi.updateReferral(id, { isActive: !isActive })
      if (!res?.success) {
        setNotice(String((res as { error?: string })?.error || 'Не удалось обновить статус ссылки'))
      } else {
        setNotice(!isActive ? 'Ссылка активирована.' : 'Ссылка остановлена.')
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const copyLink = async (maskedUrl: string) => {
    const ok = await copyText(maskedUrl)
    setNotice(ok ? 'Ссылка скопирована.' : 'Не удалось скопировать ссылку.')
  }

  const trend = overview?.trend || []
  const channelRows = (overview?.channels || []).slice(0, 12)
  const landings = (overview?.landings || []).slice(0, 12)

  const filteredReferrals = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return referrals
      .filter((row) => !onlyActive || row.isActive)
      .filter((row) => {
        if (!query) return true
        return [row.channelName, row.slug, row.codeWord, row.maskedUrl, row.targetPath]
          .map((v) => String(v || '').toLowerCase())
          .some((v) => v.includes(query))
      })
      .sort((a, b) => Number(b.stats?.orderSessions || 0) - Number(a.stats?.orderSessions || 0))
  }, [referrals, search, onlyActive])

  const selectedLink = React.useMemo(
    () => referrals.find((row) => row.id === selectedLinkId) || null,
    [referrals, selectedLinkId]
  )

  const selectedStats = selectedLink?.stats || {}
  const stages: StagePoint[] = [
    { key: 'visits', name: 'Переходы', code: 'REF_VIS', value: Number(selectedStats.visits || 0) },
    { key: 'sessions', name: 'Сессии', code: 'REF_SES', value: Number(selectedStats.sessions || 0) },
    { key: 'product', name: 'Открытия карточек', code: 'REF_PROD', value: Number(selectedStats.productSessions || 0) },
    { key: 'add_to_cart', name: 'Добавили в корзину', code: 'REF_ATC', value: Number(selectedStats.addToCartSessions || 0) },
    { key: 'checkout', name: 'Начали checkout', code: 'REF_CHK', value: Number(selectedStats.checkoutSessions || 0) },
    { key: 'booking', name: 'Успешная бронь', code: 'REF_BKG', value: Number(selectedStats.bookingSessions || 0) },
    { key: 'orders', name: 'Заказы', code: 'REF_ORD', value: Number(selectedStats.orderSessions || 0) }
  ]

  const stageConversions = stages.slice(0, -1).map((from, idx) => {
    const to = stages[idx + 1]
    const conversion = from.value > 0 ? (to.value / from.value) * 100 : 0
    return {
      key: `${from.key}_${to.key}`,
      from: from.name,
      to: to.name,
      fromCode: from.code,
      toCode: to.code,
      conversion,
      loss: Math.max(0, 100 - conversion)
    }
  })

  const importantAlerts = React.useMemo(() => {
    const alerts: Array<{ key: string; severity: 'critical' | 'warning' | 'info'; text: string }> = []
    if (!coreDeep?.funnelContract?.criticalPathOk) {
      alerts.push({
        key: 'contract',
        severity: 'critical',
        text: 'Критический путь воронки нарушен. Проверьте события page → product → checkout → booking.'
      })
    }
    if (Number(coreDeep?.guardrails?.apiErrorRatePct || 0) > 3) {
      alerts.push({
        key: 'api_err',
        severity: 'warning',
        text: `Рост API ошибок: ${fmtPct(coreDeep?.guardrails?.apiErrorRatePct)}`
      })
    }
    if (Number(overview?.summary?.orderRatePct || 0) < 2 && Number(overview?.summary?.sessions || 0) > 100) {
      alerts.push({
        key: 'low_cr',
        severity: 'warning',
        text: `Низкая конверсия в заказ: ${fmtPct(overview?.summary?.orderRatePct)}`
      })
    }
    if ((coreDeep?.churn?.topReasons || []).length > 0) {
      alerts.push({
        key: 'churn',
        severity: 'warning',
        text: `Топ риск оттока: ${String(coreDeep?.churn?.topReasons?.[0]?.reason || 'unknown')}`
      })
    }
    if (alerts.length === 0) {
      alerts.push({
        key: 'ok',
        severity: 'info',
        text: 'Критических сигналов по каналам и ссылкам не обнаружено.'
      })
    }
    return alerts.slice(0, 4)
  }, [coreDeep, overview])

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-slate-900">Центр роста партнёрских каналов</h1>
          <p className="mt-2 text-sm text-slate-600">Доступ только для роли admin.</p>
        </div>
      </div>
    )
  }

  const showTrendChart = !loading && trend.length > 0
  const showChannelChart = !loading && channelRows.length > 0

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eff6ff_35%,#f8fafc_100%)] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Центр роста и партнёрских ссылок (GROWTH_CTRL)</h1>
              <p className="mt-1 text-sm text-slate-600">Здесь видно, какие каналы и какие конкретно ссылки приводят прибыль, а где теряется конверсия.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Назад в Admin</Link>
              <Link to="/admin/metrics-core" className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">Центр метрик</Link>
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
          {!!createdLink && (
            <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              Новая ссылка: <a className="font-semibold underline" href={createdLink} target="_blank" rel="noreferrer">{createdLink}</a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Общий тренд (TREND_GLOBAL)</div>
            <div className={`mt-1 text-2xl font-black ${trendDirectionClass(String(overview?.trendMeta?.direction || 'flat'))}`}>
              {trendDirectionLabel(String(overview?.trendMeta?.direction || 'flat'))}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Дельта: {fmtPct(overview?.trendMeta?.scorePct)} | Точек: {fmtNum(overview?.trendMeta?.points)}
            </div>
          </div>
          <KpiCard title="Сессии" code="SES" value={fmtNum(overview?.summary?.sessions)} />
          <KpiCard title="Заказы" code="ORD" value={fmtNum(overview?.summary?.orders)} hint={`CR: ${fmtPct(overview?.summary?.orderRatePct)}`} />
          <KpiCard title="Сессии с checkout" code="SES_CHK" value={fmtNum(overview?.summary?.checkoutSessions)} />
          <KpiCard title="Сессии с бронью" code="SES_BKG" value={fmtNum(overview?.summary?.bookingSessions)} />
          <KpiCard title="Партнёрские сессии" code="REF_SES" value={fmtNum(overview?.summary?.referralSessions)} hint={`Доля трафика: ${fmtPct(overview?.summary?.referralSharePct)}`} />
          <KpiCard title="Партнёрские заказы" code="REF_ORD" value={fmtNum(overview?.summary?.referralOrders)} hint={`Доля заказов: ${fmtPct(overview?.summary?.referralOrderSharePct)}`} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-lg font-bold text-slate-900">Важные уведомления (ALERT_CENTER)</h2>
          <p className="mt-1 text-sm text-slate-600">Сигналы, которые чаще всего влияют на выручку и качество лидов.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {importantAlerts.map((alert) => (
              <div
                key={alert.key}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  alert.severity === 'critical'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : alert.severity === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {alert.text}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 xl:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">Динамика спроса и заказов (TREND_DAILY)</h2>
            <p className="mt-1 text-sm text-slate-600">График показывает, как меняются сессии и заказы по дням, включая вклад партнёрского трафика.</p>
            <div className="mt-3 h-72">
              {showTrendChart ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sessions" stroke="#1d4ed8" strokeWidth={2} name="Сессии (SES)" />
                    <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2} name="Заказы (ORD)" />
                    <Line type="monotone" dataKey="referralSessions" stroke="#0f766e" strokeWidth={2} name="Партнёрские сессии (REF_SES)" />
                    <Line type="monotone" dataKey="referralOrders" stroke="#dc2626" strokeWidth={2} name="Партнёрские заказы (REF_ORD)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  Недостаточно данных для графика в выбранном окне.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <h2 className="text-lg font-bold text-slate-900">Точки входа на сайт (LANDING_TOP)</h2>
            <p className="mt-1 text-sm text-slate-600">Какие страницы чаще всего становятся стартом сессии и что они дают по заказам.</p>
            <div className="mt-3 space-y-2">
              {landings.map((row, idx) => (
                <div key={`${row.landingPath}_${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="truncate font-semibold text-slate-900">{row.landingPath}</div>
                  <div className="mt-1 text-xs text-slate-600">Сессии (SES): <b>{fmtNum(row.sessions)}</b> | Заказы (ORD): <b>{fmtNum(row.orderSessions)}</b> | CR (CR_ORD): <b>{fmtPct(row.orderPct)}</b></div>
                </div>
              ))}
              {landings.length === 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Пока нет данных по точкам входа.</div>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <h2 className="text-lg font-bold text-slate-900">Качество каналов трафика (CHANNEL_QUALITY)</h2>
            <p className="mt-1 text-sm text-slate-600">Сравнение каналов: кто приводит посетителей, кто доводит до checkout и кто закрывает заказ.</p>
            <div className="mt-3 h-64">
              {showChannelChart ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
                  <BarChart data={channelRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="sessions" fill="#1d4ed8" name="Сессии (SES)" />
                    <Bar dataKey="orderSessions" fill="#0f766e" name="Заказы (ORD)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  Недостаточно данных для графика каналов.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <h2 className="text-lg font-bold text-slate-900">Таблица каналов (CHANNEL_TABLE)</h2>
            <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Источник</th>
                    <th className="px-2 py-2">Сессии (SES)</th>
                    <th className="px-2 py-2">Карточка (CR_PROD)</th>
                    <th className="px-2 py-2">Checkout (CR_CHK)</th>
                    <th className="px-2 py-2">Заказ (CR_ORD)</th>
                  </tr>
                </thead>
                <tbody>
                  {channelRows.map((row) => (
                    <tr key={`${row.source}_${row.medium}`} className="border-b border-slate-100">
                      <td className="px-2 py-2">
                        <div className="font-semibold text-slate-800">{row.source || 'direct'}</div>
                        <div className="text-xs text-slate-500">{row.medium || 'none'}</div>
                      </td>
                      <td className="px-2 py-2">{fmtNum(row.sessions)}</td>
                      <td className="px-2 py-2">{fmtPct(row.productPct)}</td>
                      <td className="px-2 py-2">{fmtPct(row.checkoutPct)}</td>
                      <td className="px-2 py-2">{fmtPct(row.orderPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-lg font-bold text-slate-900">Генератор партнёрской ссылки (REF_LINK_GEN)</h2>
          <p className="mt-1 text-sm text-slate-600">Создаёт ссылку вида `/go/slug`: клиент попадает на нужную страницу, а весь путь сохраняется в статистике.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Название канала / креатора" value={form.channelName} onChange={(e) => setForm((s) => ({ ...s, channelName: e.target.value }))} />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Кодовое слово (опц.)" value={form.codeWord} onChange={(e) => setForm((s) => ({ ...s, codeWord: e.target.value }))} />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Slug (опц., автогенерация если пусто)" value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Куда вести (например / или /catalog)" value={form.targetPath} onChange={(e) => setForm((s) => ({ ...s, targetPath: e.target.value }))} />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="utm_source" value={form.utmSource} onChange={(e) => setForm((s) => ({ ...s, utmSource: e.target.value }))} />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="utm_medium" value={form.utmMedium} onChange={(e) => setForm((s) => ({ ...s, utmMedium: e.target.value }))} />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Комментарий для команды (опц.)" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
            <button
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void createReferral()}
              disabled={busy === 'create' || !form.channelName.trim()}
            >
              {busy === 'create' ? 'Создание...' : 'Создать ссылку'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-bold text-slate-900">Реестр ссылок и выбор дашборда (REF_LINK_REG)</h2>
            <div className="flex flex-wrap gap-2">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Поиск по каналу, slug, URL"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
                Только активные
              </label>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Канал / slug</th>
                  <th className="px-2 py-2">Ссылка</th>
                  <th className="px-2 py-2">Переходы (REF_VIS)</th>
                  <th className="px-2 py-2">Сессии (REF_SES)</th>
                  <th className="px-2 py-2">Checkout (REF_CHK)</th>
                  <th className="px-2 py-2">Заказы (REF_ORD)</th>
                  <th className="px-2 py-2">CR заказа (REF_CR_ORD)</th>
                  <th className="px-2 py-2">Статус</th>
                  <th className="px-2 py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 ${selectedLinkId === row.id ? 'bg-indigo-50/60' : 'bg-white'}`}
                  >
                    <td className="px-2 py-2">
                      <div className="font-semibold text-slate-900">{row.channelName || '-'}</div>
                      <div className="text-xs text-slate-500">{row.slug}</div>
                    </td>
                    <td className="px-2 py-2">
                      <a className="max-w-[260px] truncate text-xs text-indigo-700 underline block" href={row.maskedUrl} target="_blank" rel="noreferrer">{row.maskedUrl}</a>
                      <div className="text-[11px] text-slate-500">{row.targetPath}</div>
                    </td>
                    <td className="px-2 py-2">{fmtNum(row.stats?.visits)}</td>
                    <td className="px-2 py-2">{fmtNum(row.stats?.sessions)}</td>
                    <td className="px-2 py-2">{fmtNum(row.stats?.checkoutSessions)}</td>
                    <td className="px-2 py-2">{fmtNum(row.stats?.orderSessions)}</td>
                    <td className="px-2 py-2">{fmtPct(row.stats?.orderPct)}</td>
                    <td className="px-2 py-2"><span className={statusBadge(Boolean(row.isActive))}>{row.isActive ? 'Активна' : 'Пауза'}</span></td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button className="rounded-md border border-slate-300 px-2 py-1 text-xs" onClick={() => setSelectedLinkId(row.id)}>Дашборд</button>
                        <button className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700" onClick={() => void copyLink(row.maskedUrl)}>Копия</button>
                        <button
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                          onClick={() => void toggleReferral(row.id, row.isActive)}
                          disabled={busy === `toggle:${row.id}`}
                        >
                          {busy === `toggle:${row.id}` ? '...' : row.isActive ? 'Стоп' : 'Старт'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredReferrals.length === 0 && (
                  <tr>
                    <td className="px-2 py-6 text-center text-sm text-slate-500" colSpan={9}>Ссылки по текущим фильтрам не найдены.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-lg font-bold text-slate-900">Дашборд выбранной ссылки (REF_LINK_DASH)</h2>
          {!selectedLink ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Выберите ссылку в реестре выше, чтобы увидеть детальную аналитику.</div>
          ) : (
            <>
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{selectedLink.channelName} ({selectedLink.slug})</div>
                    <div className="text-xs text-slate-600">Создана: {fmtDate(selectedLink.createdAt)} | Цель: {selectedLink.targetPath || '/'}</div>
                  </div>
                  <div className="text-xs text-slate-600">{selectedLink.utmSource}/{selectedLink.utmMedium}/{selectedLink.utmCampaign}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-7">
                {stages.map((stage) => (
                  <KpiCard key={stage.key} title={stage.name} code={stage.code} value={fmtNum(stage.value)} />
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3">
                  <h3 className="text-sm font-bold text-slate-900">Форма воронки по ссылке (REF_FUNNEL)</h3>
                  <div className="mt-3 h-64">
                    <ResponsiveContainer width="100%" height="100%" minWidth={260} minHeight={220}>
                      <BarChart data={stages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="code" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#2563eb" name="События" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <h3 className="text-sm font-bold text-slate-900">Переходы и потери между шагами (REF_STEP_LOSS)</h3>
                  <div className="mt-3 overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-2 py-2">Переход</th>
                          <th className="px-2 py-2">Из</th>
                          <th className="px-2 py-2">В</th>
                          <th className="px-2 py-2">CR</th>
                          <th className="px-2 py-2">Потери</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stageConversions.map((row) => (
                          <tr key={row.key} className="border-b border-slate-100">
                            <td className="px-2 py-2 text-slate-700">{row.fromCode} → {row.toCode}</td>
                            <td className="px-2 py-2">{row.from}</td>
                            <td className="px-2 py-2">{row.to}</td>
                            <td className="px-2 py-2 font-semibold text-slate-900">{fmtPct(row.conversion)}</td>
                            <td className="px-2 py-2 text-red-600">{fmtPct(row.loss)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-lg font-bold text-slate-900">Системные риски конверсии (SYS_RISK)</h2>
          <p className="mt-1 text-sm text-slate-600">Блок контролирует общую устойчивость воронки и подсказывает, где бизнес теряет клиентов на уровне всей платформы.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <KpiCard title="Критический путь" code="FUNNEL_CONTRACT" value={coreDeep?.funnelContract?.criticalPathOk ? 'OK' : 'DEGRADED'} />
            <KpiCard title="Высокий риск оттока" code="CHURN_HIGH" value={fmtNum(coreDeep?.churn?.summary?.highRisk)} hint={`Доля: ${fmtPct(coreDeep?.churn?.summary?.highRiskPct)}`} />
            <KpiCard title="Ошибки API" code="API_ERR" value={fmtPct(coreDeep?.guardrails?.apiErrorRatePct)} hint={`P95: ${fmtNum(coreDeep?.guardrails?.apiP95Ms)} ms`} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Потери по этапам платформы (LOSS_POINTS)</h3>
              <div className="mt-2 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Переход</th>
                      <th className="px-2 py-2">Конверсия</th>
                      <th className="px-2 py-2">Потери</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(coreDeep?.lossPoints || []).slice(0, 8).map((row) => (
                      <tr key={`${row.stageFrom}_${row.stageTo}`} className="border-b border-slate-100">
                        <td className="px-2 py-2">{stageName(row.stageFrom)} → {stageName(row.stageTo)}</td>
                        <td className="px-2 py-2">{fmtPct(row.conversionPct)}</td>
                        <td className="px-2 py-2 text-red-600">{fmtPct(row.lossPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">Причины риска оттока (CHURN_REASONS)</h3>
              <div className="mt-2 space-y-2">
                {(coreDeep?.churn?.topReasons || []).slice(0, 8).map((row) => (
                  <div key={row.reason} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <div className="font-semibold text-slate-800">{row.reason}</div>
                    <div className="text-xs text-slate-500">Сессий: {fmtNum(row.count)}</div>
                  </div>
                ))}
                {(coreDeep?.churn?.topReasons || []).length === 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Активных риск-факторов не найдено.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
