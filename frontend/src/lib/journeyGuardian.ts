import { metricsApi } from '@/api'

const KEYWORDS = ['checkout', 'booking', 'order', 'reserve', 'buy', 'purchase', 'бронь', 'заказ', 'купить']

function cleanText(value: string): string {
  return String(value || '').trim().toLowerCase()
}

function hasKeyword(value: string): boolean {
  const text = cleanText(value)
  return KEYWORDS.some((keyword) => text.includes(keyword))
}

function buildFormId(form: HTMLFormElement): string {
  const id = cleanText(form.id)
  const name = cleanText(form.getAttribute('name') || '')
  const action = cleanText(form.getAttribute('action') || '')
  const path = typeof location !== 'undefined' ? cleanText(location.pathname) : ''
  const fieldCount = form.querySelectorAll('input, textarea, select').length
  return [id || '-', name || '-', action || '-', path || '-', String(fieldCount)].join('|')
}

function formSignals(form: HTMLFormElement) {
  const action = cleanText(form.getAttribute('action') || '')
  const method = cleanText(form.getAttribute('method') || 'get')
  const path = typeof location !== 'undefined' ? location.pathname : '/'
  const labels = cleanText(form.innerText || '')
  const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'))
  const fieldNames = inputs
    .map((el) => cleanText(el.name || el.id || (el.getAttribute('aria-label') || '') || (el.getAttribute('placeholder') || '')))
    .filter(Boolean)

  let checkoutScore = 0
  if (hasKeyword(path)) checkoutScore += 2
  if (hasKeyword(action)) checkoutScore += 2
  if (hasKeyword(labels)) checkoutScore += 2
  if (fieldNames.some((v) => /(name|email|phone|telegram|city|address|delivery|comment|message|contact|zip|postcode|country|coupon)/i.test(v))) checkoutScore += 2
  if (fieldNames.some((v) => /(bike|product|item|order|checkout|booking|reserve)/i.test(v))) checkoutScore += 2

  const requiredCount = inputs.filter((el) => (el as HTMLInputElement).required).length
  const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]').length
  const stage = (() => {
    if (hasKeyword(path) || hasKeyword(action)) return 'checkout'
    if (path.includes('/catalog')) return 'catalog'
    if (path.includes('/product')) return 'product'
    if (path.includes('/booking') || path.includes('/order-tracking')) return 'booking'
    return 'other'
  })()

  return {
    formId: buildFormId(form),
    checkoutScore,
    isCheckoutLike: checkoutScore >= 2,
    action: action || null,
    method,
    path,
    stage,
    fieldCount: inputs.length,
    requiredCount,
    submitButtons
  }
}

function extractInvalidField(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null
  const name = target.getAttribute('name') || target.getAttribute('id') || target.getAttribute('aria-label') || target.getAttribute('placeholder')
  if (!name) return null
  return String(name).slice(0, 120)
}

function extractInvalidReason(target: EventTarget | null): string | null {
  const input = target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  if (!input || !('validity' in input)) return null
  const validity = (input as HTMLInputElement).validity
  if (!validity) return null
  if (validity.valueMissing) return 'value_missing'
  if (validity.typeMismatch) return 'type_mismatch'
  if (validity.patternMismatch) return 'pattern_mismatch'
  if (validity.tooShort) return 'too_short'
  if (validity.tooLong) return 'too_long'
  if (validity.rangeUnderflow) return 'range_underflow'
  if (validity.rangeOverflow) return 'range_overflow'
  if (validity.stepMismatch) return 'step_mismatch'
  return 'invalid'
}

function throttle(map: Map<string, number>, key: string, ttlMs: number): boolean {
  const now = Date.now()
  const last = map.get(key) || 0
  if (now - last < ttlMs) return false
  map.set(key, now)
  return true
}

