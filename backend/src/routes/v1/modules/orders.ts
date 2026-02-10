import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
const { DatabaseManager } = require('../../../js/mysql-config')
const { v4: uuidv4 } = require('uuid')

const router = Router()

const supabaseUrl = process.env.SUPABASE_URL || null
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  null
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null
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

function safeJson(input: any) {
  if (!input) return null
  if (typeof input === 'object') return input
  if (typeof input !== 'string') return null
  try { return JSON.parse(input) } catch { return null }
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
      status: order.status,
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

  const { data: inspection } = await supabase.from('inspections').select('*').eq('order_id', order.id).maybeSingle()
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

// Search orders (by code fragment)
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    const limit = Math.min(Number(req.query.limit || 10), 50)
    if (!q) return res.json({ orders: [] })

    if (supabase) {
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
    }

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

    if (supabase) {
      const details = await fetchSupabaseOrderDetails(token, 'code')
      if (!details) return res.status(404).json({ error: 'Order not found' })
      return res.json(details)
    }

    let details = await fetchLocalOrderDetails(token)
    if (!details) {
      const rows = await db.query('SELECT id, bike_snapshot FROM orders LIMIT 200')
      for (const row of rows || []) {
        const snapshot = safeJson(row.bike_snapshot) || {}
        if (snapshot.magic_link_token && snapshot.magic_link_token === token) {
          details = await fetchLocalOrderDetails(row.id)
          break
        }
      }
    }

    if (!details) return res.status(404).json({ error: 'Order not found' })
    return res.json(details)
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal error' })
  }
})

// Get order details by code or id
router.get('/:orderId', async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim()
    if (!orderId) return res.status(400).json({ error: 'Order ID required' })

    if (supabase) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
      const details = await fetchSupabaseOrderDetails(orderId, isUUID ? 'id' : 'code')
      if (!details) return res.status(404).json({ error: 'Order not found' })
      return res.json(details)
    }

    const details = await fetchLocalOrderDetails(orderId)
    if (!details) return res.status(404).json({ error: 'Order not found' })
    return res.json(details)
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

    if (supabase) {
      const { data: order } = await supabase.from('orders').select('id, order_code, status, bike_snapshot').eq('order_code', orderId).single()
      if (!order) return res.status(404).json({ error: 'Order not found' })

      const snapshot = order.bike_snapshot || {}
      const bookingMeta = snapshot.booking_meta || {}
      bookingMeta.reservation_paid_at = now
      snapshot.booking_meta = bookingMeta

      await supabase.from('orders').update({ status: 'deposit_paid', bike_snapshot: snapshot }).eq('id', order.id)
      return res.json({ success: true, order_code: order.order_code, status: 'deposit_paid' })
    }

    const rows = await db.query('SELECT * FROM orders WHERE order_code = ? OR id = ? LIMIT 1', [orderId, orderId])
    const order = rows && rows[0]
    if (!order) return res.status(404).json({ error: 'Order not found' })

    const snapshot = safeJson(order.bike_snapshot) || {}
    const bookingMeta = snapshot.booking_meta || {}
    const financials = snapshot.financials || bookingMeta.financials || {}
    const totalRub = Number(financials.total_price_rub || 0)
    const bookingRub = Number(financials.booking_amount_rub || 0) || (totalRub ? Math.ceil(totalRub * 0.02) : null)

    bookingMeta.reservation_paid_at = now
    snapshot.booking_meta = bookingMeta

    await db.query(
      'UPDATE orders SET status = ?, booking_price = ?, bike_snapshot = ? WHERE id = ?',
      ['deposit_paid', bookingRub, JSON.stringify(snapshot), order.id]
    )

    await db.query(
      'INSERT INTO order_status_events (id, order_id, old_status, new_status, changed_by, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [uuidv4(), order.id, order.status, 'deposit_paid', 'client']
    )

    return res.json({ success: true, order_code: order.order_code, status: 'deposit_paid' })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal error' })
  }
})

export default router
