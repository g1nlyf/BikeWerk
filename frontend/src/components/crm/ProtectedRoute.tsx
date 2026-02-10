import * as React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { auth } from '@/api'

const COMPLETE_PROFILE_PATH = '/crm/complete-profile'
const LOGIN_PATH = '/crm/login'

type Props = {
  allowedRoles?: string[]
}

type CurrentUser = {
  id?: string | number
  email?: string
  role?: string
  must_change_password?: number | boolean
  must_set_email?: number | boolean
}

export default function CRMProtectedRoute({ allowedRoles }: Props) {
  const location = useLocation()
  const [loading, setLoading] = React.useState(true)
  const [user, setUser] = React.useState<CurrentUser | null>(null)

  React.useEffect(() => {
    let mounted = true
    const token = (() => {
      try { return localStorage.getItem('authToken') } catch { return null }
    })()

    if (!token) {
      setLoading(false)
      setUser(null)
      return
    }

    auth.me()
      .then((res: { success?: boolean; user?: CurrentUser }) => {
        if (!mounted) return
        if (res?.success && res.user) {
          setUser(res.user)
          try { localStorage.setItem('currentUser', JSON.stringify(res.user)) } catch { }
        } else {
          setUser(null)
        }
      })
      .catch(() => {
        if (!mounted) return
        setUser(null)
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })

    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5] text-sm text-slate-500">
        Загрузка...
      </div>
    )
  }

  if (!user) {
    return <Navigate to={LOGIN_PATH} state={{ from: location }} replace />
  }

  const needsProfile = Boolean(user.must_change_password || user.must_set_email)
  if (needsProfile && location.pathname !== COMPLETE_PROFILE_PATH) {
    return <Navigate to={COMPLETE_PROFILE_PATH} replace />
  }

  if (!needsProfile && location.pathname === COMPLETE_PROFILE_PATH) {
    return <Navigate to="/crm/dashboard" replace />
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const role = String(user.role || '').toLowerCase()
    const allowed = allowedRoles.map(r => r.toLowerCase())
    if (!allowed.includes(role)) {
      return <Navigate to={LOGIN_PATH} replace />
    }
  }

  return <Outlet />
}
