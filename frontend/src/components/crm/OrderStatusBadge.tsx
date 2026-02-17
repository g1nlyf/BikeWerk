import * as React from 'react'
import { cn } from '@/lib/utils'
import { getOrderStatusPresentation } from '@/lib/orderLifecycle'

type Props = {
  status?: string | null
  className?: string
}

export default function OrderStatusBadge({ status, className }: Props) {
  const meta = getOrderStatusPresentation(status)
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', meta.badgeClass, className)}>
      {meta.label}
    </span>
  )
}
