import { metricsApi } from '@/api'

type VitalName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'

const sentKeys = new Set<string>()

function stageFromPath(path: string): string {
  const value = String(path || '').toLowerCase()
  if (value.includes('/catalog')) return 'catalog'
  if (value.includes('/product') || value.includes('/bike/')) return 'product'
  if (value.includes('/checkout') || value.includes('/guest-order') || value.includes('/booking-checkout')) return 'checkout'
  if (value.includes('/booking') || value.includes('/order-tracking')) return 'booking'
  return 'other'
}

function scoreVital(name: VitalName, value: number): 'good' | 'needs_improvement' | 'poor' {
  if (name === 'LCP') {
    if (value <= 2500) return 'good'
    if (value <= 4000) return 'needs_improvement'
    return 'poor'
  }
  if (name === 'INP') {
    if (value <= 200) return 'good'
    if (value <= 500) return 'needs_improvement'
    return 'poor'
  }
  if (name === 'CLS') {
    if (value <= 0.1) return 'good'
    if (value <= 0.25) return 'needs_improvement'
    return 'poor'
  }
  if (name === 'FCP' || name === 'TTFB') {
    if (value <= 1800) return 'good'
    if (value <= 3000) return 'needs_improvement'
    return 'poor'
  }
  return 'needs_improvement'
}

function sendWebVital(name: VitalName, value: number, delta: number, id: string) {
  if (!Number.isFinite(value) || value < 0) return
  const path = typeof location !== 'undefined' ? location.pathname : '/'
  const key = `${name}:${id}:${path}`
  if (sentKeys.has(key)) return
  sentKeys.add(key)

  metricsApi.sendEvents([
    {
      type: 'web_vital',
      metadata: {
        name,
        value: Math.round(value * 1000) / 1000,
        delta: Math.round(delta * 1000) / 1000,
        rating: scoreVital(name, value),
        id,
        path,
        stage: stageFromPath(path)
      }
    }
  ]).catch(() => void 0)
}

function observePaint() {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    const obs = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          sendWebVital('FCP', entry.startTime, entry.startTime, `fcp-${Math.round(entry.startTime)}`)
          obs.disconnect()
          break
        }
      }
    })
    obs.observe({ type: 'paint', buffered: true } as unknown as PerformanceObserverInit)
  } catch {
    // ignore unsupported observer
  }
}

function observeLcp() {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    let latest: PerformanceEntry | null = null
    const obs = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      if (entries.length > 0) latest = entries[entries.length - 1]
    })
    obs.observe({ type: 'largest-contentful-paint', buffered: true } as unknown as PerformanceObserverInit)

    const finalize = () => {
      if (!latest) return
      sendWebVital('LCP', latest.startTime, latest.startTime, `lcp-${Math.round(latest.startTime)}`)
      obs.disconnect()
      document.removeEventListener('visibilitychange', onHidden, true)
      window.removeEventListener('pagehide', onPageHide, true)
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') finalize()
    }
    const onPageHide = () => finalize()

    document.addEventListener('visibilitychange', onHidden, true)
    window.addEventListener('pagehide', onPageHide, true)
  } catch {
    // ignore unsupported observer
  }
}

function observeCls() {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    let cls = 0
    const obs = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
        if (!entry.hadRecentInput) {
          cls += Number(entry.value || 0)
        }
      }
    })
    obs.observe({ type: 'layout-shift', buffered: true } as unknown as PerformanceObserverInit)

    const finalize = () => {
      sendWebVital('CLS', cls, cls, `cls-${Date.now()}`)
      obs.disconnect()
      document.removeEventListener('visibilitychange', onHidden, true)
      window.removeEventListener('pagehide', onPageHide, true)
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') finalize()
    }
    const onPageHide = () => finalize()
    document.addEventListener('visibilitychange', onHidden, true)
    window.addEventListener('pagehide', onPageHide, true)
  } catch {
    // ignore unsupported observer
  }
}

function observeInp() {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    let worst = 0
    const obs = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as Array<PerformanceEntry & { duration?: number }>) {
        const d = Number(entry.duration || 0)
        if (d > worst) worst = d
      }
    })
    obs.observe({ type: 'event', buffered: true, durationThreshold: 40 } as unknown as PerformanceObserverInit)

    const finalize = () => {
      if (worst > 0) {
        sendWebVital('INP', worst, worst, `inp-${Date.now()}`)
      }
      obs.disconnect()
      document.removeEventListener('visibilitychange', onHidden, true)
      window.removeEventListener('pagehide', onPageHide, true)
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') finalize()
    }
    const onPageHide = () => finalize()
    document.addEventListener('visibilitychange', onHidden, true)
    window.addEventListener('pagehide', onPageHide, true)
  } catch {
    // ignore unsupported observer
  }
}

function emitTtfb() {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (!nav) return
    const ttfb = Number(nav.responseStart || 0)
    if (!Number.isFinite(ttfb) || ttfb <= 0) return
    sendWebVital('TTFB', ttfb, ttfb, `ttfb-${Math.round(ttfb)}`)
  } catch {
    // ignore
  }
}

export function startWebVitalsTracking() {
  if (typeof window === 'undefined') return
  const marker = '__metricsWebVitalsStarted'
  if ((window as unknown as Record<string, unknown>)[marker]) return
  ;(window as unknown as Record<string, unknown>)[marker] = true

  observePaint()
  observeLcp()
  observeCls()
  observeInp()
  emitTtfb()
}
