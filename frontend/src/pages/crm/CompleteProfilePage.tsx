import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '@/api'

type CompleteProfileResponse = {
  success?: boolean
  error?: string
}

export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('currentUser')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.email) setEmail(parsed.email)
      }
    } catch {}
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов')
      return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают')
      return
    }
    setLoading(true)
    try {
      const res = await auth.completeProfile(email, password) as CompleteProfileResponse
      if (!res?.success) {
        setError(res?.error || 'Не удалось обновить профиль')
        return
      }
      navigate('/crm/dashboard', { replace: true })
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
          <h1 className="mt-2 text-2xl font-semibold text-[#18181b]">Завершение профиля</h1>
          <p className="mt-1 text-sm text-slate-500">Укажите email и новый пароль</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-4 text-sm outline-none focus:border-[#18181b]"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Новый пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-4 text-sm outline-none focus:border-[#18181b]"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Подтверждение пароля</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  )
}
