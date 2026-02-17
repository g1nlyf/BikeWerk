import * as React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import CRMHeader from '@/components/crm/Header'
import CRMSidebar from '@/components/crm/Sidebar'
import { ToastProvider } from '@/components/crm/ToastProvider'
import { auth } from '@/api'

type CurrentUser = {
  id?: string | number
  name?: string
  email?: string
  role?: string
  must_change_password?: number | boolean
  must_set_email?: number | boolean
}

export default function CRMLayout() {
  const navigate = useNavigate()
  const [user, setUser] = React.useState<CurrentUser | null>(() => {
    try {
      const raw = localStorage.getItem('currentUser')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  React.useEffect(() => {
    let mounted = true
    auth.me().then((res: { success?: boolean; user?: CurrentUser }) => {
      if (!mounted) return
      if (res?.success && res.user) {
        setUser(res.user)
        try { localStorage.setItem('currentUser', JSON.stringify(res.user)) } catch { }
      }
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  const handleLogout = async () => {
    await auth.logout()
    navigate('/crm/login')
  }

  return (
    <ToastProvider>
      <div
        className="min-h-screen bg-[#f4f4f5] text-[#18181b] overflow-x-hidden"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif' }}
      >
        <div className="flex flex-col md:flex-row min-h-screen">
          <CRMSidebar user={user} onLogout={handleLogout} />
          <div className="flex-1 flex flex-col">
            <CRMHeader />
            <main className="flex-1 p-3 sm:p-4 md:p-8">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}

