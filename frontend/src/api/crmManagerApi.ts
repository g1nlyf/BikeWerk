import { apiGet, apiPost, apiPatch, apiDelete, API_BASE } from '@/api'

function toQuery(params: Record<string, unknown> = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    q.set(key, String(value))
  })
  const str = q.toString()
  return str ? `?${str}` : ''
}

export const crmManagerApi = {
  getManagers() {
    return apiGet('/v1/crm/managers')
  },
  getDashboardStats(params: Record<string, unknown> = {}) {
    return apiGet(`/v1/crm/dashboard/stats${toQuery(params)}`)
  },
  getOrders(filters: Record<string, unknown> = {}) {
    return apiGet(`/v1/crm/orders${toQuery(filters)}`)
  },
  getOrder(orderId: string) {
    return apiGet(`/v1/crm/orders/${encodeURIComponent(orderId)}`)
  },
  updateOrder(orderId: string, payload: Record<string, unknown>) {
    return apiPatch(`/v1/crm/orders/${encodeURIComponent(orderId)}`, payload)
  },
  updateOrderStatus(orderId: string, status: string, note?: string) {
    return apiPatch(`/v1/crm/orders/${encodeURIComponent(orderId)}/status`, { status, note })
  },
  updateOrderManager(orderId: string, managerId: string) {
    return apiPatch(`/v1/crm/orders/${encodeURIComponent(orderId)}/manager`, { manager_id: managerId })
  },
  getCustomers(filters: Record<string, unknown> = {}) {
    return apiGet(`/v1/crm/customers${toQuery(filters)}`)
  },
  getCustomer(customerId: string) {
    return apiGet(`/v1/crm/customers/${encodeURIComponent(customerId)}`)
  },
  updateCustomer(customerId: string, payload: Record<string, unknown>) {
    return apiPatch(`/v1/crm/customers/${encodeURIComponent(customerId)}`, payload)
  },
  getLeads(filters: Record<string, unknown> = {}) {
    return apiGet(`/v1/crm/leads${toQuery(filters)}`)
  },
  getLead(leadId: string) {
    return apiGet(`/v1/crm/leads/${encodeURIComponent(leadId)}`)
  },
  updateLead(leadId: string, payload: Record<string, unknown>) {
    return apiPatch(`/v1/crm/leads/${encodeURIComponent(leadId)}`, payload)
  },
  convertLead(leadId: string) {
    return apiPost(`/v1/crm/leads/${encodeURIComponent(leadId)}/convert`, {})
  },
  getTasks(filters: Record<string, unknown> = {}) {
    return apiGet(`/v1/crm/tasks${toQuery(filters)}`)
  },
  createTask(payload: Record<string, unknown>) {
    return apiPost('/v1/crm/tasks', payload)
  },
  updateTask(taskId: string, payload: Record<string, unknown>) {
    return apiPatch(`/v1/crm/tasks/${encodeURIComponent(taskId)}`, payload)
  },
  deleteTask(taskId: string) {
    return apiDelete(`/v1/crm/tasks/${encodeURIComponent(taskId)}`)
  },

  // Block 1: Interactive Checklist
  getChecklist(orderId: string) {
    return apiGet(`/v1/crm/orders/${encodeURIComponent(orderId)}/checklist`)
  },
  updateChecklistItem(orderId: string, itemId: string, payload: { status?: boolean | null; comment?: string }) {
    return apiPatch(`/v1/crm/orders/${encodeURIComponent(orderId)}/checklist/${encodeURIComponent(itemId)}`, payload)
  },
  uploadChecklistPhotos(orderId: string, itemId: string, photoUrls: string[]) {
    return apiPost(`/v1/crm/orders/${encodeURIComponent(orderId)}/checklist/${encodeURIComponent(itemId)}/photos`, { photo_urls: photoUrls })
  },
  aiRegradeChecklist(orderId: string) {
    return apiPost(`/v1/crm/orders/${encodeURIComponent(orderId)}/checklist/ai-regrade`, {})
  },

  // Block 4: Logistics
  getShipments(orderId: string) {
    return apiGet(`/v1/crm/orders/${encodeURIComponent(orderId)}/shipments`)
  },
  createShipment(orderId: string, payload: { tracking_number?: string; carrier?: string; provider?: string; estimated_delivery?: string; estimated_delivery_date?: string }) {
    return apiPost(`/v1/crm/orders/${encodeURIComponent(orderId)}/shipments`, payload)
  },
  updateShipment(shipmentId: string, payload: { tracking_number?: string; carrier?: string; status?: string; warehouse_received?: boolean; delivery_notes?: string }) {
    return apiPatch(`/v1/crm/shipments/${encodeURIComponent(shipmentId)}`, payload)
  },
  notifyTracking(orderId: string, method: 'email' | 'sms' | 'whatsapp' | 'telegram') {
    return apiPost(`/v1/crm/orders/${encodeURIComponent(orderId)}/notify-tracking`, { method })
  },

  // Block 5: Finance/Transactions
  getTransactions(orderId: string) {
    return apiGet(`/v1/crm/orders/${encodeURIComponent(orderId)}/transactions`)
  },
  addTransaction(orderId: string, payload: { amount: number; type: string; method: string; description?: string; transaction_date?: string }) {
    return apiPost(`/v1/crm/orders/${encodeURIComponent(orderId)}/transactions`, payload)
  },
  deleteTransaction(transactionId: string) {
    return apiDelete(`/v1/crm/transactions/${encodeURIComponent(transactionId)}`)
  },

  // Block 6: Export
  async exportOrders(filters: Record<string, unknown> = {}) {
    const token = (() => {
      try { return localStorage.getItem('authToken') } catch { return null }
    })()
    const q = toQuery(filters)
    return fetch(`${API_BASE}/v1/crm/orders/export${q}`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
  },

  // Block 7: Bulk actions
  bulkUpdateStatus(orderIds: string[], status: string, note?: string) {
    return apiPatch('/v1/crm/orders/bulk/status', { order_ids: orderIds, status, note })
  },
  bulkAssignManager(orderIds: string[], managerId: string) {
    return apiPatch('/v1/crm/orders/bulk/assign', { order_ids: orderIds, manager_id: managerId })
  },

  // AI-ROP workspace
  getAiRopWorkspace(params: Record<string, unknown> = {}) {
    return apiGet(`/v1/crm/ai-rop/workspace${toQuery(params)}`)
  },
  runAiRopCycle(syncLocal = false) {
    return apiPost('/v1/crm/ai-rop/run', { sync_local: syncLocal })
  },
  decideAiRopSignal(signalId: string, payload: { decision: string; note?: string; assignee_id?: string; snooze_until?: string; due_at?: string }) {
    return apiPost(`/v1/crm/ai-rop/signals/${encodeURIComponent(signalId)}/decision`, payload)
  }
}


