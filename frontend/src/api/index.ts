// Базовая точка для HTTP-запросов фронта
export const API_BASE = import.meta.env.PROD
  ? '/api'
  : ((import.meta.env?.VITE_API_URL as string) || '/api')

// Формирует абсолютный URL для изображений, если пришёл относительный путь
export function resolveImageUrl(path: any): string | null {
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
  const p = (path || '').trim();
  if (!p || p.includes('[object Promise]')) return null;
  const baseNoApi = API_BASE.replace('/api', '');

  // 1. ImageKit URL - возвращаем как есть (прямой доступ к CDN)
  if (p.includes('ik.imagekit.io')) {
    return p;
  }

  // 2. Внешние URL (Buycycle, Kleinanzeigen) - возвращаем как есть
  // Удален прокси, так как современные CDN и источники обычно поддерживают CORS или мы их уже проксируем через ImageKit
  if (/^https?:\/\//i.test(p)) {
    // Исключение: localhost (legacy dev env)
    if (p.includes('localhost')) {
      try {
        const u = new URL(p);
        return `${baseNoApi}${u.pathname}`;
      } catch { }
    }
    return p;
  }

  // 3. Legacy local paths (для старых данных, которые еще не в ImageKit)
  // Приклеиваем к корню бэкенда (без /api)
  const normalized = p.startsWith('/') ? p : `/${p}`;
  return `${baseNoApi}${normalized}`;
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
    // @ts-ignore
    return window.Telegram?.WebApp?.initData || null;
  } catch {
    return null;
  }
}

export async function apiGet(path: string, init?: RequestInit) {
  const token = getToken()
  const tgInitData = getTelegramInitData();

  const headers: HeadersInit = {
    ...(init?.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tgInitData ? { 'x-telegram-init-data': tgInitData } : {})
  }
  const res = await fetch(`${API_BASE}${path}`, { method: 'GET', headers, ...init })
  try { return await res.json() } catch { return { success: false, status: res.status } }
}

export async function apiPost(path: string, body: unknown, init?: RequestInit) {
  const token = getToken()
  const tgInitData = getTelegramInitData();

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tgInitData ? { 'x-telegram-init-data': tgInitData } : {})
    },
    body: JSON.stringify(body),
    ...init,
  })
  try { return await res.json() } catch { return { success: false, status: res.status } }
}

export async function apiPut(path: string, body: unknown, init?: RequestInit) {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    ...init,
  })
  try { return await res.json() } catch { return { success: false, status: res.status } }
}

export async function apiDelete(path: string, init?: RequestInit) {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...init,
  })
  try { return await res.json() } catch { return { success: false, status: res.status } }
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

  async logout() {
    try { await apiPost('/auth/logout', {}) } catch { }
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

export const metricsApi = {
  async sendEvents(events: Array<{ type: string; bikeId?: number; ms?: number; session_id?: string; referrer?: string; source_path?: string }>) {
    const sessionId = getSessionId()
    const enhanced = events.map(ev => ({
      ...ev,
      session_id: ev.session_id ?? sessionId,
      referrer: ev.referrer ?? (typeof document !== 'undefined' ? document.referrer : ''),
      source_path: ev.source_path ?? (typeof location !== 'undefined' ? location.pathname : '')
    }))
    return apiPost('/behavior/events', { events: enhanced })
  }
  ,
  async trackSearch(payload: { query: string; category?: string; brand?: string; minPrice?: number; maxPrice?: number }) {
    const sessionId = getSessionId()
    return apiPost('/metrics/search', payload, { headers: { 'x-session-id': sessionId } })
  }
}

function getSessionId(): string {
  try {
    const key = 'session_id'
    let sid = localStorage.getItem(key)
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(key, sid)
    }
    return sid
  } catch {
    return Math.random().toString(36).slice(2)
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
  async createBooking(payload: { bike_id: string | number; customer: { name: string; email?: string; phone?: string; telegram_id?: string }; bike_details: any }) {
    return apiPost('/v1/booking', payload);
  }
}

export const crmFrontApi = {
  async searchOrders(q: string, limit: number = 10) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (limit != null) params.set('limit', String(limit))
    return apiGet(`/v1/crm/orders/search?${params.toString()}`)
  },
  async getOrderDetails(orderId: string) {
    return apiGet(`/v1/crm/orders/${encodeURIComponent(orderId)}`)
  },
  async getOrderByToken(token: string) {
    return apiGet(`/orders/track/${encodeURIComponent(token)}`)
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
