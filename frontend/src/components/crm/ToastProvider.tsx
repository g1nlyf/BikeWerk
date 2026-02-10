import * as React from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

type ToastItem = {
  id: string
  type: ToastType
  message: string
}

type ToastContextValue = {
  push: (type: ToastType, message: string) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = React.createContext<ToastContextValue>({
  push: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {}
})

export function useToast() {
  return React.useContext(ToastContext)
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-slate-200 bg-white text-slate-700'
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])

  const push = React.useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setItems((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setItems((prev) => prev.filter((toast) => toast.id !== id))
    }, 4000)
  }, [])

  const value = React.useMemo<ToastContextValue>(() => ({
    push,
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    warning: (message) => push('warning', message),
    info: (message) => push('info', message)
  }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-6 right-6 z-50 flex w-[320px] flex-col gap-3">
        {items.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${TYPE_STYLES[toast.type]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
