import { createMetricsEventId, getMetricsSessionId } from '@/lib/session'
import { getAttributionHeaders, getAttributionMetadata } from '@/lib/traffic'

// Базовая точка для HTTP-запросов фронта
export const API_BASE = import.meta.env.PROD
  ? '/api'
  : ((import.meta.env?.VITE_API_URL as string) || '/api')

// Формирует абсолютный URL для изображений, если пришёл относительный путь
export function resolveImageUrl(path: unknown): string | null {
  if (path == null) return null
  if (typeof path !== 'string') {
    if (Array.isArray(path)) {
      path = path.length ? path[0] : null
    } else if (typeof path === 'object') {
      path = path.image_url || path.url || path.src || null
    } else {
      path = String(path)
    }
  }

  const p = (path || '').trim()
  if (!p || p.includes('[object Promise]')) return null
  const baseNoApi = API_BASE.replace('/api', '')

  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p)
      const host = u.hostname.toLowerCase()

      // Keep ImageKit direct for CDN performance.
      if (host === 'ik.imagekit.io' || host.endsWith('.imagekit.io')) return p

      // Legacy localhost paths should stay local in dev.
      if (host === 'localhost' || host === '127.0.0.1') {
        return `${baseNoApi}${u.pathname}${u.search}`
      }

      // Backend proxy accepts https only.
      if (u.protocol === 'http:') u.protocol = 'https:'
      return `${baseNoApi}/api/image-proxy?url=${encodeURIComponent(u.toString())}`
    } catch {
      return p
    }
  }

  const normalized = p.startsWith('/') ? p : `/${p}`
  return `${baseNoApi}${normalized}`
}

function getToken(): string | null {
  try {
    return localStorage.getItem('authToken')
  } catch {
    return null
  }
}

function getTelegramInitData(): string | null {
  try {
    // @ts-expect-error Telegram WebApp is injected at runtime.
    return window.Telegram?.WebApp?.initData || null;
  } catch {
    return null;
  }
}

function getSourcePath(): string | null {
  try {
    return typeof location !== 'undefined' ? (location.pathname || null) : null
  } catch {
    return null
  }
}

const CRM_LEAD_STORAGE_KEY = 'metrics_crm_lead_id_v1'

function getCrmLeadId(): string | null {
  try {
    const value = localStorage.getItem(CRM_LEAD_STORAGE_KEY)
    if (!value) return null
    return String(value).trim().slice(0, 128) || null
  } catch {
    return null
  }
}

function setCrmLeadId(value: unknown) {
  try {
    const clean = String(value || '').trim().slice(0, 128)
    if (!clean) return
    localStorage.setItem(CRM_LEAD_STORAGE_KEY, clean)
  } catch {
    void 0
  }
}

function stageFromPath(path: string): string {
  const value = String(path || '').toLowerCase()
  if (value.includes('/catalog')) return 'catalog'
  if (value.includes('/product') || value.includes('/bike/')) return 'product'
  if (value.includes('/checkout') || value.includes('/guest-order') || value.includes('/booking-checkout')) return 'checkout'
  if (value.includes('/booking') || value.includes('/order-tracking')) return 'booking'
  return 'other'
}

function maybeCaptureLeadId(path: string, payload: unknown) {
  if (!path.includes('/crm/')) return
  if (!payload || typeof payload !== 'object') return
  const data = payload as Record<string, unknown>
  const lead = data.lead_id ?? data.leadId
  if (lead != null) setCrmLeadId(lead)
}

const API_LATENCY_SAMPLE_RATE = (() => {
  const parsed = Number((import.meta.env?.VITE_API_LATENCY_SAMPLE_RATE as string) || '0.35')
  if (!Number.isFinite(parsed)) return 0.35
  return Math.max(0, Math.min(1, parsed))
})()

function normalizeMetricPath(path: string): string {
  const p = String(path || '').trim()
  if (!p) return '/'
  try {
    const withoutHash = p.split('#')[0]
    const withoutQuery = withoutHash.split('?')[0]
    return withoutQuery || '/'
  } catch {
    return p
  }
}

