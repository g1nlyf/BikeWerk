export const ORDER_STATUS = {
  BOOKED: 'booked',
  RESERVE_PAYMENT_PENDING: 'reserve_payment_pending',
  RESERVE_PAID: 'reserve_paid',
  SELLER_CHECK_IN_PROGRESS: 'seller_check_in_progress',
  CHECK_READY: 'check_ready',
  AWAITING_CLIENT_DECISION: 'awaiting_client_decision',
  FULL_PAYMENT_PENDING: 'full_payment_pending',
  FULL_PAYMENT_RECEIVED: 'full_payment_received',
  BIKE_BUYOUT_COMPLETED: 'bike_buyout_completed',
  SELLER_SHIPPED: 'seller_shipped',
  EXPERT_RECEIVED: 'expert_received',
  EXPERT_INSPECTION_IN_PROGRESS: 'expert_inspection_in_progress',
  EXPERT_REPORT_READY: 'expert_report_ready',
  AWAITING_CLIENT_DECISION_POST_INSPECTION: 'awaiting_client_decision_post_inspection',
  WAREHOUSE_RECEIVED: 'warehouse_received',
  WAREHOUSE_REPACKED: 'warehouse_repacked',
  SHIPPED_TO_RUSSIA: 'shipped_to_russia',
  DELIVERED: 'delivered',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatusCode = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_CANCEL_REASON = {
  SUPERSEDED_BY_PAID_RESERVE: 'superseded_by_paid_reserve',
  CLIENT_CHANGED_MIND: 'client_changed_mind',
  BIKE_UNAVAILABLE: 'bike_unavailable',
  SELLER_UNRESPONSIVE: 'seller_unresponsive',
  SELLER_FRAUD_SUSPECTED: 'seller_fraud_suspected',
  QUALITY_MISMATCH: 'quality_mismatch',
  FAILED_SELLER_CHECK: 'failed_seller_check',
  PRICE_OUT_OF_COMPLIANCE: 'price_out_of_compliance',
  COMPLIANCE_BLOCK: 'compliance_block',
  PAYMENT_NOT_RECEIVED: 'payment_not_received',
  DUPLICATE_BOOKING: 'duplicate_booking',
  INTERNAL_SERVICE_FAILURE: 'internal_service_failure',
  LOGISTICS_IMPOSSIBLE: 'logistics_impossible',
  CLIENT_UNREACHABLE: 'client_unreachable',
  OTHER: 'other',
} as const;

const STATUS_ALIASES: Record<string, string> = {
  new: ORDER_STATUS.BOOKED,
  pending_manager: ORDER_STATUS.BOOKED,
  awaiting_deposit: ORDER_STATUS.RESERVE_PAYMENT_PENDING,
  deposit_paid: ORDER_STATUS.RESERVE_PAID,
  awaiting_payment: ORDER_STATUS.FULL_PAYMENT_PENDING,
  under_inspection: ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
  inspection: ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
  hunting: ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
  chat_negotiation: ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
  quality_confirmed: ORDER_STATUS.CHECK_READY,
  quality_degraded: ORDER_STATUS.CHECK_READY,
  negotiation_finished: ORDER_STATUS.CHECK_READY,
  confirmed: ORDER_STATUS.FULL_PAYMENT_PENDING,
  processing: ORDER_STATUS.WAREHOUSE_REPACKED,
  shipped: ORDER_STATUS.SHIPPED_TO_RUSSIA,
  ready_for_shipment: ORDER_STATUS.WAREHOUSE_REPACKED,
  in_transit: ORDER_STATUS.SHIPPED_TO_RUSSIA,
  full_paid: ORDER_STATUS.FULL_PAYMENT_RECEIVED,
  paid_out: ORDER_STATUS.CLOSED,
  refunded: ORDER_STATUS.CANCELLED,
};

type StatusMeta = {
  code: OrderStatusCode;
  label: string;
  shortLabel: string;
  progressStep: number;
  description: string;
  badgeClass: string;
};

export const ORDER_STATUS_META: Record<OrderStatusCode, StatusMeta> = {
  [ORDER_STATUS.BOOKED]: {
    code: ORDER_STATUS.BOOKED,
    label: 'Booked',
    shortLabel: 'Booked',
    progressStep: 1,
    description: 'Free booking has been created.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.RESERVE_PAYMENT_PENDING]: {
    code: ORDER_STATUS.RESERVE_PAYMENT_PENDING,
    label: 'Reserve Payment Pending',
    shortLabel: 'Reserve Pending',
    progressStep: 1,
    description: 'Optional 2% reserve payment is pending.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.RESERVE_PAID]: {
    code: ORDER_STATUS.RESERVE_PAID,
    label: 'Reserve Paid',
    shortLabel: 'Reserve Paid',
    progressStep: 2,
    description: 'Reserve is paid and bike is locked for the client.',
    badgeClass: 'bg-[#18181b] text-white',
  },
  [ORDER_STATUS.SELLER_CHECK_IN_PROGRESS]: {
    code: ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
    label: 'Seller Check In Progress',
    shortLabel: 'Seller Check',
    progressStep: 2,
    description: 'Manager is verifying bike details with seller.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.CHECK_READY]: {
    code: ORDER_STATUS.CHECK_READY,
    label: 'Check Ready',
    shortLabel: 'Check Ready',
    progressStep: 3,
    description: 'Check is complete and ready for client decision.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.AWAITING_CLIENT_DECISION]: {
    code: ORDER_STATUS.AWAITING_CLIENT_DECISION,
    label: 'Awaiting Client Decision',
    shortLabel: 'Client Decision',
    progressStep: 3,
    description: 'Waiting for client confirmation after check.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.FULL_PAYMENT_PENDING]: {
    code: ORDER_STATUS.FULL_PAYMENT_PENDING,
    label: 'Full Payment Pending',
    shortLabel: 'Payment Pending',
    progressStep: 4,
    description: 'Waiting for full payment.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.FULL_PAYMENT_RECEIVED]: {
    code: ORDER_STATUS.FULL_PAYMENT_RECEIVED,
    label: 'Full Payment Received',
    shortLabel: 'Payment Received',
    progressStep: 4,
    description: 'Full payment is received.',
    badgeClass: 'bg-[#18181b] text-white',
  },
  [ORDER_STATUS.BIKE_BUYOUT_COMPLETED]: {
    code: ORDER_STATUS.BIKE_BUYOUT_COMPLETED,
    label: 'Bike Buyout Completed',
    shortLabel: 'Buyout Done',
    progressStep: 5,
    description: 'Bike buyout from seller is completed.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.SELLER_SHIPPED]: {
    code: ORDER_STATUS.SELLER_SHIPPED,
    label: 'Seller Shipped',
    shortLabel: 'Seller Shipped',
    progressStep: 5,
    description: 'Bike was shipped by seller in Europe.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.EXPERT_RECEIVED]: {
    code: ORDER_STATUS.EXPERT_RECEIVED,
    label: 'Expert Received',
    shortLabel: 'Expert Received',
    progressStep: 6,
    description: 'Bike arrived to expert.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.EXPERT_INSPECTION_IN_PROGRESS]: {
    code: ORDER_STATUS.EXPERT_INSPECTION_IN_PROGRESS,
    label: 'Expert Inspection In Progress',
    shortLabel: 'Inspection',
    progressStep: 6,
    description: 'Expert is running 130-point inspection.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.EXPERT_REPORT_READY]: {
    code: ORDER_STATUS.EXPERT_REPORT_READY,
    label: 'Expert Report Ready',
    shortLabel: 'Report Ready',
    progressStep: 6,
    description: 'Inspection report is ready.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.AWAITING_CLIENT_DECISION_POST_INSPECTION]: {
    code: ORDER_STATUS.AWAITING_CLIENT_DECISION_POST_INSPECTION,
    label: 'Awaiting Client Decision Post Inspection',
    shortLabel: 'Client Decision',
    progressStep: 6,
    description: 'Waiting client decision after expert report.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.WAREHOUSE_RECEIVED]: {
    code: ORDER_STATUS.WAREHOUSE_RECEIVED,
    label: 'Warehouse Received',
    shortLabel: 'Warehouse Received',
    progressStep: 7,
    description: 'Bike is received at warehouse.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.WAREHOUSE_REPACKED]: {
    code: ORDER_STATUS.WAREHOUSE_REPACKED,
    label: 'Warehouse Repacked',
    shortLabel: 'Repacked',
    progressStep: 7,
    description: 'Bike was repacked at warehouse.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.SHIPPED_TO_RUSSIA]: {
    code: ORDER_STATUS.SHIPPED_TO_RUSSIA,
    label: 'Shipped To Russia',
    shortLabel: 'Shipped',
    progressStep: 8,
    description: 'Bike was shipped to Russia.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  },
  [ORDER_STATUS.DELIVERED]: {
    code: ORDER_STATUS.DELIVERED,
    label: 'Delivered',
    shortLabel: 'Delivered',
    progressStep: 9,
    description: 'Order is delivered to client.',
    badgeClass: 'bg-[#18181b] text-white',
  },
  [ORDER_STATUS.CLOSED]: {
    code: ORDER_STATUS.CLOSED,
    label: 'Closed',
    shortLabel: 'Closed',
    progressStep: 10,
    description: 'Order is fully closed.',
    badgeClass: 'bg-[#18181b] text-white',
  },
  [ORDER_STATUS.CANCELLED]: {
    code: ORDER_STATUS.CANCELLED,
    label: 'Cancelled',
    shortLabel: 'Cancelled',
    progressStep: 0,
    description: 'Order was cancelled.',
    badgeClass: 'bg-[#e4e4e7] text-[#52525b]',
  },
};

export const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatusCode; label: string }> = Object.values(ORDER_STATUS).map((status) => ({
  value: status,
  label: ORDER_STATUS_META[status].label,
}));

const ORDER_STATUS_META_RU: Record<OrderStatusCode, { label: string; shortLabel: string; description: string }> = {
  [ORDER_STATUS.BOOKED]: {
    label: 'Бронь создана',
    shortLabel: 'Бронь',
    description: 'Бесплатная бронь создана.'
  },
  [ORDER_STATUS.RESERVE_PAYMENT_PENDING]: {
    label: 'Ожидает оплату резерва',
    shortLabel: 'Резерв',
    description: 'Ожидаем оплату резерва 2% (опционально).'
  },
  [ORDER_STATUS.RESERVE_PAID]: {
    label: 'Резерв оплачен',
    shortLabel: 'Резерв оплачен',
    description: 'Резерв оплачен, байк закреплен за клиентом.'
  },
  [ORDER_STATUS.SELLER_CHECK_IN_PROGRESS]: {
    label: 'Проверка продавца',
    shortLabel: 'Проверка',
    description: 'Менеджер проверяет байк у продавца.'
  },
  [ORDER_STATUS.CHECK_READY]: {
    label: 'Проверка завершена',
    shortLabel: 'Проверка готова',
    description: 'Проверка завершена, готово к решению клиента.'
  },
  [ORDER_STATUS.AWAITING_CLIENT_DECISION]: {
    label: 'Ждем решение клиента',
    shortLabel: 'Решение клиента',
    description: 'Ожидаем подтверждение клиента.'
  },
  [ORDER_STATUS.FULL_PAYMENT_PENDING]: {
    label: 'Ожидает полную оплату',
    shortLabel: 'Оплата',
    description: 'Ожидаем полную оплату заказа.'
  },
  [ORDER_STATUS.FULL_PAYMENT_RECEIVED]: {
    label: 'Полная оплата получена',
    shortLabel: 'Оплата получена',
    description: 'Полная оплата получена.'
  },
  [ORDER_STATUS.BIKE_BUYOUT_COMPLETED]: {
    label: 'Выкуп завершен',
    shortLabel: 'Выкуп',
    description: 'Велосипед выкуплен у продавца.'
  },
  [ORDER_STATUS.SELLER_SHIPPED]: {
    label: 'Отправлено продавцом',
    shortLabel: 'Отправлено',
    description: 'Продавец отправил байк.'
  },
  [ORDER_STATUS.EXPERT_RECEIVED]: {
    label: 'Получено экспертом',
    shortLabel: 'Эксперт получил',
    description: 'Байк получен экспертом.'
  },
  [ORDER_STATUS.EXPERT_INSPECTION_IN_PROGRESS]: {
    label: 'Экспертиза в процессе',
    shortLabel: 'Экспертиза',
    description: 'Проводится 130-пунктовая экспертиза.'
  },
  [ORDER_STATUS.EXPERT_REPORT_READY]: {
    label: 'Отчет эксперта готов',
    shortLabel: 'Отчет готов',
    description: 'Отчет эксперта сформирован.'
  },
  [ORDER_STATUS.AWAITING_CLIENT_DECISION_POST_INSPECTION]: {
    label: 'Ждем решение после отчета',
    shortLabel: 'Решение клиента',
    description: 'Ожидаем решение клиента по отчету эксперта.'
  },
  [ORDER_STATUS.WAREHOUSE_RECEIVED]: {
    label: 'Получено на складе',
    shortLabel: 'Склад',
    description: 'Байк получен на складе.'
  },
  [ORDER_STATUS.WAREHOUSE_REPACKED]: {
    label: 'Переупаковано на складе',
    shortLabel: 'Переупаковка',
    description: 'Байк переупакован перед отправкой.'
  },
  [ORDER_STATUS.SHIPPED_TO_RUSSIA]: {
    label: 'Отправлено в РФ',
    shortLabel: 'В пути',
    description: 'Байк отправлен в РФ.'
  },
  [ORDER_STATUS.DELIVERED]: {
    label: 'Доставлено',
    shortLabel: 'Доставлено',
    description: 'Заказ доставлен клиенту.'
  },
  [ORDER_STATUS.CLOSED]: {
    label: 'Закрыто',
    shortLabel: 'Закрыто',
    description: 'Заказ полностью закрыт.'
  },
  [ORDER_STATUS.CANCELLED]: {
    label: 'Отменено',
    shortLabel: 'Отменено',
    description: 'Заказ отменен.'
  },
};

export const ACTIVE_ORDER_STATUSES: OrderStatusCode[] = [
  ORDER_STATUS.BOOKED,
  ORDER_STATUS.RESERVE_PAYMENT_PENDING,
  ORDER_STATUS.RESERVE_PAID,
  ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
  ORDER_STATUS.CHECK_READY,
  ORDER_STATUS.AWAITING_CLIENT_DECISION,
  ORDER_STATUS.FULL_PAYMENT_PENDING,
  ORDER_STATUS.FULL_PAYMENT_RECEIVED,
  ORDER_STATUS.BIKE_BUYOUT_COMPLETED,
  ORDER_STATUS.SELLER_SHIPPED,
  ORDER_STATUS.EXPERT_RECEIVED,
  ORDER_STATUS.EXPERT_INSPECTION_IN_PROGRESS,
  ORDER_STATUS.EXPERT_REPORT_READY,
  ORDER_STATUS.AWAITING_CLIENT_DECISION_POST_INSPECTION,
  ORDER_STATUS.WAREHOUSE_RECEIVED,
  ORDER_STATUS.WAREHOUSE_REPACKED,
  ORDER_STATUS.SHIPPED_TO_RUSSIA,
];

export const CRM_KANBAN_COLUMNS: Array<{ status: OrderStatusCode; label: string; color: string }> = [
  { status: ORDER_STATUS.BOOKED, label: ORDER_STATUS_META[ORDER_STATUS.BOOKED].shortLabel, color: 'border-t-[#18181b]' },
  { status: ORDER_STATUS.SELLER_CHECK_IN_PROGRESS, label: ORDER_STATUS_META[ORDER_STATUS.SELLER_CHECK_IN_PROGRESS].shortLabel, color: 'border-t-[#18181b]' },
  { status: ORDER_STATUS.AWAITING_CLIENT_DECISION, label: ORDER_STATUS_META[ORDER_STATUS.AWAITING_CLIENT_DECISION].shortLabel, color: 'border-t-[#18181b]' },
  { status: ORDER_STATUS.FULL_PAYMENT_PENDING, label: ORDER_STATUS_META[ORDER_STATUS.FULL_PAYMENT_PENDING].shortLabel, color: 'border-t-[#18181b]' },
  { status: ORDER_STATUS.FULL_PAYMENT_RECEIVED, label: ORDER_STATUS_META[ORDER_STATUS.FULL_PAYMENT_RECEIVED].shortLabel, color: 'border-t-[#18181b]' },
  { status: ORDER_STATUS.BIKE_BUYOUT_COMPLETED, label: ORDER_STATUS_META[ORDER_STATUS.BIKE_BUYOUT_COMPLETED].shortLabel, color: 'border-t-[#18181b]' },
  { status: ORDER_STATUS.WAREHOUSE_RECEIVED, label: ORDER_STATUS_META[ORDER_STATUS.WAREHOUSE_RECEIVED].shortLabel, color: 'border-t-[#18181b]' },
  { status: ORDER_STATUS.SHIPPED_TO_RUSSIA, label: ORDER_STATUS_META[ORDER_STATUS.SHIPPED_TO_RUSSIA].shortLabel, color: 'border-t-[#18181b]' },
  { status: ORDER_STATUS.DELIVERED, label: ORDER_STATUS_META[ORDER_STATUS.DELIVERED].shortLabel, color: 'border-t-[#18181b]' },
];

export function normalizeOrderStatus(input: unknown): string | null {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return null;
  const values = Object.values(ORDER_STATUS);
  if (values.includes(raw as (typeof values)[number])) return raw;
  return STATUS_ALIASES[raw] || null;
}

export function getOrderStatusMeta(input: unknown): StatusMeta {
  const normalized = normalizeOrderStatus(input) as OrderStatusCode | null;
  if (normalized && ORDER_STATUS_META[normalized]) return ORDER_STATUS_META[normalized];
  return {
    code: ORDER_STATUS.BOOKED,
    label: String(input || ORDER_STATUS.BOOKED),
    shortLabel: String(input || ORDER_STATUS.BOOKED),
    progressStep: 1,
    description: 'Status in progress.',
    badgeClass: 'bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7]',
  };
}

export function getOrderStatusPresentation(input: unknown): StatusMeta {
  const base = getOrderStatusMeta(input);
  const localized = ORDER_STATUS_META_RU[base.code];
  if (!localized) return base;
  return {
    ...base,
    label: localized.label,
    shortLabel: localized.shortLabel,
    description: localized.description,
  };
}
