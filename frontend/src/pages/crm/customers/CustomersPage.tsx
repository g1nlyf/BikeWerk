import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { crmManagerApi } from '@/api/crmManagerApi'

type Customer = {
  id: string
  full_name?: string
  name?: string
  phone?: string
  email?: string
  city?: string
  contact_value?: string
  preferred_channel?: string
  created_at?: string
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [query, setQuery] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await crmManagerApi.getCustomers({ q: query, limit: 50 })
      if (res?.success) setCustomers(res.customers || [])
    } catch (e) {
      console.error('Customers load error', e)
    } finally {
      setLoading(false)
    }
  }, [query])

  React.useEffect(() => {
    load()
  }, [load])

  const renderContact = (customer: Customer) => {
    const phone = customer.phone
    const email = customer.email
    const fallback = customer.contact_value

    if (phone) {
      return (
        <a
          href={`tel:${phone}`}
          className="text-blue-600 hover:underline"
        >
          {phone}
        </a>
      )
    }

    if (email) {
      return (
        <a
          href={`mailto:${email}`}
          className="text-blue-600 hover:underline"
        >
          {email}
        </a>
      )
    }

    return fallback || '--'
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Клиенты</div>
          <div className="text-lg font-semibold text-[#18181b]">База клиентов</div>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени или контакту"
          className="h-12 w-64 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
        />
      </div>

      <div className="rounded-xl border border-[#e4e4e7] bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f4f4f5] text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Имя</th>
              <th className="px-4 py-3 text-left">Контакт</th>
              <th className="px-4 py-3 text-left">Город</th>
              <th className="px-4 py-3 text-left">Создан</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.id}
                className="border-t border-[#e4e4e7] hover:bg-[#f4f4f5] cursor-pointer transition-colors"
                onClick={() => navigate(`/crm/customers/${customer.id}`)}
              >
                <td className="px-4 py-3 text-[#18181b]">{customer.full_name || customer.name || '--'}</td>
                <td className="px-4 py-3 text-slate-500">{renderContact(customer)}</td>
                <td className="px-4 py-3 text-slate-500">{customer.city || '--'}</td>
                <td className="px-4 py-3 text-slate-500">{customer.created_at ? new Date(customer.created_at).toLocaleDateString('ru-RU') : '--'}</td>
              </tr>
            ))}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">Клиенты не найдены</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