function shouldCaptureLatency(path: string, status: number, networkError: boolean): boolean {
  const normalizedPath = normalizeMetricPath(path)
  if (normalizedPath === '/metrics/events') return false
  if (networkError) return true
  if (status >= 400) return true
  if (normalizedPath.startsWith('/admin/')) return true
  return Math.random() < API_LATENCY_SAMPLE_RATE
}

function reportApiLatency(path: string, method: string, status: number, startedAt: number, networkError: boolean) {
  if (typeof window === 'undefined') return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const durationMs = Math.max(0, Math.round(now - startedAt))
  const normalizedPath = normalizeMetricPath(path)
  if (!shouldCaptureLatency(normalizedPath, status, networkError)) return

  const sessionId = getMetricsSessionId()
  const sourcePath = getSourcePath()
  const trafficMeta = getAttributionMetadata()
  const event = {
    type: 'api_latency',
    timestamp: Date.now(),
    event_id: createMetricsEventId(sessionId, Date.now()),
    session_id: sessionId,
    source_path: sourcePath || normalizedPath,
    metadata: {
      ...trafficMeta,
      path: normalizedPath,
      method: String(method || 'GET').toUpperCase(),
      status: Number.isFinite(status) ? status : 0,
      duration_ms: durationMs,
      network_error: networkError ? 1 : 0,
      funnel_stage: stageFromPath(normalizedPath)
    }
  }
  const payload = JSON.stringify({ events: [event] })
  const endpoint = `${API_BASE}/metrics/events`

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }))
      if (ok) return
    }
  } catch {
    // fall through to fetch keepalive
  }

  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId ? { 'x-session-id': sessionId } : {}),
      ...(getCrmLeadId() ? { 'x-crm-lead-id': String(getCrmLeadId()) } : {})
    },
    body: payload,
    keepalive: true
  }).catch(() => void 0)
}

export async function apiGet(path: string, init?: RequestInit) {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const token = getToken()
  const tgInitData = getTelegramInitData();
  const sessionId = getMetricsSessionId();
  const sourcePath = getSourcePath();
  const attributionHeaders = getAttributionHeaders();
  const crmLeadId = getCrmLeadId();
  const { headers: initHeaders, ...restInit } = init || {}

  const headers: HeadersInit = {
    ...(initHeaders || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tgInitData ? { 'x-telegram-init-data': tgInitData } : {}),
    ...(sessionId ? { 'x-session-id': sessionId } : {}),
    ...(sourcePath ? { 'x-source-path': sourcePath } : {}),
    ...(crmLeadId ? { 'x-crm-lead-id': crmLeadId } : {}),
    ...attributionHeaders
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { method: 'GET', ...restInit, headers })
  } catch (error) {
    reportApiLatency(path, 'GET', 0, startedAt, true)
    throw error
  }
  reportApiLatency(path, 'GET', res.status, startedAt, false)
  try {
    const data = await res.json()
    maybeCaptureLeadId(path, data)
    return data
  } catch { return { success: false, status: res.status } }
}

export async function apiPost(path: string, body: unknown, init?: RequestInit) {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const token = getToken()
  const tgInitData = getTelegramInitData();
  const sessionId = getMetricsSessionId();
  const sourcePath = getSourcePath();
  const attributionHeaders = getAttributionHeaders();
  const crmLeadId = getCrmLeadId();
  const { headers: initHeaders, ...restInit } = init || {}

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initHeaders || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tgInitData ? { 'x-telegram-init-data': tgInitData } : {}),
        ...(sessionId ? { 'x-session-id': sessionId } : {}),
        ...(sourcePath ? { 'x-source-path': sourcePath } : {}),
        ...(crmLeadId ? { 'x-crm-lead-id': crmLeadId } : {}),
        ...attributionHeaders
      },
      body: JSON.stringify(body),
      ...restInit,
    })
  } catch (error) {
    reportApiLatency(path, 'POST', 0, startedAt, true)
    throw error
  }
  reportApiLatency(path, 'POST', res.status, startedAt, false)
  try {
    const data = await res.json()
    maybeCaptureLeadId(path, data)
    return data
  } catch { return { success: false, status: res.status } }
}

