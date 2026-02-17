export type CrmScope = 'mine' | 'all'

type CrmUser = {
  id?: string | number
  role?: string | null
}

export const CRM_SCOPE_STORAGE_KEY = 'crm_scope_mode_v1'
const CRM_SCOPE_LEGACY_STORAGE_KEY = 'crm_dashboard_scope_v1'

const CRM_SCOPE_EVENT = 'crm-scope-changed'

export function getCurrentCrmUser(): CrmUser | null {
  try {
    const raw = localStorage.getItem('currentUser')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isCrmAdmin(user?: CrmUser | null): boolean {
  return String(user?.role || '').trim().toLowerCase() === 'admin'
}

export function normalizeCrmScope(value: unknown): CrmScope | null {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'mine' || normalized === 'all') return normalized
  return null
}

function getStoredRawScope(): CrmScope | null {
  try {
    const next = normalizeCrmScope(localStorage.getItem(CRM_SCOPE_STORAGE_KEY))
    if (next) return next
    return normalizeCrmScope(localStorage.getItem(CRM_SCOPE_LEGACY_STORAGE_KEY))
  } catch {
    return null
  }
}

export function resolveCrmScope(user?: CrmUser | null, requestedScope?: unknown): CrmScope {
  if (!isCrmAdmin(user)) return 'mine'
  const fromRequest = normalizeCrmScope(requestedScope)
  if (fromRequest) return fromRequest
  const fromStorage = getStoredRawScope()
  return fromStorage || 'all'
}

export function setGlobalCrmScope(scope: CrmScope, user?: CrmUser | null): CrmScope {
  const appliedScope = resolveCrmScope(user, scope)

  try {
    if (isCrmAdmin(user)) {
      localStorage.setItem(CRM_SCOPE_STORAGE_KEY, appliedScope)
    } else {
      localStorage.removeItem(CRM_SCOPE_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CRM_SCOPE_EVENT, { detail: { scope: appliedScope } }))
  }

  return appliedScope
}

export function subscribeCrmScopeChange(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => listener()
  window.addEventListener(CRM_SCOPE_EVENT, handler)
  return () => window.removeEventListener(CRM_SCOPE_EVENT, handler)
}
