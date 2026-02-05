import * as React from 'react'
import { auth } from '@/api'

type User = { id: number; name?: string; email: string; role?: string; phone?: string }

type AuthContextValue = {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; data?: any }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; data?: any }>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Инициализация из localStorage — мгновенная, без мерцания
  const [user, setUser] = React.useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('currentUser')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = React.useState<string | null>(() => {
    try { return localStorage.getItem('authToken') } catch { return null }
  })

  // В фоне валидируем токен, но UI уже стабильный
  React.useEffect(() => {
    if (!token) return
    let mounted = true
    auth.me().then((res) => {
      if (!mounted) return
      if (res?.success && res.user) {
        setUser(res.user)
        localStorage.setItem('currentUser', JSON.stringify(res.user))
      }
    }).catch(() => {})
    return () => { mounted = false }
  }, [token])

  const login = async (email: string, password: string) => {
    try {
      const res = await auth.login(email, password)
      if (res?.success && res.token && res.user) {
        setToken(res.token)
        setUser(res.user)
        return { success: true, data: res }
      }
      return { success: false, error: res?.error || 'Не удалось выполнить операцию', data: res }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Ошибка сети', data: null }
    }
  }

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await auth.register(name, email, password)
      if (res?.success && res.token && res.user) {
        setToken(res.token)
        setUser(res.user)
        return { success: true, data: res }
      }
      return { success: false, error: res?.error || 'Не удалось выполнить операцию', data: res }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Ошибка сети', data: null }
    }
  }

  const logout = async () => {
    await auth.logout()
    setToken(null)
    setUser(null)
  }

  const value: AuthContextValue = { user, token, login, register, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