export async function apiPut(path: string, body: unknown, init?: RequestInit) {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const token = getToken()
  const sessionId = getMetricsSessionId();
  const sourcePath = getSourcePath();
  const attributionHeaders = getAttributionHeaders();
  const crmLeadId = getCrmLeadId();
  const { headers: initHeaders, ...restInit } = init || {}
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(initHeaders || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(sessionId ? { 'x-session-id': sessionId } : {}), ...(sourcePath ? { 'x-source-path': sourcePath } : {}), ...(crmLeadId ? { 'x-crm-lead-id': crmLeadId } : {}), ...attributionHeaders },
      body: JSON.stringify(body),
      ...restInit,
    })
  } catch (error) {
    reportApiLatency(path, 'PUT', 0, startedAt, true)
    throw error
  }
  reportApiLatency(path, 'PUT', res.status, startedAt, false)
  try {
    const data = await res.json()
    maybeCaptureLeadId(path, data)
    return data
  } catch { return { success: false, status: res.status } }
}

export async function apiPatch(path: string, body: unknown, init?: RequestInit) {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const token = getToken()
  const sessionId = getMetricsSessionId();
  const sourcePath = getSourcePath();
  const attributionHeaders = getAttributionHeaders();
  const crmLeadId = getCrmLeadId();
  const { headers: initHeaders, ...restInit } = init || {}
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(initHeaders || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(sessionId ? { 'x-session-id': sessionId } : {}), ...(sourcePath ? { 'x-source-path': sourcePath } : {}), ...(crmLeadId ? { 'x-crm-lead-id': crmLeadId } : {}), ...attributionHeaders },
      body: JSON.stringify(body),
      ...restInit,
    })
  } catch (error) {
    reportApiLatency(path, 'PATCH', 0, startedAt, true)
    throw error
  }
  reportApiLatency(path, 'PATCH', res.status, startedAt, false)
  try {
    const data = await res.json()
    maybeCaptureLeadId(path, data)
    return data
  } catch { return { success: false, status: res.status } }
}

export async function apiDelete(path: string, init?: RequestInit) {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const token = getToken()
  const sessionId = getMetricsSessionId();
  const sourcePath = getSourcePath();
  const attributionHeaders = getAttributionHeaders();
  const crmLeadId = getCrmLeadId();
  const { headers: initHeaders, ...restInit } = init || {}
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: { ...(initHeaders || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(sessionId ? { 'x-session-id': sessionId } : {}), ...(sourcePath ? { 'x-source-path': sourcePath } : {}), ...(crmLeadId ? { 'x-crm-lead-id': crmLeadId } : {}), ...attributionHeaders },
      ...restInit,
    })
  } catch (error) {
    reportApiLatency(path, 'DELETE', 0, startedAt, true)
    throw error
  }
  reportApiLatency(path, 'DELETE', res.status, startedAt, false)
  try {
    const data = await res.json()
    maybeCaptureLeadId(path, data)
    return data
  } catch { return { success: false, status: res.status } }
}

