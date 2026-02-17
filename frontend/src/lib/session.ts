const SESSION_STORAGE_KEY = 'metrics_session_v2'
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000

type MetricsSession = {
  id: string
  createdAt: number
  lastSeenAt: number
}

let memoryFallbackSessionId: string | null = null
let eventSequence = 0

function generateSessionId(now: number): string {
  return `${Math.random().toString(36).slice(2)}${now.toString(36)}`
}

function parseSession(raw: string | null): MetricsSession | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<MetricsSession>
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : ''
    const createdAt = Number(parsed.createdAt)
    const lastSeenAt = Number(parsed.lastSeenAt)
    if (!id) return null
    if (!Number.isFinite(createdAt) || !Number.isFinite(lastSeenAt)) return null
    return { id, createdAt, lastSeenAt }
  } catch {
    return null
  }
}

function shouldRotate(session: MetricsSession, now: number): boolean {
  return (
    now - session.lastSeenAt > INACTIVITY_TIMEOUT_MS ||
    now - session.createdAt > MAX_SESSION_AGE_MS
  )
}

export function getMetricsSessionId(now: number = Date.now()): string {
  if (typeof window === 'undefined') {
    if (!memoryFallbackSessionId) {
      memoryFallbackSessionId = generateSessionId(now)
    }
    return memoryFallbackSessionId
  }

  try {
    const existing = parseSession(localStorage.getItem(SESSION_STORAGE_KEY))
    const active = existing && !shouldRotate(existing, now)
      ? { ...existing, lastSeenAt: now }
      : { id: generateSessionId(now), createdAt: now, lastSeenAt: now }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(active))
    return active.id
  } catch {
    if (!memoryFallbackSessionId) {
      memoryFallbackSessionId = generateSessionId(now)
    }
    return memoryFallbackSessionId
  }
}

export function createMetricsEventId(sessionId: string, now: number = Date.now()): string {
  eventSequence = (eventSequence + 1) % 1000000
  const seq = eventSequence.toString(36)
  const rnd = Math.random().toString(36).slice(2, 8)
  return `${sessionId}:${now.toString(36)}:${seq}:${rnd}`
}
