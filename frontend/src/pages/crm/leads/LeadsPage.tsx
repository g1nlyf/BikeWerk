import * as React from 'react'
import { crmManagerApi } from '@/api/crmManagerApi'

type Lead = {
  id: string
  status?: string
  created_at?: string
  contact_name?: string
  customer_name?: string
  name?: string
  contact_phone?: string
  contact_value?: string
  contact_email?: string
  email?: string
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'Новый' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'contacted', label: 'Связались' },
  { value: 'qualified', label: 'Квалифицирован' },
  { value: 'converted', label: 'Конвертирован' },
  { value: 'rejected', label: 'Отклонен' }
]

export default function LeadsPage() {
  const [leads, setLeads] = React.useState<Lead[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await crmManagerApi.getLeads({ limit: 50 })
      if (res?.success) setLeads(res.leads || [])
    } catch (e) {
      console.error('Leads load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const updateStatus = async (leadId: string, status: string) => {
    try {
      const res = await crmManagerApi.updateLead(leadId, { status })
      if (res?.success) {
        setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)))
      } else {
        alert('Не удалось обновить статус лида')
      }
    } catch (e) {
      console.error('Lead status update error', e)
      alert('Ошибка при обновлении статуса лида')
    }
  }

  const convertLead = async (leadId: string) => {
    try {
      const res = await crmManagerApi.convertLead(leadId)
      if (res?.success) {
        setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, status: 'converted' } : lead)))
      } else {
        alert('Не удалось конвертировать лид')
      }
    } catch (e) {
      console.error('Lead convert error', e)
      alert('Ошибка при конвертации лида')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-slate-400">Лиды</div>
        <div className="text-lg font-semibold text-[#18181b]">Входящие обращения</div>
      </div>

      <div className="rounded-xl border border-[#e4e4e7] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[680px] w-full text-sm">
          <thead className="bg-[#f4f4f5] text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Лид</th>
              <th className="px-4 py-3 text-left">Статус</th>
              <th className="px-4 py-3 text-left">Создан</th>
              <th className="px-4 py-3 text-left">Действия</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-[#e4e4e7]">
                <td className="px-4 py-3">
                  <div className="text-[#18181b]">{lead.contact_name || lead.customer_name || lead.name || '--'}</div>
                  <div className="text-xs text-slate-500">{lead.contact_phone || lead.contact_value || lead.contact_email || lead.email || '--'}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={lead.status || 'new'}
                    onChange={(e) => updateStatus(lead.id, e.target.value)}
                    className="h-9 rounded-lg border border-[#e4e4e7] bg-white px-2 text-xs"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {lead.created_at ? new Date(lead.created_at).toLocaleDateString('ru-RU') : '--'}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => convertLead(lead.id)}
                    className="rounded-lg border border-[#18181b] px-3 py-1 text-xs text-[#18181b]"
                  >
                    В заказ
                  </button>
                </td>
              </tr>
            ))}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">Лиды не найдены</td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