// Auth helpers
export const auth = {
  // Basic login with password
  async login(email: string, password: string) {
    const data = await apiPost('/auth/login', { email, password })
    if (data?.token) localStorage.setItem('authToken', data.token)
    if (data?.user) localStorage.setItem('currentUser', JSON.stringify(data.user))
    return data
  },

  // Legacy register (direct, no verification)
  async register(name: string, email: string, password: string) {
    const data = await apiPost('/auth/register', { name, email, password })
    if (data?.token) localStorage.setItem('authToken', data.token)
    if (data?.user) localStorage.setItem('currentUser', JSON.stringify(data.user))
    return data
  },

  // Step 1: Create pending user and send verification code
  async registerPending(name: string, email: string, password: string) {
    return apiPost('/auth/register-pending', { name, email, password })
  },

  // Step 2: Confirm registration with code
  async confirmRegistration(email: string, code: string) {
    const data = await apiPost('/auth/confirm-registration', { email, code })
    if (data?.token) localStorage.setItem('authToken', data.token)
    if (data?.user) localStorage.setItem('currentUser', JSON.stringify(data.user))
    return data
  },

  // Passwordless: Send login code
  async sendCode(email: string) {
    return apiPost('/auth/send-code', { email })
  },

  // Passwordless: Verify code and login
  async verifyCode(email: string, code: string) {
    const data = await apiPost('/auth/verify-code', { email, code })
    if (data?.token) localStorage.setItem('authToken', data.token)
    if (data?.user) localStorage.setItem('currentUser', JSON.stringify(data.user))
    return data
  },

  // Resend verification code
  async resendCode(email: string) {
    return apiPost('/auth/resend-code', { email })
  },

  // Password reset: Request code
  async requestPasswordReset(email: string) {
    return apiPost('/auth/password-reset/request', { email })
  },

  // Password reset: Confirm with code and new password
  async confirmPasswordReset(email: string, code: string, newPassword: string) {
    const data = await apiPost('/auth/password-reset/confirm', { email, code, newPassword })
    if (data?.token) localStorage.setItem('authToken', data.token)
    if (data?.user) localStorage.setItem('currentUser', JSON.stringify(data.user))
    return data
  },

  async me() {
    return apiGet('/auth/me')
  },

  async completeProfile(email: string, password: string) {
    const data = await apiPost('/auth/complete-profile', { email, password })
    if (data?.token) localStorage.setItem('authToken', data.token)
    if (data?.user) localStorage.setItem('currentUser', JSON.stringify(data.user))
    return data
  },

  async logout() {
    try {
      await apiPost('/auth/logout', {})
    } catch {
      // Ignore logout request failures and clear local auth state anyway.
    }
    localStorage.removeItem('authToken')
    localStorage.removeItem('currentUser')
    return { success: true }
  }
}


export const endpoints = {
  health: '/health',
  v1: {
    // Страницы (плейсхолдеры; будут уточняться позже)
    pages: {
      home: '/v1/pages/home',
      catalog: '/v1/pages/catalog',
      product: '/v1/pages/product',
      cart: '/v1/pages/cart',
      checkout: '/v1/pages/checkout',
      orderTracking: '/v1/pages/order-tracking',
      orderConfirmation: '/v1/pages/order-confirmation',
      bikeSelection: '/v1/pages/bike-selection',
      calculator: '/v1/pages/calculator',
      login: '/v1/pages/login',
      favorites: '/v1/pages/favorites',
      aiChat: '/v1/pages/ai-chat',
      adminPanel: '/v1/pages/admin',
      mobileTest: '/v1/pages/test/mobile',
      performanceTest: '/v1/pages/test/performance',
      testAuth: '/v1/pages/test/auth',
      testFavoritesAuth: '/v1/pages/test/favorites-auth',
      testProfileDropdown: '/v1/pages/test/profile-dropdown',
      testButton: '/v1/pages/test/button',
    },
  },
} as const

export const adminApi = {
  async getEvaluation(bikeId: number) {
    return apiGet(`/admin/bikes/${bikeId}/evaluation`)
  },
  async saveEvaluation(bikeId: number, payload: {
    price_value_score?: number
    quality_appearance_score?: number
    detail_intent_score?: number
    trust_confidence_score?: number | null
    seasonal_fit_score?: number | null
    notes?: string | null
  }) {
    return apiPost(`/admin/bikes/${bikeId}/evaluation`, payload)
  },
  async recompute(bikeId: number) {
    return apiPost(`/admin/bikes/${bikeId}/recompute`, {})
  },
  async recomputeAll() {
    return apiPost(`/admin/ranking/recompute-all`, {})
  },
  async getMetrics(bikeId: number) {
    return apiGet(`/metrics/bikes/${bikeId}`)
  },
  async listPending(limit: number = 50, offset: number = 0) {
    const q = new URLSearchParams()
    q.set('limit', String(limit))
    q.set('offset', String(offset))
    return apiGet(`/admin/evaluations/pending?${q.toString()}`)
  }
}

