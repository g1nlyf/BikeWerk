import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '@/api'

type LoginResponse = {
  success?: boolean
  error?: string
  user?: { must_change_password?: number | boolean; must_set_email?: number | boolean }
  data?: { user?: { must_change_password?: number | boolean; must_set_email?: number | boolean } }
}

export default function CRMLoginPage() {
  const navigate = useNavigate()
  const [login, setLogin] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await auth.login(login, password) as LoginResponse
      if (!result?.success) {
        setError(result?.error || 'Ошибка входа')
        return
      }
      const user = result?.data?.user || result?.user
      const needsProfile = Boolean(user?.must_change_password || user?.must_set_email)
      navigate(needsProfile ? '/crm/complete-profile' : '/crm/dashboard', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка сети'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f4f5] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">BikeWerk</div>
          <h1 className="mt-2 text-2xl font-semibold text-[#18181b]">Вход в CRM</h1>
          <p className="mt-1 text-sm text-slate-500">Используйте email или телефон менеджера</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Логин</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="email или телефон"
              className="mt-2 h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-4 text-sm outline-none focus:border-[#18181b]"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              className="mt-2 h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-4 text-sm outline-none focus:border-[#18181b]"
              required
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-lg bg-[#18181b] text-white text-sm font-medium hover:bg-black disabled:opacity-70"
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
