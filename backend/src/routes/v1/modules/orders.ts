import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
const { DatabaseManager } = require('../../../js/mysql-config')
const { v4: uuidv4 } = require('uuid')
const {
  ORDER_STATUS,
  ORDER_CANCEL_REASON,
  TERMINAL_ORDER_STATUSES,
  normalizeOrderStatus
} = require('../../../domain/orderLifecycle')

const router = Router()

const LOCAL_DB_ONLY = ['1', 'true', 'yes', 'on'].includes(String(process.env.LOCAL_DB_ONLY || '1').trim().toLowerCase())
const supabaseUrl = LOCAL_DB_ONLY ? null : (process.env.SUPABASE_URL || null)
const supabaseKey = LOCAL_DB_ONLY
  ? null
  : (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    null
  )
const supabase = (!LOCAL_DB_ONLY && supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null
const db = new DatabaseManager()

const CHECKLIST_KEYS = [
  '1_brand_verified', '2_model_verified', '3_year_verified', '4_frame_size_verified',
  '5_serial_number', '6_frame_condition', '7_fork_condition', '8_shock_condition',
  '9_drivetrain_condition', '10_brakes_condition', '11_wheels_condition', '12_tires_condition',
  '13_headset_check', '14_bottom_bracket_check', '15_suspension_service_history', '16_brake_pads_percentage',
  '17_chain_wear', '18_cassette_wear', '19_rotor_condition', '20_bearing_play',
  '21_original_owner', '22_proof_of_purchase', '23_warranty_status', '24_crash_history',
  '25_reason_for_sale', '26_upgrades_verified', '27_test_ride_completed', '28_final_approval'
]

const INSPECTION_SELECT_WITH_STAGE = 'id,order_id,bike_id,stage,checklist,photos_status,next_action_suggestion,quality_score,created_at,updated_at'
const INSPECTION_SELECT_NO_STAGE = 'id,order_id,bike_id,checklist,photos_status,next_action_suggestion,quality_score,created_at,updated_at'
const INSPECTION_SELECT_MINIMAL = 'id,order_id,checklist,photos_status,next_action_suggestion,quality_score,created_at,updated_at'
const INSPECTION_SELECT_LEGACY = 'id,order_id,checklist,photos_status,next_action_suggestion,created_at,updated_at'
const FREE_BOOKING_QUEUE_STATUSES = new Set([
  ORDER_STATUS.BOOKED,
  ORDER_STATUS.RESERVE_PAYMENT_PENDING,
  ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
  ORDER_STATUS.CHECK_READY,
  ORDER_STATUS.AWAITING_CLIENT_DECISION,
  ORDER_STATUS.FULL_PAYMENT_PENDING
])

function inspectionErrorText(error: any): string {
  return `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
}

function isMissingInspectionColumnError(error: any, column: string): boolean {
  const text = inspectionErrorText(error)
  const col = String(column || '').toLowerCase()
  if (!text || !col) return false
  return (
    text.includes(`could not find the '${col}' column of 'inspections'`) ||
    text.includes(`column inspections.${col} does not exist`) ||
    text.includes(`column inspections_1.${col} does not exist`)
  )
}

async function fetchLatestInspectionByOrderId(orderId: string) {
  if (!supabase) return null

  const selectVariants = [
    INSPECTION_SELECT_WITH_STAGE,
    INSPECTION_SELECT_NO_STAGE,
    INSPECTION_SELECT_MINIMAL,
    INSPECTION_SELECT_LEGACY
  ]

  let lastError: any = null
  for (const selectExpr of selectVariants) {
    const response = await supabase
      .from('inspections')
      .select(selectExpr)
      .eq('order_id', orderId)
      .maybeSingle()

    if (!response.error) return response.data || null
    lastError = response.error

    const isRecoverable =
      isMissingInspectionColumnError(response.error, 'stage')
      || isMissingInspectionColumnError(response.error, 'status')
      || isMissingInspectionColumnError(response.error, 'bike_id')
      || isMissingInspectionColumnError(response.error, 'quality_score')

    if (!isRecoverable) throw response.error
  }

  if (lastError) throw lastError
  return null
}

function safeJson(input: any) {
  if (!input) return null
  if (typeof input === 'object') return input
  if (typeof input !== 'string') return null
  try { return JSON.parse(input) } catch { return null }
}

function isTerminalStatus(rawStatus: any) {
  const normalized = normalizeOrderStatus(rawStatus)
  return Boolean(normalized && TERMINAL_ORDER_STATUSES.includes(normalized))
}

function isPaidReserveActive(orderLike: any) {
  const normalized = normalizeOrderStatus(orderLike?.status)
  if (normalized === ORDER_STATUS.RESERVE_PAID) return true
  const snapshot = safeJson(orderLike?.bike_snapshot) || {}
  const bookingMeta = snapshot?.booking_meta || {}
  const paymentStatus = String(bookingMeta?.reservation_payment?.status || '').toLowerCase()
  return Boolean(
    bookingMeta?.reservation_paid_at ||
    paymentStatus === 'paid'
  )
}

function getOrderBikeKey(orderLike: any) {
  const snapshot = safeJson(orderLike?.bike_snapshot) || {}
  const bikeId = orderLike?.bike_id ?? snapshot?.bike_id ?? snapshot?.external_bike_ref ?? null
  return bikeId == null ? null : String(bikeId)
}

function getBookingMeta(snapshot: any) {
  const src = safeJson(snapshot) || {}
  if (!src.booking_meta || typeof src.booking_meta !== 'object') {
    src.booking_meta = {}
  }
  return { snapshot: src, bookingMeta: src.booking_meta }
}

function withReservePaidSnapshot(snapshotRaw: any, nowIso: string, paymentId: string, amountRub: number | null) {
  const { snapshot, bookingMeta } = getBookingMeta(snapshotRaw)
  bookingMeta.reservation_paid_at = nowIso
  bookingMeta.reserve_enabled = true
  bookingMeta.reservation_payment = {
    id: paymentId,
    provider: 'placeholder_gateway',
    status: 'paid',
    paid_at: nowIso,
    amount_rub: amountRub,
    currency: 'RUB'
  }
  snapshot.booking_meta = bookingMeta
  return snapshot
}

function withSupersededSnapshot(snapshotRaw: any, nowIso: string, supersedingOrderCode: string) {
  const { snapshot, bookingMeta } = getBookingMeta(snapshotRaw)
  bookingMeta.cancel_reason = ORDER_CANCEL_REASON.SUPERSEDED_BY_PAID_RESERVE
  bookingMeta.cancelled_at = nowIso
  bookingMeta.cancelled_by_order_code = supersedingOrderCode
  bookingMeta.cancellation_context = {
    reason: ORDER_CANCEL_REASON.SUPERSEDED_BY_PAID_RESERVE,
    by_order_code: supersedingOrderCode,
    at: nowIso
  }
  snapshot.booking_meta = bookingMeta
  return snapshot
}

function getSnapshotContact(snapshot: any) {
  const bookingMeta = snapshot?.booking_meta || {}
  const bookingForm = bookingMeta?.booking_form || {}
  const contactValue =
    bookingForm?.contact_value ||
    bookingMeta?.contact_value ||
    snapshot?.contact_value ||
    null
  const contactMethod =
    bookingForm?.contact_method ||
    bookingMeta?.contact_method ||
    snapshot?.contact_method ||
    null
  const city =
    bookingForm?.city ||
    bookingMeta?.city ||
    snapshot?.city ||
    snapshot?.destination_city ||
    null
  return { contactValue, contactMethod, city }
}

function normalizeQueueHint(raw: any) {
  const text = String(raw || '').trim()
  if (!text) return null
  if (text.toLowerCase().includes('заглуш')) return null
  return text
}

async function getLocalBikeInspection(bikeId?: number | string | null) {
  if (!bikeId) return null
  const rows = await db.query(
    'SELECT inspection_json, inspection_data, condition_checklist FROM bikes WHERE id = ? LIMIT 1',
    [bikeId]
  )
  const row = rows && rows[0]
  if (!row) return null

  const sources = [row.inspection_json, row.inspection_data, row.condition_checklist]
  let parsed: any = null
  for (const src of sources) {
    const candidate = safeJson(src)
    if (candidate && typeof candidate === 'object') {
      parsed = candidate
      break
    }
  }

  if (!parsed) return null

  if (parsed.checklist && typeof parsed.checklist === 'object') {
    return { checklist: parsed.checklist, photos_status: parsed.photos_status || {}, status: parsed.status || 'pending' }
  }

  const checklist: any = {}
  CHECKLIST_KEYS.forEach((key) => {
    const entry = parsed[key]
    if (entry !== undefined) {
      if (typeof entry === 'object') {
        checklist[key] = {
          status: entry.status ?? null,
          comment: entry.comment ?? entry.note ?? entry.value ?? '',
          photos: entry.photos ?? []
        }
      } else {
        checklist[key] = { status: entry === true ? true : entry === false ? false : null, comment: String(entry ?? ''), photos: [] }
      }
    } else {
      checklist[key] = { status: null, comment: '', photos: [] }
    }
  })

  return { checklist, photos_status: {}, status: parsed.status || 'pending' }
}

function buildOrderPayload(order: any, customer: any, inspection: any, logistics: any[], history: any[]) {
  const snapshot = safeJson(order.bike_snapshot) || {}
  const bookingMeta = snapshot.booking_meta || {}
  const financials = snapshot.financials || bookingMeta.financials || {}
  const snapshotContact = getSnapshotContact(snapshot)

  const totalPriceRub = Number(order.total_price_rub || financials.total_price_rub || bookingMeta.total_price_rub || 0) || null
  const bookingAmountRub = Number(order.booking_amount_rub || financials.booking_amount_rub || bookingMeta.booking_amount_rub || 0) ||
    (totalPriceRub ? Math.ceil(totalPriceRub * 0.02) : null)
  const exchangeRate = Number(order.exchange_rate || financials.exchange_rate || bookingMeta.exchange_rate || 0) || null
  const deliveryMethod = order.delivery_method || bookingMeta.booking_form?.delivery_option || snapshot.delivery_method || snapshot.delivery_method_id || null
  const reservationPaidAt = bookingMeta.reservation_paid_at || snapshot.reservation_paid_at || null
  const assignedManagerName = order.assigned_manager_name || order.users?.name || null
  const contactValue = customer?.contact_value || snapshotContact.contactValue || null
  const contactMethod = customer?.preferred_channel || snapshotContact.contactMethod || null
  const customerCity = customer?.city || customer?.country || snapshotContact.city || null
  const queueHint = normalizeQueueHint(bookingMeta.queue_hint || snapshot.queue_hint || null)

  const routeFrom = snapshot?.route_from || snapshot?.origin_city || snapshot?.from_city || 'Марбург'
  const routeTo = snapshot?.route_to || snapshot?.destination_city || customerCity || 'Город доставки'
  const customerPayload = customer
    ? {
        ...customer,
        city: customerCity,
        contact_value: contactValue,
        preferred_channel: contactMethod
      }
    : null

  return {
    order: {
      order_id: order.id,
      order_number: order.order_code || order.order_number,
      status: normalizeOrderStatus(order.status) || order.status,
      customer_name: customer?.full_name || customer?.name || customer?.email || null,
      total_price_rub: totalPriceRub,
      booking_amount_rub: bookingAmountRub,
      exchange_rate: exchangeRate,
      delivery_method: deliveryMethod,
      final_price_eur: order.final_price_eur || financials.final_price_eur || null,
      bike_id: order.bike_id || snapshot.bike_id || null,
      bike_snapshot: snapshot,
      assigned_manager: order.assigned_manager || null,
      assigned_manager_name: assignedManagerName,
      reservation_paid_at: reservationPaidAt,
      expert_comment: order.expert_comment || snapshot.expert_comment || null,
      queue_hint: queueHint,
      route_from: routeFrom,
      route_to: routeTo,
      customer: customerPayload
    },
    history,
    logistics,
    inspection,
    customer: customerPayload
  }
}

async function fetchLocalOrderDetails(orderId: string) {
  const rows = await db.query(
    'SELECT * FROM orders WHERE order_code = ? OR id = ? LIMIT 1',
    [orderId, orderId]
  )
  const order = rows && rows[0]
  if (!order) return null

  const customers = await db.query('SELECT * FROM customers WHERE id = ? LIMIT 1', [order.customer_id])
  const customer = customers && customers[0]
  let managerName: string | null = null
  if (order.assigned_manager != null && String(order.assigned_manager).trim() !== '') {
    const managers = await db.query('SELECT name FROM users WHERE id = ? LIMIT 1', [order.assigned_manager])
    managerName = managers?.[0]?.name || null
  }

  const inspection = await getLocalBikeInspection(order.bike_id)

  const historyRows = await db.query(
    'SELECT new_status, old_status, changed_by, created_at FROM order_status_events WHERE order_id = ? ORDER BY created_at DESC',
    [order.id]
  )
  const history = (historyRows || []).map((row: any) => ({
    created_at: row.created_at,
    new_status: row.new_status,
    change_notes: row.change_notes || null
  }))

  const shipments = await db.query('SELECT * FROM shipments WHERE order_id = ?', [order.id])
  const logistics = (shipments || []).map((s: any) => ({
    id: s.id,
    carrier: s.provider,
    tracking_number: s.tracking_number,
    delivery_status: s.delivery_status || s.ruspost_status || null,
    estimated_delivery: s.estimated_delivery_date,
    warehouse_received: Boolean(s.warehouse_received),
    warehouse_photos_received: Boolean(s.warehouse_photos_received),
    ruspost_status: s.ruspost_status
  }))

  return buildOrderPayload({ ...order, assigned_manager_name: managerName }, customer, inspection, logistics, history)
}

async function fetchSupabaseOrderDetails(orderId: string, type: 'code' | 'id') {
  if (!supabase) return null

  let orderQuery = supabase.from('orders').select('*, customers(*), users(name)')
  orderQuery = type === 'id' ? orderQuery.eq('id', orderId) : orderQuery.eq('order_code', orderId)
  const { data: order } = await orderQuery.single()
  if (!order) return null

  let managerName = Array.isArray(order.users) ? order.users[0]?.name : order.users?.name
  if (!managerName && order.assigned_manager) {
    const { data: managerRow } = await supabase
      .from('users')
      .select('name')
      .eq('id', order.assigned_manager)
      .limit(1)
      .maybeSingle()
    managerName = managerRow?.name || null
  }

  const inspection = await fetchLatestInspectionByOrderId(order.id)
  const { data: shipments } = await supabase.from('shipments').select('*').eq('order_id', order.id)

  const logistics = (shipments || []).map((s: any) => ({
    id: s.id,
    carrier: s.carrier || s.provider || null,
    tracking_number: s.tracking_number || null,
    delivery_status: s.delivery_status || null,
    estimated_delivery: s.estimated_delivery,
    warehouse_received: s.warehouse_received,
    warehouse_photos_received: s.warehouse_photos_received,
    ruspost_status: s.ruspost_status
  }))

  return buildOrderPayload({ ...order, assigned_manager_name: managerName }, order.customers, inspection, logistics, [])
}

async function applyReserveSupabase(orderIdentifier: string, now: string, placeholderPaymentId: string) {
  if (!supabase) return null

  const { data: byCode } = await supabase
    .from('orders')
    .select('id, order_code, customer_id, bike_id, status, bike_snapshot, total_price_rub, booking_amount_rub, exchange_rate')
    .eq('order_code', orderIdentifier)
    .maybeSingle()
  const { data: byId } = byCode
    ? { data: null }
    : await supabase
        .from('orders')
        .select('id, order_code, customer_id, bike_id, status, bike_snapshot, total_price_rub, booking_amount_rub, exchange_rate')
        .eq('id', orderIdentifier)
        .maybeSingle()
  const order = byCode || byId
  if (!order) return null

  if (isTerminalStatus(order.status)) {
    const error: any = new Error('Cannot pay reserve for terminal order status')
    error.httpCode = 400
    throw error
  }
  if (isPaidReserveActive(order)) {
    const error: any = new Error('Reserve already paid for this order')
    error.httpCode = 400
    throw error
  }

  if (order.customer_id) {
    const { data: customerOrders, error: customerOrdersError } = await supabase
      .from('orders')
      .select('id,status,bike_snapshot')
      .eq('customer_id', String(order.customer_id))
      .neq('id', order.id)
    if (customerOrdersError) throw customerOrdersError
    const hasAnotherActivePaidReserve = (customerOrders || []).some((item: any) => {
      if (isTerminalStatus(item?.status)) return false
      return isPaidReserveActive(item)
    })
    if (hasAnotherActivePaidReserve) {
      const error: any = new Error('Paid reserve limit reached (max 1 active reserve)')
      error.httpCode = 400
      throw error
    }
  }

  const snapshot = safeJson(order.bike_snapshot) || {}
  const bookingMeta = snapshot.booking_meta || {}
  const financials = snapshot.financials || bookingMeta.financials || {}
  const totalRub = Number(order.total_price_rub || financials.total_price_rub || 0) || 0
  const bookingRub = Number(order.booking_amount_rub || financials.booking_amount_rub || 0) || (totalRub ? Math.ceil(totalRub * 0.02) : null)
  const updatedSnapshot = withReservePaidSnapshot(snapshot, now, placeholderPaymentId, bookingRub)

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: ORDER_STATUS.RESERVE_PAID,
      bike_snapshot: updatedSnapshot,
      booking_amount_rub: bookingRub || order.booking_amount_rub || null
    })
    .eq('id', order.id)
  if (updateError) throw updateError

  try {
    await supabase.from('order_status_events').insert({
      order_id: order.id,
      old_status: order.status || null,
      new_status: ORDER_STATUS.RESERVE_PAID,
      changed_by: null,
      created_at: now
    })
  } catch (eventError) {
    console.warn('Reserve status event warning:', eventError)
  }

  const bikeKey = getOrderBikeKey(order)
  let supersededOrders = 0
  if (bikeKey) {
    const { data: bikeOrders, error: bikeOrdersError } = await supabase
      .from('orders')
      .select('id,order_code,status,bike_snapshot,bike_id')
      .eq('bike_id', bikeKey)
      .neq('id', order.id)
    if (bikeOrdersError) throw bikeOrdersError

    for (const otherOrder of bikeOrders || []) {
      const normalized = normalizeOrderStatus(otherOrder?.status)
      if (!normalized || !FREE_BOOKING_QUEUE_STATUSES.has(normalized)) continue
      if (isPaidReserveActive(otherOrder)) continue
      if (isTerminalStatus(otherOrder?.status)) continue

      const cancelledSnapshot = withSupersededSnapshot(otherOrder?.bike_snapshot, now, order.order_code || String(order.id))
      const { error: cancelError } = await supabase
        .from('orders')
        .update({
          status: ORDER_STATUS.CANCELLED,
          bike_snapshot: cancelledSnapshot
        })
        .eq('id', otherOrder.id)
      if (cancelError) throw cancelError

      try {
        await supabase.from('order_status_events').insert({
          order_id: otherOrder.id,
          old_status: otherOrder.status || null,
          new_status: ORDER_STATUS.CANCELLED,
          changed_by: null,
          created_at: now
        })
      } catch (eventError) {
        console.warn('Supersede status event warning:', eventError)
      }
      supersededOrders += 1
    }
  }

  try {
    await supabase.from('payments').insert({
      order_id: order.id,
      direction: 'incoming',
      role: 'reservation',
      method: 'placeholder_gateway',
      amount: bookingRub ? Number((bookingRub / Number(order.exchange_rate || financials.exchange_rate || 96)).toFixed(2)) : 0,
      currency: 'EUR',
      status: 'paid',
      external_reference: placeholderPaymentId,
      created_by: null,
      created_at: now
    })
  } catch (paymentError) {
    console.warn('Reserve payment insert warning:', paymentError)
  }

  return {
    success: true,
    order_code: order.order_code,
    status: ORDER_STATUS.RESERVE_PAID,
    superseded_orders: supersededOrders,
    payment: {
      id: placeholderPaymentId,
      provider: 'placeholder_gateway',
      status: 'paid',
      paid_at: now,
      amount_rub: bookingRub
    }
  }
}

// Search orders (by code fragment)
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    const limit = Math.min(Number(req.query.limit || 10), 50)
    if (!q) return res.json({ orders: [] })

    try {
      const rows = await db.query(
        'SELECT id, order_code, status, customer_id FROM orders WHERE order_code LIKE ? ORDER BY created_at DESC LIMIT ?',
        [`%${q}%`, limit]
      )
      const orders = []
      for (const row of rows || []) {
        const customerRows = await db.query('SELECT full_name FROM customers WHERE id = ? LIMIT 1', [row.customer_id])
        orders.push({
          order_id: row.id,
          order_number: row.order_code,
          status: row.status,
          customer_name: customerRows?.[0]?.full_name || null
        })
      }
      if (orders.length > 0 || !supabase) {
        return res.json({ orders })
      }
    } catch (localError: any) {
      if (!supabase) throw localError
      console.warn('Orders search local-first fallback warning:', localError?.message || localError)
    }

    const { data } = await supabase
      .from('orders')
      .select('id, order_code, status, customers(full_name)')
      .ilike('order_code', `%${q}%`)
      .limit(limit)
    const orders = (data || []).map((o: any) => ({
      order_id: o.id,
      order_number: o.order_code,
      status: o.status,
      customer_name: o.customers?.full_name || null
    }))
    return res.json({ orders })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal error' })
  }
})

// Track by token (order code or magic token)
router.get('/track/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim()
    if (!token) return res.status(400).json({ error: 'Token required' })

    let details = await fetchLocalOrderDetails(token)
    if (!details) {
      try {
        const rows = await db.query('SELECT id, bike_snapshot FROM orders LIMIT 200')
        for (const row of rows || []) {
          const snapshot = safeJson(row.bike_snapshot) || {}
          if (snapshot.magic_link_token && snapshot.magic_link_token === token) {
            details = await fetchLocalOrderDetails(row.id)
            break
          }
        }
      } catch (localError: any) {
        if (!supabase) throw localError
        console.warn('Orders track local-first fallback warning:', localError?.message || localError)
      }
    }
    if (details) return res.json(details)

    if (supabase) {
      const remoteDetails = await fetchSupabaseOrderDetails(token, 'code')
      if (remoteDetails) return res.json(remoteDetails)
    }

    return res.status(404).json({ error: 'Order not found' })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal error' })
  }
})

// Get order details by code or id
router.get('/:orderId', async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim()
    if (!orderId) return res.status(400).json({ error: 'Order ID required' })

    try {
      const details = await fetchLocalOrderDetails(orderId)
      if (details) return res.json(details)
    } catch (localError: any) {
      if (!supabase) throw localError
      console.warn('Orders details local-first fallback warning:', localError?.message || localError)
    }

    if (supabase) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
      const details = await fetchSupabaseOrderDetails(orderId, isUUID ? 'id' : 'code')
      if (!details) return res.status(404).json({ error: 'Order not found' })
      return res.json(details)
    }

    return res.status(404).json({ error: 'Order not found' })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal error' })
  }
})

// Reserve (mock payment)
router.post('/:orderId/reserve', async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim()
    if (!orderId) return res.status(400).json({ error: 'Order ID required' })

    const now = new Date().toISOString()
    const placeholderPaymentId = `PH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    try {
      const rows = await db.query('SELECT * FROM orders WHERE order_code = ? OR id = ? LIMIT 1', [orderId, orderId])
      const order = rows && rows[0]

      if (order) {
        if (isTerminalStatus(order.status)) {
          return res.status(400).json({ error: 'Cannot pay reserve for terminal order status' })
        }
        if (isPaidReserveActive(order)) {
          return res.status(400).json({ error: 'Reserve already paid for this order' })
        }

        if (order.customer_id) {
          const customerOrders = await db.query(
            'SELECT id, status, bike_snapshot FROM orders WHERE customer_id = ? AND id != ?',
            [order.customer_id, order.id]
          )
          const hasAnotherActivePaidReserve = (customerOrders || []).some((item: any) => {
            if (isTerminalStatus(item?.status)) return false
            return isPaidReserveActive(item)
          })
          if (hasAnotherActivePaidReserve) {
            return res.status(400).json({ error: 'Paid reserve limit reached (max 1 active reserve)' })
          }
        }

        const snapshot = safeJson(order.bike_snapshot) || {}
        const bookingMeta = snapshot.booking_meta || {}
        const financials = snapshot.financials || bookingMeta.financials || {}
        const totalRub = Number(order.total_price_rub || financials.total_price_rub || 0) || 0
        const bookingRub = Number(order.booking_amount_rub || financials.booking_amount_rub || order.booking_price || 0) || (totalRub ? Math.ceil(totalRub * 0.02) : null)
        const updatedSnapshot = withReservePaidSnapshot(snapshot, now, placeholderPaymentId, bookingRub)

        await db.query(
          'UPDATE orders SET status = ?, booking_price = ?, bike_snapshot = ? WHERE id = ?',
          [ORDER_STATUS.RESERVE_PAID, bookingRub, JSON.stringify(updatedSnapshot), order.id]
        )

        await db.query(
          'INSERT INTO order_status_events (id, order_id, old_status, new_status, changed_by, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [uuidv4(), order.id, order.status, ORDER_STATUS.RESERVE_PAID, 'client']
        )

        const bikeKey = getOrderBikeKey(order)
        let supersededOrders = 0
        if (bikeKey) {
          const competingOrders = await db.query(
            'SELECT id, order_code, status, bike_snapshot FROM orders WHERE bike_id = ? AND id != ?',
            [bikeKey, order.id]
          )
          for (const otherOrder of competingOrders || []) {
            const normalized = normalizeOrderStatus(otherOrder?.status)
            if (!normalized || !FREE_BOOKING_QUEUE_STATUSES.has(normalized)) continue
            if (isPaidReserveActive(otherOrder)) continue
            if (isTerminalStatus(otherOrder?.status)) continue

            const cancelledSnapshot = withSupersededSnapshot(otherOrder?.bike_snapshot, now, order.order_code || String(order.id))
            await db.query(
              'UPDATE orders SET status = ?, bike_snapshot = ? WHERE id = ?',
              [ORDER_STATUS.CANCELLED, JSON.stringify(cancelledSnapshot), otherOrder.id]
            )
            await db.query(
              'INSERT INTO order_status_events (id, order_id, old_status, new_status, changed_by, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
              [uuidv4(), otherOrder.id, otherOrder.status, ORDER_STATUS.CANCELLED, 'system']
            )
            supersededOrders += 1
          }
        }

        try {
          await db.query(
            'INSERT INTO payments (id, order_id, direction, role, method, amount, currency, status, external_reference, related_payment_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [
              uuidv4(),
              order.id,
              'incoming',
              'reservation',
              'placeholder_gateway',
              bookingRub ? Number((bookingRub / Number(financials.exchange_rate || 96)).toFixed(2)) : 0,
              'EUR',
              'paid',
              placeholderPaymentId,
              null,
              null
            ]
          )
        } catch (paymentError: any) {
          console.warn('Local reserve payment insert warning:', paymentError?.message || paymentError)
        }

        if (supabase) {
          try {
            await applyReserveSupabase(order.order_code || order.id, now, placeholderPaymentId)
          } catch (syncError: any) {
            console.warn('Reserve remote mirror warning:', syncError?.message || syncError)
          }
        }

        return res.json({
          success: true,
          order_code: order.order_code,
          status: ORDER_STATUS.RESERVE_PAID,
          superseded_orders: supersededOrders,
          payment: {
            id: placeholderPaymentId,
            provider: 'placeholder_gateway',
            status: 'paid',
            paid_at: now,
            amount_rub: bookingRub
          },
          storage_mode: 'local_primary'
        })
      }
    } catch (localError: any) {
      if (!supabase) throw localError
      console.warn('Reserve local-first fallback warning:', localError?.message || localError)
    }

    if (!supabase) {
      return res.status(404).json({ error: 'Order not found' })
    }

    const remoteResult = await applyReserveSupabase(orderId, now, placeholderPaymentId)
    if (!remoteResult) {
      return res.status(404).json({ error: 'Order not found' })
    }
    return res.json({ ...remoteResult, storage_mode: 'supabase_fallback' })
  } catch (error: any) {
    if (error?.httpCode) {
      return res.status(Number(error.httpCode)).json({ error: error.message || 'Request failed' })
    }
    return res.status(500).json({ error: error.message || 'Internal error' })
  }
})

export default router