export const adminMetricsApi = {
  async getCoreOverview(payload: number | { windowHours?: number; windowPreset?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'all' } = 24) {
    const q = new URLSearchParams()
    if (typeof payload === 'number') {
      q.set('windowHours', String(payload))
    } else {
      if (payload?.windowHours != null) q.set('windowHours', String(payload.windowHours))
      if (payload?.windowPreset) q.set('windowPreset', String(payload.windowPreset))
    }
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return apiGet(`/admin/metrics/core-overview${suffix}`)
  },
  async checkFunnelContract(payload?: { windowHours?: number; windowPreset?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'all'; minCoveragePct?: number }) {
    const q = new URLSearchParams()
    if (payload?.windowHours != null) q.set('windowHours', String(payload.windowHours))
    if (payload?.windowPreset) q.set('windowPreset', String(payload.windowPreset))
    if (payload?.minCoveragePct != null) q.set('minCoveragePct', String(payload.minCoveragePct))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return apiGet(`/admin/metrics/funnel-contract${suffix}`)
  },
  async getSessionFacts(payload?: { windowHours?: number; windowPreset?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'all'; limit?: number; offset?: number }) {
    const q = new URLSearchParams()
    if (payload?.windowHours != null) q.set('windowHours', String(payload.windowHours))
    if (payload?.windowPreset) q.set('windowPreset', String(payload.windowPreset))
    if (payload?.limit != null) q.set('limit', String(payload.limit))
    if (payload?.offset != null) q.set('offset', String(payload.offset))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return apiGet(`/admin/metrics/session-facts${suffix}`)
  },
  async refreshInsights(payload?: { limit?: number; force?: boolean }) {
    return apiPost('/admin/metrics/insights/refresh', payload || {})
  },
  async optimizeExperiments(payload?: { dryRun?: boolean; windowDays?: number; minAssignments?: number }) {
    return apiPost('/admin/metrics/experiments/optimize', payload || {})
  },
  async runAnomalies(payload?: { lookbackHours?: number; baselineHours?: number }) {
    return apiPost('/admin/metrics/anomalies/run', payload || {})
  }
  ,
  async runDailyDigest(payload?: { lookbackHours?: number; baselineHours?: number }) {
    return apiPost('/admin/metrics/anomalies/daily-digest', payload || {})
  },
  async runReplay(payload?: { windowDays?: number; minAssignments?: number; strategy?: 'causal_best' | 'bandit_mean' }) {
    return apiPost('/admin/metrics/replay', payload || {})
  },
  async runDemoSeed(payload?: { sessions?: number; daysBack?: number; seed?: number }) {
    return apiPost('/admin/metrics/demo-seed', payload || {})
  }
}

export const adminGrowthApi = {
  async getOverview(payload: number | { windowDays?: number; windowPreset?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'all' } = 30) {
    const q = new URLSearchParams()
    if (typeof payload === 'number') {
      q.set('windowDays', String(payload))
    } else {
      if (payload?.windowDays != null) q.set('windowDays', String(payload.windowDays))
      if (payload?.windowPreset) q.set('windowPreset', String(payload.windowPreset))
    }
    const suffix = q.toString() ? `?${q.toString()}` : ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return apiGet(`/admin/growth/overview${suffix}`, origin ? { headers: { 'x-public-origin': origin } } : undefined)
  },
  async listReferrals(payload?: { windowDays?: number; windowPreset?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'all'; limit?: number; offset?: number }) {
    const q = new URLSearchParams()
    if (payload?.windowDays != null) q.set('windowDays', String(payload.windowDays))
    if (payload?.windowPreset) q.set('windowPreset', String(payload.windowPreset))
    if (payload?.limit != null) q.set('limit', String(payload.limit))
    if (payload?.offset != null) q.set('offset', String(payload.offset))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return apiGet(`/admin/referrals${suffix}`, origin ? { headers: { 'x-public-origin': origin } } : undefined)
  },
  async createReferral(payload: {
    channelName: string
    codeWord?: string
    slug?: string
    targetPath?: string
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
    utmContent?: string
    creatorTag?: string
    notes?: string
  }) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return apiPost('/admin/referrals', payload, origin ? { headers: { 'x-public-origin': origin } } : undefined)
  },
  async updateReferral(id: number, payload: { isActive?: boolean; targetPath?: string; notes?: string }) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return apiPatch(`/admin/referrals/${id}`, payload, origin ? { headers: { 'x-public-origin': origin } } : undefined)
  }
}

