import * as React from 'react'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  value: string | number
  delta?: string
  hint?: string
  className?: string
  onClick?: () => void
}

export default function StatsCard({ title, value, delta, hint, className, onClick }: Props) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-slate-400">{title}</div>
        {delta && <span className="text-xs text-slate-500">{delta}</span>}
      </div>
      <div className="mt-3 text-2xl font-semibold text-[#18181b]">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn('rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm text-left hover:border-[#18181b] hover:shadow-md transition cursor-pointer', className)}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={cn('rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm', className)}>
      {content}
    </div>
  )
}

