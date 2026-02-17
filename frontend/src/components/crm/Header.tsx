import * as React from 'react'
import { useLocation } from 'react-router-dom'
import { Search, Bell } from 'lucide-react'

const labelMap: Record<string, string> = {
  dashboard: 'Дашборд',
  orders: 'Заказы',
  customers: 'Клиенты',
  leads: 'Лиды',
  tasks: 'Задачи',
  'complete-profile': 'Профиль'
}

type Props = {
  onSearch?: (value: string) => void
}

export default function CRMHeader({ onSearch }: Props) {
  const location = useLocation()
  const [query, setQuery] = React.useState('')

  const crumbs = location.pathname
    .replace('/crm', '')
    .split('/')
    .filter(Boolean)
    .map((part) => labelMap[part] || part)

  const breadcrumb = crumbs.length ? ['CRM', ...crumbs] : ['CRM', 'Дашборд']

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#e4e4e7]">
      <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
          {breadcrumb.map((item, idx) => (
            <React.Fragment key={`${item}-${idx}`}>
              <span className={idx === breadcrumb.length - 1 ? 'text-[#18181b] font-medium' : ''}>{item}</span>
              {idx < breadcrumb.length - 1 && <span className="text-slate-300">/</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                onSearch?.(e.target.value)
              }}
              placeholder="Поиск заказов"
              className="h-11 w-full min-w-0 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] pl-9 pr-3 text-sm outline-none focus:border-[#18181b] md:w-64"
            />
          </div>
          <button type="button" className="hidden h-11 w-11 rounded-xl border border-[#e4e4e7] bg-white items-center justify-center text-slate-500 hover:text-[#18181b] sm:flex">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
