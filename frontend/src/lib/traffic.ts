type TrafficTouch = {
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmTerm: string
  utmContent: string
  clickId: string
  landingPath: string
  ts: number
}

type AttributionState = {
  first: TrafficTouch | null
  last: TrafficTouch | null
}

const ATTRIBUTION_STORAGE_KEY = 'metrics_attribution_v1'

function clean(value: string | null | undefined): string {
  return String(value || '').trim().slice(0, 200)
}

function safePath(pathname: string | null | undefined): string {
  const value = clean(pathname)
  if (!value) return '/'
  return value.startsWith('/') ? value : `/${value}`
}

function buildDirectSource(referrer: string): { source: string; medium: string } {
  if (!referrer) return { source: 'direct', medium: 'none' }
  try {
    const refHost = new URL(referrer).hostname.toLowerCase()
    const ownHost = typeof location !== 'undefined' ? String(location.hostname || '').toLowerCase() : ''
    if (refHost && ownHost && refHost !== ownHost && !refHost.endsWith(`.${ownHost}`)) {
      return { source: refHost, medium: 'referral' }
    }
  } catch {
    return { source: 'direct', medium: 'none' }
  }
  return { source: 'direct', medium: 'none' }
}

function parseTouch(now: number): TrafficTouch | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(location.search || '')
  const referrer = typeof document !== 'undefined' ? String(document.referrer || '').trim() : ''
  const inferred = buildDirectSource(referrer)

  const utmSource = clean(params.get('utm_source')) || inferred.source
  const utmMedium = clean(params.get('utm_medium')) || inferred.medium
  const utmCampaign = clean(params.get('utm_campaign'))
  const utmTerm = clean(params.get('utm_term'))
  const utmContent = clean(params.get('utm_content'))
  const clickId =
    clean(params.get('rid')) ||
    clean(params.get('ref')) ||
    clean(params.get('ref_code')) ||
    clean(params.get('gclid')) ||
    clean(params.get('fbclid')) ||
    clean(params.get('msclkid')) ||
    clean(params.get('yclid'))
  const landingPath = safePath(location.pathname)

  return {
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    clickId,
    landingPath,
    ts: now
  }
}

function safeParseState(raw: string | null): AttributionState {
  if (!raw) return { first: null, last: null }
  try {
    const parsed = JSON.parse(raw) as Partial<AttributionState>
    const first = parsed?.first && typeof parsed.first === 'object' ? parsed.first as TrafficTouch : null
    const last = parsed?.last && typeof parsed.last === 'object' ? parsed.last as TrafficTouch : null
    return { first, last }
  } catch {
    return { first: null, last: null }
  }
}

function shouldUpdateLast(current: TrafficTouch, previousLast: TrafficTouch | null): boolean {
  if (!previousLast) return true
  return (
    current.utmSource !== previousLast.utmSource ||
    current.utmMedium !== previousLast.utmMedium ||
    current.utmCampaign !== previousLast.utmCampaign ||
    current.utmTerm !== previousLast.utmTerm ||
    current.utmContent !== previousLast.utmContent ||
    current.clickId !== previousLast.clickId ||
    current.landingPath !== previousLast.landingPath
  )
}

export function captureAttribution(now: number = Date.now()): AttributionState {
  if (typeof window === 'undefined') return { first: null, last: null }
  try {
    const current = parseTouch(now)
    const state = safeParseState(localStorage.getItem(ATTRIBUTION_STORAGE_KEY))
    if (!current) return state

    const next: AttributionState = {
      first: state.first || current,
      last: shouldUpdateLast(current, state.last) ? current : state.last
    }
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next))
    return next
  } catch {
    return { first: null, last: null }
  }
}

export function getAttributionHeaders(): Record<string, string> {
  const state = captureAttribution()
  const first = state.first
  const last = state.last
  return {
    ...(first?.utmSource ? { 'x-utm-source': first.utmSource } : {}),
    ...(first?.utmMedium ? { 'x-utm-medium': first.utmMedium } : {}),
    ...(first?.utmCampaign ? { 'x-utm-campaign': first.utmCampaign } : {}),
    ...(first?.utmTerm ? { 'x-utm-term': first.utmTerm } : {}),
    ...(first?.utmContent ? { 'x-utm-content': first.utmContent } : {}),
    ...(first?.clickId ? { 'x-click-id': first.clickId } : {}),
    ...(first?.landingPath ? { 'x-landing-path': first.landingPath } : {}),
    ...(last?.utmSource ? { 'x-utm-last-source': last.utmSource } : {}),
    ...(last?.utmMedium ? { 'x-utm-last-medium': last.utmMedium } : {}),
    ...(last?.utmCampaign ? { 'x-utm-last-campaign': last.utmCampaign } : {})
  }
}

export function getAttributionMetadata(): Record<string, string> {
  const state = captureAttribution()
  const first = state.first
  const last = state.last
  return {
    ...(first?.utmSource ? { utm_source: first.utmSource } : {}),
    ...(first?.utmMedium ? { utm_medium: first.utmMedium } : {}),
    ...(first?.utmCampaign ? { utm_campaign: first.utmCampaign } : {}),
    ...(first?.utmTerm ? { utm_term: first.utmTerm } : {}),
    ...(first?.utmContent ? { utm_content: first.utmContent } : {}),
    ...(first?.clickId ? { click_id: first.clickId } : {}),
    ...(first?.landingPath ? { landing_path: first.landingPath } : {}),
    ...(last?.utmSource ? { utm_last_source: last.utmSource } : {}),
    ...(last?.utmMedium ? { utm_last_medium: last.utmMedium } : {}),
    ...(last?.utmCampaign ? { utm_last_campaign: last.utmCampaign } : {})
  }
}
