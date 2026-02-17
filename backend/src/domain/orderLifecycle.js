const ORDER_STATUS = Object.freeze({
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
    CANCELLED: 'cancelled'
});

const ORDER_CANCEL_REASON = Object.freeze({
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
    OTHER: 'other'
});

const STATUS_ALIASES = Object.freeze({
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
    refunded: ORDER_STATUS.CANCELLED
});

const ALL_ORDER_STATUSES = Object.freeze(Object.values(ORDER_STATUS));
const TERMINAL_ORDER_STATUSES = Object.freeze([
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.CLOSED,
    ORDER_STATUS.CANCELLED
]);

const TRANSITIONS = Object.freeze({
    [ORDER_STATUS.BOOKED]: [
        ORDER_STATUS.RESERVE_PAYMENT_PENDING,
        ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.RESERVE_PAYMENT_PENDING]: [
        ORDER_STATUS.RESERVE_PAID,
        ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.RESERVE_PAID]: [
        ORDER_STATUS.SELLER_CHECK_IN_PROGRESS,
        ORDER_STATUS.FULL_PAYMENT_PENDING,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.SELLER_CHECK_IN_PROGRESS]: [
        ORDER_STATUS.CHECK_READY,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.CHECK_READY]: [
        ORDER_STATUS.AWAITING_CLIENT_DECISION,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.AWAITING_CLIENT_DECISION]: [
        ORDER_STATUS.FULL_PAYMENT_PENDING,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.FULL_PAYMENT_PENDING]: [
        ORDER_STATUS.FULL_PAYMENT_RECEIVED,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.FULL_PAYMENT_RECEIVED]: [
        ORDER_STATUS.BIKE_BUYOUT_COMPLETED,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.BIKE_BUYOUT_COMPLETED]: [
        ORDER_STATUS.SELLER_SHIPPED,
        ORDER_STATUS.WAREHOUSE_RECEIVED,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.SELLER_SHIPPED]: [
        ORDER_STATUS.EXPERT_RECEIVED,
        ORDER_STATUS.WAREHOUSE_RECEIVED,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.EXPERT_RECEIVED]: [
        ORDER_STATUS.EXPERT_INSPECTION_IN_PROGRESS,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.EXPERT_INSPECTION_IN_PROGRESS]: [
        ORDER_STATUS.EXPERT_REPORT_READY,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.EXPERT_REPORT_READY]: [
        ORDER_STATUS.AWAITING_CLIENT_DECISION_POST_INSPECTION,
        ORDER_STATUS.WAREHOUSE_RECEIVED,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.AWAITING_CLIENT_DECISION_POST_INSPECTION]: [
        ORDER_STATUS.WAREHOUSE_RECEIVED,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.WAREHOUSE_RECEIVED]: [
        ORDER_STATUS.WAREHOUSE_REPACKED,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.WAREHOUSE_REPACKED]: [
        ORDER_STATUS.SHIPPED_TO_RUSSIA,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.SHIPPED_TO_RUSSIA]: [
        ORDER_STATUS.DELIVERED,
        ORDER_STATUS.CANCELLED
    ],
    [ORDER_STATUS.DELIVERED]: [
        ORDER_STATUS.CLOSED
    ],
    [ORDER_STATUS.CLOSED]: [],
    [ORDER_STATUS.CANCELLED]: []
});

function normalizeOrderStatus(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return null;
    if (ALL_ORDER_STATUSES.includes(raw)) return raw;
    return STATUS_ALIASES[raw] || null;
}

function normalizeCancelReason(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return ORDER_CANCEL_REASON.OTHER;
    const valid = Object.values(ORDER_CANCEL_REASON);
    return valid.includes(raw) ? raw : ORDER_CANCEL_REASON.OTHER;
}

function canTransition(fromStatus, toStatus) {
    const from = normalizeOrderStatus(fromStatus);
    const to = normalizeOrderStatus(toStatus);
    if (!from || !to) return false;
    if (from === to) return true;
    const next = TRANSITIONS[from] || [];
    return next.includes(to);
}

module.exports = {
    ORDER_STATUS,
    ORDER_CANCEL_REASON,
    ALL_ORDER_STATUSES,
    TERMINAL_ORDER_STATUSES,
    STATUS_ALIASES,
    TRANSITIONS,
    normalizeOrderStatus,
    normalizeCancelReason,
    canTransition
};