export function startJourneyGuardian() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const markerKey = '__metricsJourneyGuardianStarted'
  const markerHolder = window as unknown as Record<string, unknown>
  if (markerHolder[markerKey]) return
  markerHolder[markerKey] = true

  const seenForms = new Set<string>()
  const inputSeen = new Set<string>()
  const throttled = new Map<string, number>()
  const formState = new Map<string, { attempts: number; firstInputAt: number; lastInvalidAt: number; submitted: boolean }>()

  const emitFormSeen = (form: HTMLFormElement) => {
    const sig = formSignals(form)
    if (seenForms.has(sig.formId)) return
    seenForms.add(sig.formId)
    formState.set(sig.formId, { attempts: 0, firstInputAt: 0, lastInvalidAt: 0, submitted: false })
    metricsApi.sendEvents([
      {
        type: 'form_seen',
        metadata: sig
      },
      ...(sig.isCheckoutLike
        ? [{ type: 'checkout_step', metadata: { ...sig, stage: 'form_seen_auto' } }]
        : [])
    ]).catch(() => void 0)
  }

  const emitFirstInput = (form: HTMLFormElement) => {
    const sig = formSignals(form)
    if (inputSeen.has(sig.formId)) return
    inputSeen.add(sig.formId)
    const state = formState.get(sig.formId) || { attempts: 0, firstInputAt: 0, lastInvalidAt: 0, submitted: false }
    state.firstInputAt = Date.now()
    formState.set(sig.formId, state)
    metricsApi.sendEvents([
      {
        type: 'form_first_input',
        metadata: sig
      },
      ...(sig.isCheckoutLike
        ? [{ type: 'checkout_step', metadata: { ...sig, stage: 'first_input_auto' } }]
        : [])
    ]).catch(() => void 0)
  }

  const onSubmit = (event: Event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null
    if (!form) return
    const sig = formSignals(form)
    const state = formState.get(sig.formId) || { attempts: 0, firstInputAt: 0, lastInvalidAt: 0, submitted: false }
    state.attempts += 1
    state.submitted = true
    formState.set(sig.formId, state)
    metricsApi.sendEvents([
      {
        type: 'form_submit_attempt',
        metadata: {
          ...sig,
          attempt_no: state.attempts
        }
      },
      ...(sig.isCheckoutLike
        ? [{ type: 'checkout_submit_attempt', metadata: { ...sig, flow: 'auto_journey_guardian', attempt_no: state.attempts } }]
        : [])
    ]).catch(() => void 0)
  }

  const onInvalid = (event: Event) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    const form = target.closest('form')
    if (!(form instanceof HTMLFormElement)) return
    const sig = formSignals(form)
    const field = extractInvalidField(event.target)
    const reason = extractInvalidReason(event.target)
    const state = formState.get(sig.formId) || { attempts: 0, firstInputAt: 0, lastInvalidAt: 0, submitted: false }
    state.lastInvalidAt = Date.now()
    formState.set(sig.formId, state)
    const throttleKey = `invalid:${sig.formId}:${field || 'unknown'}`
    if (!throttle(throttled, throttleKey, 2000)) return
    metricsApi.sendEvents([
      {
        type: 'form_validation_error',
        metadata: {
          ...sig,
          field,
          reason,
          attempt_no: state.attempts || 1
        }
      },
      ...(sig.isCheckoutLike
        ? [
            { type: 'checkout_validation_error', metadata: { ...sig, flow: 'auto_journey_guardian', field, reason, attempt_no: state.attempts || 1 } },
            { type: 'checkout_field_error', metadata: { ...sig, flow: 'auto_journey_guardian', field, reason, attempt_no: state.attempts || 1 } }
          ]
        : [])
    ]).catch(() => void 0)
  }

  const onInput = (event: Event) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    const form = target.closest('form')
    if (!(form instanceof HTMLFormElement)) return
    emitFirstInput(form)
  }

  document.querySelectorAll('form').forEach((node) => {
    if (node instanceof HTMLFormElement) emitFormSeen(node)
  })

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        if (node.tagName === 'FORM') {
          emitFormSeen(node as HTMLFormElement)
        }
        node.querySelectorAll?.('form').forEach((form) => {
          if (form instanceof HTMLFormElement) emitFormSeen(form)
        })
      })
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  document.addEventListener('submit', onSubmit, true)
  document.addEventListener('invalid', onInvalid, true)
  document.addEventListener('input', onInput, true)

  window.addEventListener('beforeunload', () => {
    const abandonEvents: Array<{ type: string; metadata: Record<string, unknown> }> = []
    for (const [formId, state] of formState.entries()) {
      if (!state.firstInputAt) continue
      if (state.submitted) continue
      abandonEvents.push({
        type: 'checkout_abandon',
        metadata: {
          formId,
          stage: 'checkout',
          first_input_ms_ago: Math.max(0, Date.now() - state.firstInputAt),
          attempts: state.attempts,
          reason: state.lastInvalidAt ? 'validation_unresolved' : 'no_submit'
        }
      })
    }
    if (abandonEvents.length > 0) {
      metricsApi.sendEvents(abandonEvents).catch(() => void 0)
    }
  })
}
