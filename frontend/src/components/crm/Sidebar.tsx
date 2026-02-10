import * as React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutGrid, ClipboardList, Users, UserPlus, CheckSquare, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Дашборд', path: '/crm/dashboard', icon: LayoutGrid },
  { label: 'Заказы', path: '/crm/orders', icon: ClipboardList },
  { label: 'Клиенты', path: '/crm/customers', icon: Users },
  { label: 'Лиды', path: '/crm/leads', icon: UserPlus },
  { label: 'Задачи', path: '/crm/tasks', icon: CheckSquare }
]

type Props = {
  user?: { name?: string; email?: string; role?: string } | null
  onLogout: () => void
}

export default function CRMSidebar({ user, onLogout }: Props) {
  return (
    <aside className="w-full md:w-64 bg-[#18181b] text-white flex flex-col justify-between md:rounded-r-2xl md:shadow-lg">
      <div className="px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
            <span className="text-lg font-semibold">BW</span>
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-white/60">BikeWerk</div>
            <div className="text-lg font-semibold">CRM</div>
          </div>
        </div>
        <nav className="mt-8 flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-white text-[#18181b]' : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>

      <div className="px-6 py-6 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold">
            {(user?.name || user?.email || 'M').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user?.name || 'Менеджер'}</div>
            <div className="text-xs text-white/60 truncate">{user?.email || user?.role || ''}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs uppercase tracking-wide text-white/80 hover:text-white hover:bg-white/20 transition"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
      </div>
    </aside>
  )
}
