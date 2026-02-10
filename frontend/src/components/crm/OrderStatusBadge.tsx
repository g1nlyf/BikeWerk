import * as React from 'react'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  awaiting_payment: { label: 'Ожидает оплаты', className: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]' },
  awaiting_deposit: { label: 'Ожидает резерва', className: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]' },
  deposit_paid: { label: 'Резерв оплачен', className: 'bg-[#18181b] text-white' },
  pending_manager: { label: 'Ждет менеджера', className: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]' },
  under_inspection: { label: 'На проверке', className: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]' },
  ready_for_shipment: { label: 'Готов к отправке', className: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]' },
  in_transit: { label: 'В пути', className: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]' },
  delivered: { label: 'Доставлен', className: 'bg-[#18181b] text-white' },
  closed: { label: 'Закрыт', className: 'bg-[#18181b] text-white' },
  cancelled: { label: 'Отменен', className: 'bg-[#e4e4e7] text-[#52525b]' },
  refunded: { label: 'Возврат', className: 'bg-[#e4e4e7] text-[#52525b]' }
}

type Props = {
  status?: string | null
  className?: string
}

export default function OrderStatusBadge({ status, className }: Props) {
  const key = String(status || 'pending_manager')
  const meta = STATUS_LABELS[key] || { label: key, className: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', meta.className, className)}>
      {meta.label}
    </span>
  )
}