export const metricsApi = {
  async sendEvents(events: Array<{ type: string; bikeId?: number; ms?: number; session_id?: string; referrer?: string; source_path?: string; metadata?: Record<string, unknown>; event_id?: string }>) {
    const sessionId = getMetricsSessionId()
    const trafficMeta = getAttributionMetadata()
    const enhanced = events.map((ev, idx) => ({
      ...ev,
      event_id: ev.event_id ?? createMetricsEventId(sessionId, Date.now() + idx),
      session_id: ev.session_id ?? sessionId,
      referrer: ev.referrer ?? (typeof document !== 'undefined' ? document.referrer : ''),
      source_path: ev.source_path ?? (typeof location !== 'undefined' ? location.pathname : ''),
      metadata: {
        ...trafficMeta,
        ...(ev.metadata || {})
      }
    }))
    return apiPost('/metrics/events', { events: enhanced }, { headers: { 'x-session-id': sessionId } })
  }
  ,
  async trackSearch(payload: { query: string; category?: string; brand?: string; minPrice?: number; maxPrice?: number }) {
    const sessionId = getMetricsSessionId()
    return apiPost('/metrics/search', payload, { headers: { 'x-session-id': sessionId } })
  }
}

export const catalogApi = {
  async list(params: { brand?: string; category?: string; minPrice?: number; maxPrice?: number; limit?: number; offset?: number; sort?: 'rank' | 'added'; hot?: boolean; discipline?: string | string[] }) {
    const q = new URLSearchParams()
    if (params.brand) q.set('brand', params.brand)
    if (params.category) q.set('category', params.category)
    if (params.minPrice != null) q.set('minPrice', String(params.minPrice))
    if (params.maxPrice != null) q.set('maxPrice', String(params.maxPrice))
    if (params.limit != null) q.set('limit', String(params.limit))
    if (params.offset != null) q.set('offset', String(params.offset))
    if (params.sort === 'rank') q.set('sort', 'rank')
    if (params.hot) q.set('hot', 'true')
    if (params.discipline) {
      const d = params.discipline
      if (Array.isArray(d)) d.forEach(v => q.append('discipline', v))
      else q.set('discipline', d)
    }
    return apiGet(`/catalog/bikes?${q.toString()}`)
  }
}

export const crmApi = {
  async createMessage(payload: { subject: string; body?: string; bike_id?: string | number; contact_method?: string; contact_value?: string; name?: string }) {
    return apiPost('/v1/crm/messages', payload);
  },
  async createBooking(payload: { bike_id: string | number; customer: { name: string; email?: string; phone?: string; telegram_id?: string }; bike_details: unknown }) {
    return apiPost('/v1/booking', payload);
  }
}

export const crmFrontApi = {
  async searchOrders(q: string, limit: number = 10) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (limit != null) params.set('limit', String(limit))
    return apiGet(`/v1/orders/search?${params.toString()}`)
  },
  async getOrderDetails(orderId: string) {
    return apiGet(`/v1/orders/${encodeURIComponent(orderId)}`)
  },
  async getOrderByToken(token: string) {
    return apiGet(`/v1/orders/track/${encodeURIComponent(token)}`)
  },
  async reserve(orderId: string) {
    return apiPost(`/v1/orders/${encodeURIComponent(orderId)}/reserve`, {})
  }
}

export const userTrackingsApi = {
  async list() {
    return apiGet('/user/trackings')
  },
  async add(tracking_id: string, tracking_type: 'order' | 'application' = 'order', title?: string | null) {
    return apiPost('/user/trackings', { tracking_id, tracking_type, title: title ?? null })
  },
  async remove(id: number) {
    return apiDelete(`/user/trackings/${id}`)
  }
}


