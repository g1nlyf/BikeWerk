import * as React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronsRight,
  Cpu,
  DollarSign,
  ExternalLink,
  Gauge,
  LineChart,
  Loader2,
  LogOut,
  Network,
  RefreshCw,
  Rocket,
  Settings,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiGet, apiPatch, apiPost } from '@/api';
import { useAuth } from '@/lib/auth';
import { ORDER_STATUS, normalizeOrderStatus } from '@/lib/orderLifecycle';
import { cn } from '@/lib/utils';

type Persona = 'simple' | 'ceo' | 'cto';
type Period = '7d' | '30d' | '90d';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

type JsonRecord = Record<string, unknown>;

type WorkspaceAction = {
  id: string;
  severity: Severity;
  title: string;
  insight: string;
  target: string;
  action_label: string;
  signal_id?: string;
  signal_status?: string;
  assigned_to?: string | null;
};

type AiSignal = {
  id: string;
  signal_type: string;
  source: string;
  severity: Severity | string;
  status: string;
  owner_circle: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  insight: string;
  target: string | null;
  assigned_to: string | null;
  sla_due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MiniOrder = {
  order_id: string;
  order_code: string | null;
  status: string | null;
  created_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  preferred_channel: string | null;
  total_amount_eur: number;
  margin_eur: number;
  risk_score: number;
  risk_band: string;
};

type WorkspacePayload = {
  success: boolean;
  window?: {
    period?: string;
    days?: number;
    since?: string;
    generated_at?: string;
  };
  ceo?: {
    kpi?: JsonRecord;
    comparison?: JsonRecord;
    narrative?: string;
    action_center?: WorkspaceAction[];
    quick_summary?: JsonRecord;
    simple_pulse?: JsonRecord;
    finance?: {
      daily?: Array<{ day: string; revenue: number; costs: number; margin: number; orders: number }>;
      cashflow_forecast?: {
        horizon_days?: number;
        assumptions?: JsonRecord;
        scenarios?: {
          conservative?: JsonRecord;
          base?: JsonRecord;
          aggressive?: JsonRecord;
        };
      };
    };
    funnel?: {
      journey?: JsonRecord;
      ceo_flow?: Array<{ stage?: string; sessions?: number; conversionPct?: number }>;
      loss_points?: Array<{ stageFrom?: string; stageTo?: string; conversionPct?: number; lossPct?: number }>;
    };
    traffic?: {
      growth_overview?: JsonRecord | null;
      top_channels?: Array<JsonRecord>;
      top_campaigns?: Array<JsonRecord>;
    };
    partners?: {
      links?: Array<JsonRecord>;
      total?: number;
    };
    kanban?: {
      lanes?: Array<JsonRecord>;
      totals?: {
        current?: JsonRecord;
        previous?: JsonRecord;
      };
    };
    managers?: Array<JsonRecord>;
    margin_leak_detector?: Array<JsonRecord>;
    deal_risk_radar?: Array<JsonRecord>;
    ai_signals?: AiSignal[];
    mini_crm?: {
      orders?: MiniOrder[];
      leads?: Array<JsonRecord>;
      tasks?: Array<JsonRecord>;
    };
  };
  cto?: {
    health?: JsonRecord;
    modules?: JsonRecord;
    guardrails?: JsonRecord | null;
    anomalies?: Array<JsonRecord>;
    incidents?: Array<JsonRecord>;
    test_logs?: Array<JsonRecord>;
    recent_logs?: Array<JsonRecord>;
  };
  error?: string;
};

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
];

const CRM_STATUS_OPTIONS = [
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
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.CLOSED,
];

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function formatEuro(value: unknown): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(num(value));
}

function formatPct(value: unknown): string {
  return `${num(value).toFixed(1)}%`;
}

function formatDate(value: unknown): string {
  const raw = str(value);
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function severityTone(severity: string): string {
  const s = severity.toLowerCase();
  if (s === 'critical') return 'bg-rose-100 text-rose-800 border-rose-200';
  if (s === 'high') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (s === 'medium') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (s === 'low') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function statusLabel(status: string | null): string {
  const key = normalizeOrderStatus(status) || String(status || '').toLowerCase();
  const map: Record<string, string> = {
    booked: 'Забронирован',
    reserve_payment_pending: 'Ожидание предоплаты',
    reserve_paid: 'Предоплата получена',
    seller_check_in_progress: 'Проверка у продавца',
    check_ready: 'Проверка завершена',
    awaiting_client_decision: 'Ожидание решения клиента',
    full_payment_pending: 'Ожидание полной оплаты',
    full_payment_received: 'Полная оплата получена',
    bike_buyout_completed: 'Выкуп завершен',
    seller_shipped: 'Продавец отправил',
    expert_received: 'Получено экспертом',
    expert_inspection_in_progress: 'Проверка экспертом',
    expert_report_ready: 'Отчет эксперта готов',
    awaiting_client_decision_post_inspection: 'Ожидание решения после проверки',
    warehouse_received: 'Получено на складе',
    warehouse_repacked: 'Переупаковано на складе',
    shipped_to_russia: 'Отправлено в РФ',
    delivered: 'Доставлено',
    cancelled: 'Отменен',
    closed: 'Закрыт',

    // Legacy aliases for historical rows.
    new: 'Новый',
    pending_manager: 'Ожидает менеджера',
    under_inspection: 'На проверке',
    awaiting_payment: 'Ожидание полной оплаты',
    awaiting_deposit: 'Ожидание предоплаты',
    deposit_paid: 'Предоплата получена',
    full_paid: 'Полная оплата получена',
    ready_for_shipment: 'Готово к отправке',
    in_transit: 'В пути',
    refunded: 'Возврат',
  };
  return map[key] || (status || '—');
}

function riskToneClass(riskBand: string): string {
  const key = String(riskBand || '').toLowerCase();
  if (key === 'critical') return 'bg-rose-100 text-rose-800 border-rose-200';
  if (key === 'high') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (key === 'medium') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
}

function SectionCard({
  id,
  title,
  subtitle,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('rounded-3xl border border-slate-200 bg-white/90 p-4 sm:p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>{title}</span>
        {icon}
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function formatDelta(value: unknown): string {
  const numeric = num(value, 0);
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(1)}%`;
}

function deltaTone(value: unknown): string {
  const numeric = num(value, 0);
  if (numeric > 0) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (numeric < 0) return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function comparisonRow(comparison: JsonRecord | null, key: string): JsonRecord | null {
  return asRecord(comparison?.[key]);
}

function buildDailyTrend(
  rows: Array<{ day: string; revenue: number; costs: number; margin: number; orders: number }>,
  period: Period
): Array<{ day: string; revenue: number; margin: number; costs: number; orders: number }> {
  const map = new Map<string, { day: string; revenue: number; margin: number; costs: number; orders: number }>();
  for (const row of rows) {
    const day = str(row?.day);
    if (!day) continue;
    map.set(day, {
      day,
      revenue: num(row?.revenue, 0),
      margin: num(row?.margin, 0),
      costs: num(row?.costs, 0),
      orders: num(row?.orders, 0),
    });
  }
  const count = period === '7d' ? 7 : period === '90d' ? 12 : 10;
  const step = period === '90d' ? 7 : 1;
  const out: Array<{ day: string; revenue: number; margin: number; costs: number; orders: number }> = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * step);
    const key = d.toISOString().slice(0, 10);
    const existing = map.get(key);
    out.push(existing || { day: key, revenue: 0, margin: 0, costs: 0, orders: 0 });
  }
  return out;
}

function buildFlowStageRows(
  lossPoints: JsonRecord[],
  totalOrders: number
): Array<{ stage: string; count: number; conversionPct: number }> {
  if (lossPoints.length) {
    const first = asRecord(lossPoints[0]);
    const startFrom = num(first?.from, 0);
    const rows: Array<{ stage: string; count: number; conversionPct: number }> = [];
    if (startFrom > 0) {
      rows.push({ stage: str(first?.stageFrom, 'sessions'), count: startFrom, conversionPct: 100 });
    }
    for (const point of lossPoints) {
      const rec = asRecord(point);
      rows.push({
        stage: str(rec?.stageTo, 'stage'),
        count: num(rec?.to, 0),
        conversionPct: num(rec?.conversionPct, 0),
      });
    }
    return rows.slice(0, 6);
  }
  const safeOrders = Math.max(1, totalOrders);
  return [
    { stage: 'leads', count: safeOrders * 5, conversionPct: 100 },
    { stage: 'offers', count: safeOrders * 3, conversionPct: 60 },
    { stage: 'orders', count: safeOrders, conversionPct: 33 },
  ];
}

function buildTrafficRows(topChannels: JsonRecord[], partners: JsonRecord[]): Array<{ label: string; sessions: number; conversionPct: number }> {
  const channelRows = topChannels
    .map((row) => {
      const rec = asRecord(row);
      const source = str(rec?.source, '');
      const medium = str(rec?.medium, '');
      const label = [source || 'direct', medium || 'organic'].join(' / ');
      const sessions = num(rec?.sessions, 0);
      const conv = num(rec?.conversionPct, num(rec?.orderPct, 0));
      return { label, sessions, conversionPct: conv };
    })
    .filter((row) => row.sessions > 0)
    .slice(0, 6);

  if (channelRows.length) return channelRows;

  const partnerRows = partners
    .map((partner) => {
      const rec = asRecord(partner);
      const stats = asRecord(rec?.stats);
      return {
        label: str(rec?.channelName, 'partner'),
        sessions: num(stats?.sessions, 0),
        conversionPct: num(stats?.orderPct, 0),
      };
    })
    .filter((row) => row.sessions > 0)
    .slice(0, 6);

  if (partnerRows.length) return partnerRows;

  return [{ label: 'Ð”Ð°Ð½Ð½Ñ‹Ñ… Ð¿Ð¾ ÐºÐ°Ð½Ð°Ð»Ð°Ð¼ Ð¿Ð¾ÐºÐ° Ð½ÐµÑ‚', sessions: 0, conversionPct: 0 }];
}

const MOJIBAKE_PATTERN = /[ÐÑÂÃâ]/;
const MOJIBAKE_ATTRIBUTES: string[] = ['title', 'placeholder', 'aria-label'];

const CP1252_UNICODE_TO_BYTE: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  'ˆ': 0x88,
  '‰': 0x89,
  'Š': 0x8a,
  '‹': 0x8b,
  'Œ': 0x8c,
  'Ž': 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  'š': 0x9a,
  '›': 0x9b,
  'œ': 0x9c,
  'ž': 0x9e,
  'Ÿ': 0x9f,
};

function decodeCp1252Utf8(value: string): string {
  try {
    const bytes: number[] = [];
    for (const char of value) {
      const code = char.charCodeAt(0);
      if (code <= 0xff) {
        bytes.push(code);
        continue;
      }
      const mapped = CP1252_UNICODE_TO_BYTE[char];
      if (typeof mapped === 'number') {
        bytes.push(mapped);
        continue;
      }
      return value;
    }

    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}

function decodeMojibake(value: string): string {
  if (!value || !MOJIBAKE_PATTERN.test(value)) return value;

  let decoded = value;
  for (let i = 0; i < 2; i += 1) {
    const next = decodeCp1252Utf8(decoded);
    if (next === decoded) break;
    decoded = next;
    if (!MOJIBAKE_PATTERN.test(decoded)) break;
  }

  const beforeNoise = (value.match(/[ÐÑÂÃâ]/g) || []).length;
  const afterNoise = (decoded.match(/[ÐÑÂÃâ]/g) || []).length;
  if (/[А-Яа-яЁё€Δ]/.test(decoded) || afterNoise < beforeNoise) {
    return decoded;
  }
  return value;
}

function normalizeBrokenText(root: HTMLElement | null): void {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const original = textNode.nodeValue || '';
    const decoded = decodeMojibake(original);
    if (decoded !== original) {
      textNode.nodeValue = decoded;
    }
    node = walker.nextNode();
  }

  const elements = root.querySelectorAll<HTMLElement>('*');
  for (const element of elements) {
    for (const attribute of MOJIBAKE_ATTRIBUTES) {
      const original = element.getAttribute(attribute);
      if (!original) continue;
      const decoded = decodeMojibake(original);
      if (decoded !== original) {
        element.setAttribute(attribute, decoded);
      }
    }
  }
}

export function AdminMobileDashboard() {
  const { user, logout } = useAuth();
  const dashboardRef = React.useRef<HTMLDivElement | null>(null);

  const [persona, setPersona] = React.useState<Persona>('simple');
  const [period, setPeriod] = React.useState<Period>('30d');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>('');
  const [notice, setNotice] = React.useState<string>('');
  const [workspace, setWorkspace] = React.useState<WorkspacePayload | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string>('');
  const [signalBusyId, setSignalBusyId] = React.useState<string>('');
  const [runningTest, setRunningTest] = React.useState<string>('');
  const [partnerForm, setPartnerForm] = React.useState({ channelName: '', codeWord: '', targetPath: '/catalog' });
  const [partnerBusy, setPartnerBusy] = React.useState(false);

  const loadWorkspace = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiGet(`/admin/workspace?period=${period}`);
      const rec = asRecord(payload);
      if (!rec || rec.success === false) {
        throw new Error(str(rec?.error, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð·Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ workspace'));
      }
      setWorkspace(payload as WorkspacePayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ÐžÑˆÐ¸Ð±ÐºÐ° Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ¸ workspace');
    } finally {
      setLoading(false);
    }
  }, [period]);

  React.useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  React.useEffect(() => {
    const root = dashboardRef.current;
    if (!root) return undefined;

    let frameId = 0;
    const runNormalize = () => {
      frameId = 0;
      normalizeBrokenText(root);
    };

    runNormalize();

    const observer = new MutationObserver(() => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(runNormalize);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: MOJIBAKE_ATTRIBUTES,
    });

    return () => {
      observer.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  const openPath = React.useCallback((path: string) => {
    window.location.href = path;
  }, []);

  const handleOrderStatusChange = React.useCallback(async (orderId: string, nextStatus: string) => {
    setUpdatingOrderId(orderId);
    setNotice('');
    try {
      const payload = await apiPatch(`/v1/crm/orders/${encodeURIComponent(orderId)}/status`, { status: nextStatus });
      const rec = asRecord(payload);
      if (!rec || rec.success === false) {
        throw new Error(str(rec?.error, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ð±Ð½Ð¾Ð²Ð¸Ñ‚ÑŒ ÑÑ‚Ð°Ñ‚ÑƒÑ Ð·Ð°ÐºÐ°Ð·Ð°'));
      }
      setNotice(`Ð¡Ñ‚Ð°Ñ‚ÑƒÑ Ð·Ð°ÐºÐ°Ð·Ð° Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½: ${nextStatus}`);
      await loadWorkspace();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'ÐžÑˆÐ¸Ð±ÐºÐ° Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ ÑÑ‚Ð°Ñ‚ÑƒÑÐ°');
    } finally {
      setUpdatingOrderId('');
    }
  }, [loadWorkspace]);

  const handleSignalDecision = React.useCallback(async (
    signalId: string,
    decision: 'approve' | 'reject' | 'reassign' | 'snooze' | 'resolve'
  ) => {
    setSignalBusyId(signalId);
    setNotice('');
    try {
      const payload: Record<string, unknown> = { decision };
      if (decision === 'reassign') {
        const assigneeId = window.prompt('ID менеджера для назначения сигнала');
        if (!assigneeId || !assigneeId.trim()) {
          setSignalBusyId('');
          return;
        }
        payload.assignee_id = assigneeId.trim();
      }
      if (decision === 'snooze') {
        payload.snooze_until = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      }

      const response = await apiPost(`/admin/ai-signals/${encodeURIComponent(signalId)}/decision`, payload);
      const rec = asRecord(response);
      if (!rec || rec.success === false) {
        throw new Error(str(rec?.error, 'Не удалось применить решение по сигналу'));
      }
      setNotice(`Сигнал обновлен: ${decision}`);
      await loadWorkspace();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Ошибка решения по сигналу');
    } finally {
      setSignalBusyId('');
    }
  }, [loadWorkspace]);

  const handlePartnerCreate = React.useCallback(async () => {
    if (!partnerForm.channelName.trim()) {
      setNotice('Ð£ÐºÐ°Ð¶Ð¸Ñ‚Ðµ Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ðµ ÐºÐ°Ð½Ð°Ð»Ð° Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€Ð°');
      return;
    }
    setPartnerBusy(true);
    setNotice('');
    try {
      const payload = await apiPost('/admin/referrals', partnerForm);
      const rec = asRecord(payload);
      if (!rec || rec.success === false) {
        throw new Error(str(rec?.error, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ ÑÐ¾Ð·Ð´Ð°Ñ‚ÑŒ Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€ÑÐºÑƒÑŽ ÑÑÑ‹Ð»ÐºÑƒ'));
      }
      setNotice('ÐŸÐ°Ñ€Ñ‚Ð½ÐµÑ€ÑÐºÐ°Ñ ÑÑÑ‹Ð»ÐºÐ° ÑÐ¾Ð·Ð´Ð°Ð½Ð°');
      setPartnerForm({ channelName: '', codeWord: '', targetPath: '/catalog' });
      await loadWorkspace();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'ÐžÑˆÐ¸Ð±ÐºÐ° ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€Ð°');
    } finally {
      setPartnerBusy(false);
    }
  }, [loadWorkspace, partnerForm]);

  const handlePartnerToggle = React.useCallback(async (partnerId: number, isActive: boolean) => {
    setPartnerBusy(true);
    setNotice('');
    try {
      const payload = await apiPatch(`/admin/referrals/${partnerId}`, { isActive });
      const rec = asRecord(payload);
      if (!rec || rec.success === false) {
        throw new Error(str(rec?.error, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ð±Ð½Ð¾Ð²Ð¸Ñ‚ÑŒ Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€Ð°'));
      }
      setNotice('Ð¡Ñ‚Ð°Ñ‚ÑƒÑ Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€Ð° Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½');
      await loadWorkspace();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'ÐžÑˆÐ¸Ð±ÐºÐ° Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€Ð°');
    } finally {
      setPartnerBusy(false);
    }
  }, [loadWorkspace]);

  const handleRunTest = React.useCallback(async (testType: string) => {
    setRunningTest(testType);
    setNotice('');
    try {
      const payload = await apiPost('/admin/tests/run', { testType });
      const rec = asRecord(payload);
      if (!rec || rec.error) {
        throw new Error(str(rec?.error, 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð·Ð°Ð¿ÑƒÑÑ‚Ð¸Ñ‚ÑŒ Ñ‚ÐµÑÑ‚'));
      }
      setNotice(`Ð¢ÐµÑÑ‚ Ð·Ð°Ð¿ÑƒÑ‰ÐµÐ½: ${testType}`);
      await loadWorkspace();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'ÐžÑˆÐ¸Ð±ÐºÐ° Ð·Ð°Ð¿ÑƒÑÐºÐ° Ñ‚ÐµÑÑ‚Ð°');
    } finally {
      setRunningTest('');
    }
  }, [loadWorkspace]);

  const ceo = workspace?.ceo;
  const cto = workspace?.cto;
  const kpi = asRecord(ceo?.kpi);
  const comparison = asRecord(ceo?.comparison);
  const simplePulse = asRecord(ceo?.simple_pulse);
  const quickSummary = asRecord(ceo?.quick_summary);
  const financeDaily = asArray<{ day: string; revenue: number; costs: number; margin: number; orders: number }>(ceo?.finance?.daily);
  const actionCenter = asArray<WorkspaceAction>(ceo?.action_center);
  const aiSignals = asArray<AiSignal>(ceo?.ai_signals);
  const marginLeaks = asArray<JsonRecord>(ceo?.margin_leak_detector);
  const riskRadar = asArray<JsonRecord>(ceo?.deal_risk_radar);
  const kanbanLanes = asArray<JsonRecord>(ceo?.kanban?.lanes);
  const managerRows = asArray<JsonRecord>(ceo?.managers);
  const aiSuggestions = asArray<JsonRecord>(simplePulse?.suggestions);
  const miniOrders = asArray<MiniOrder>(ceo?.mini_crm?.orders);
  const miniLeads = asArray<JsonRecord>(ceo?.mini_crm?.leads);
  const miniTasks = asArray<JsonRecord>(ceo?.mini_crm?.tasks);
  const partners = asArray<JsonRecord>(ceo?.partners?.links);
  const topChannels = asArray<JsonRecord>(ceo?.traffic?.top_channels);
  const topCampaigns = asArray<JsonRecord>(ceo?.traffic?.top_campaigns);
  const ceoFlow = React.useMemo(() => {
    const flowRaw = ceo?.funnel?.ceo_flow;
    if (Array.isArray(flowRaw)) return flowRaw;
    const rec = asRecord(flowRaw);
    if (!rec) return [];
    return Object.entries(rec)
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .map(([key, value]) => ({ stage: key, sessions: Number(value) }));
  }, [ceo]);
  const lossPoints = asArray<JsonRecord>(ceo?.funnel?.loss_points);
  const journey = asRecord(ceo?.funnel?.journey);
  const forecast = ceo?.finance?.cashflow_forecast;

  const ctoHealth = asRecord(cto?.health);
  const ctoIncidents = asArray<JsonRecord>(cto?.incidents);
  const ctoAnomalies = asArray<JsonRecord>(cto?.anomalies);
  const ctoLogs = asArray<JsonRecord>(cto?.recent_logs);
  const ctoTestLogs = asArray<JsonRecord>(cto?.test_logs);

  const bookedCmp = comparisonRow(comparison, 'booked_revenue_eur');
  const ordersCmp = comparisonRow(comparison, 'orders_total');
  const marginCmp = comparisonRow(comparison, 'margin_pct');
  const leadsCmp = comparisonRow(comparison, 'active_leads');
  const trendRows = React.useMemo(() => buildDailyTrend(financeDaily, period), [financeDaily, period]);
  const flowRows = React.useMemo(() => buildFlowStageRows(lossPoints, num(kpi?.orders_total, 0)), [lossPoints, kpi]);
  const trafficRows = React.useMemo(() => buildTrafficRows(topChannels, partners), [topChannels, partners]);
  const campaignRows = React.useMemo(() => {
    const campaigns = topCampaigns
      .map((row) => {
        const rec = asRecord(row);
        return {
          label: str(rec?.campaign, str(rec?.source, 'campaign')),
          sessions: num(rec?.sessions, 0),
        };
      })
      .filter((row) => row.sessions > 0)
      .slice(0, 6);
    if (campaigns.length) return campaigns;
    return partners
      .slice(0, 6)
      .map((partner) => {
        const rec = asRecord(partner);
        const stats = asRecord(rec?.stats);
        return {
          label: str(rec?.channelName, 'partner'),
          sessions: num(stats?.sessions, 0),
        };
      })
      .filter((row) => row.sessions > 0);
  }, [topCampaigns, partners]);
  const quickOrders = miniOrders.slice(0, 6);
  const quickActions = React.useMemo(() => {
    const normalizeSimpleTarget = (value: string) => {
      if (!value.startsWith('/admin#')) return value;
      if (value.includes('traffic')) return '/admin#pulse-marketing';
      if (value.includes('mini-crm')) return '/admin#pulse-team';
      if (value.includes('finance') || value.includes('margin')) return '/admin#pulse-sales';
      if (value.includes('action-center')) return '/admin#pulse-actions';
      return '/admin#pulse-sales';
    };
    const base = actionCenter.slice(0, 3).map((action) => ({
      title: action.title,
      severity: action.severity,
      text: action.insight,
      target: normalizeSimpleTarget(action.target),
      button: action.action_label,
    }));
    const ai = aiSuggestions.slice(0, 2).map((item) => ({
      title: str(item?.title, 'Ð ÐµÐºÐ¾Ð¼ÐµÐ½Ð´Ð°Ñ†Ð¸Ñ AI'),
      severity: str(item?.priority, 'medium'),
      text: str(item?.next_step, str(item?.reason, '')),
      target: normalizeSimpleTarget(str(item?.target, '/admin')),
      button: 'ÐžÑ‚ÐºÑ€Ñ‹Ñ‚ÑŒ',
    }));
    return [...base, ...ai].slice(0, 5);
  }, [actionCenter, aiSuggestions]);

  return (
    <div ref={dashboardRef} className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#f8fafc_0%,#eef2ff_35%,#f8fafc_100%)] text-slate-900 overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1600px] px-3 pb-16 pt-4 sm:px-4 sm:pt-5 md:px-8 md:pb-20 md:pt-6">
        <header className="sticky top-0 z-20 mb-5 rounded-3xl border border-slate-200 bg-white/85 p-3 sm:p-4 shadow-sm backdrop-blur md:mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Admin Control Center</h1>
              <p className="text-sm text-slate-500">
                Ð•Ð´Ð¸Ð½Ð°Ñ Ñ‚Ð¾Ñ‡ÐºÐ° Ð¼Ð¾Ð´ÐµÑ€Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ñ ÑÐ¸ÑÑ‚ÐµÐ¼Ñ‹: Ñ„Ð¸Ð½Ð°Ð½ÑÑ‹, Ð²Ð¾Ñ€Ð¾Ð½ÐºÐ°, Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€ÐºÐ¸, mini-CRM, Ñ‚ÐµÑ…ÐºÐ¾Ð½Ñ‚Ñ€Ð¾Ð»ÑŒ.
              </p>
              {workspace?.window?.generated_at ? (
                <p className="mt-1 text-xs text-slate-400">ÐžÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¾: {formatDate(workspace.window.generated_at)}</p>
              ) : null}
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  onClick={() => setPersona('simple')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    persona === 'simple' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/70'
                  )}
                >
                  Ð£Ð¿Ñ€Ð¾Ñ‰ÐµÐ½Ð½Ñ‹Ð¹
                </button>
                <button
                  onClick={() => setPersona('ceo')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    persona === 'ceo' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/70'
                  )}
                >
                  CEO
                </button>
                <button
                  onClick={() => setPersona('cto')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    persona === 'cto' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/70'
                  )}
                >
                  CTO
                </button>
              </div>

              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as Period)}
                className="h-10 min-w-[120px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:flex-none"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                onClick={() => void loadWorkspace()}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex-none"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                ÐžÐ±Ð½Ð¾Ð²Ð¸Ñ‚ÑŒ
              </button>

              <button
                onClick={() => openPath('/crm/orders')}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:flex-none"
              >
                Mini CRM
                <ExternalLink className="h-4 w-4" />
              </button>

              <button
                onClick={() => void logout()}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:flex-none"
              >
                <LogOut className="h-4 w-4" />
                Ð’Ñ‹Ð¹Ñ‚Ð¸
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-xs [&>a]:shrink-0 [&>a]:whitespace-nowrap">
            {persona === 'simple' ? (
              <>
                <a href="#snapshot" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">ÐŸÑƒÐ»ÑŒÑ</a>
                <a href="#pulse-sales" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">ÐŸÑ€Ð¾Ð´Ð°Ð¶Ð¸</a>
                <a href="#pulse-marketing" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">ÐœÐ°Ñ€ÐºÐµÑ‚Ð¸Ð½Ð³</a>
                <a href="#pulse-team" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">ÐšÐ¾Ð¼Ð°Ð½Ð´Ð°</a>
                <a href="#pulse-actions" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">Ð§Ñ‚Ð¾ Ð´ÐµÐ»Ð°Ñ‚ÑŒ</a>
              </>
            ) : persona === 'ceo' ? (
              <>
                <a href="#snapshot" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">Snapshot</a>
                <a href="#action-center" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">Action Center</a>
                <a href="#finance" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">Ð¤Ð¸Ð½Ð°Ð½ÑÑ‹</a>
                <a href="#funnel" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">Ð’Ð¾Ñ€Ð¾Ð½ÐºÐ°</a>
                <a href="#traffic" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">Ð¢Ñ€Ð°Ñ„Ð¸Ðº/ÐŸÐ°Ñ€Ñ‚Ð½ÐµÑ€Ñ‹</a>
                <a href="#mini-crm" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">Mini CRM</a>
                <a href="#risk-radar" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">Risk Radar</a>
              </>
            ) : (
              <a href="#cto" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">CTO Stack</a>
            )}
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        ) : null}
        {notice ? (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{notice}</div>
        ) : null}

        <div className="space-y-5">
          <SectionCard
            id="snapshot"
            title={persona === 'simple'
              ? 'Ð‘Ð¸Ð·Ð½ÐµÑ-Ð¿ÑƒÐ»ÑŒÑ Ð·Ð° 10 ÑÐµÐºÑƒÐ½Ð´'
              : (persona === 'ceo' ? 'CEO Snapshot (Ð³Ð»Ð°Ð²Ð½Ñ‹Ð¹ Ð¾Ð±Ð·Ð¾Ñ€)' : 'CTO Snapshot (ÑÐ¸ÑÑ‚ÐµÐ¼Ð½Ñ‹Ð¹ Ð¾Ð±Ð·Ð¾Ñ€)')}
            subtitle={persona === 'simple'
              ? 'Ð¡Ð°Ð¼Ð¾Ðµ Ð²Ð°Ð¶Ð½Ð¾Ðµ: Ð´ÐµÐ½ÑŒÐ³Ð¸, Ð·Ð°ÐºÐ°Ð·Ñ‹, Ñ€Ð¸ÑÐºÐ¸, Ð¼ÐµÐ½ÐµÐ´Ð¶ÐµÑ€Ñ‹ Ð¸ Ñ‡Ñ‚Ð¾ Ð´ÐµÐ»Ð°Ñ‚ÑŒ Ð´Ð°Ð»ÑŒÑˆÐµ.'
              : (persona === 'ceo'
                ? 'ÐšÐ»ÑŽÑ‡ÐµÐ²Ñ‹Ðµ KPI Ð¸ Ñ„Ð¸Ð½Ð°Ð½ÑÐ¾Ð²Ð°Ñ Ñ‚ÐµÐ¼Ð¿ÐµÑ€Ð°Ñ‚ÑƒÑ€Ð° Ð±Ð¸Ð·Ð½ÐµÑÐ° Ð² Ð¾Ð´Ð½Ð¾Ð¼ ÑÐºÑ€Ð°Ð½Ðµ.'
                : 'Ð¡Ð¾ÑÑ‚Ð¾ÑÐ½Ð¸Ðµ Ð¿Ð»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ñ‹, Ð½Ð°Ð´ÐµÐ¶Ð½Ð¾ÑÑ‚ÑŒ Ð¸ ÑÐºÑÐ¿Ð»ÑƒÐ°Ñ‚Ð°Ñ†Ð¸Ð¾Ð½Ð½Ñ‹Ð¹ ÐºÐ¾Ð½Ñ‚Ñ€Ð¾Ð»ÑŒ.')}
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => openPath('/admin/metrics-core')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <LineChart className="h-4 w-4" />
                  ÐœÐµÑ‚Ñ€Ð¸ÐºÐ¸ (Core)
                </button>
                <button
                  onClick={() => openPath('/admin/growth-attribution')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <Rocket className="h-4 w-4" />
                  Growth Attribution
                </button>
              </div>
            }
          >
            {persona === 'simple' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <MetricCard
                    title="Ð”ÐµÐ½ÑŒÐ³Ð¸"
                    value={formatEuro(kpi?.booked_revenue_eur)}
                    hint={`Ðº Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð¼Ñƒ Ð¿ÐµÑ€Ð¸Ð¾Ð´Ñƒ ${formatDelta(bookedCmp?.delta_pct)}`}
                    icon={<DollarSign className="h-4 w-4" />}
                  />
                  <MetricCard
                    title="Ð—Ð°ÐºÐ°Ð·Ñ‹"
                    value={String(num(kpi?.orders_total, 0))}
                    hint={`Ðº Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð¼Ñƒ Ð¿ÐµÑ€Ð¸Ð¾Ð´Ñƒ ${formatDelta(ordersCmp?.delta_pct)}`}
                    icon={<Briefcase className="h-4 w-4" />}
                  />
                  <MetricCard
                    title="Ð’ Ð¾Ð±Ñ€Ð°Ð±Ð¾Ñ‚ÐºÐµ"
                    value={String(num(quickSummary?.in_processing_orders, 0) + num(quickSummary?.waiting_manager_orders, 0) + num(quickSummary?.shipping_orders, 0))}
                    hint={`ÐžÐ¶Ð¸Ð´Ð°ÑŽÑ‚ Ð¼ÐµÐ½ÐµÐ´Ð¶ÐµÑ€Ð°: ${num(quickSummary?.waiting_manager_orders, 0)}`}
                    icon={<ChevronsRight className="h-4 w-4" />}
                  />
                  <MetricCard
                    title="Ð›Ð¸Ð´Ñ‹ / Ð—Ð°Ð´Ð°Ñ‡Ð¸"
                    value={`${num(kpi?.active_leads, 0)} / ${num(kpi?.active_tasks, 0)}`}
                    hint={`Ð›Ð¸Ð´Ñ‹: ${formatDelta(leadsCmp?.delta_pct)}`}
                    icon={<Users className="h-4 w-4" />}
                  />
                  <MetricCard title="ÐŸÑ€Ð¾Ð±Ð»ÐµÐ¼Ñ‹" value={String(num(kpi?.alert_count, 0))} hint="Ñ‚Ñ€ÐµÐ±ÑƒÑŽÑ‚ Ð²Ð½Ð¸Ð¼Ð°Ð½Ð¸Ñ" icon={<AlertTriangle className="h-4 w-4" />} />
                  <MetricCard
                    title="Business Pulse"
                    value={`${num(simplePulse?.pulse_score, 0)}/100`}
                    hint={str(simplePulse?.status, 'unknown')}
                    icon={<Gauge className="h-4 w-4" />}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 lg:col-span-2">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-900">
                      <Bot className="h-4 w-4" />
                      AI ÐšÑƒÑ€Ð°Ñ‚Ð¾Ñ€ Ð±Ð¸Ð·Ð½ÐµÑÐ° (mock)
                    </div>
                    <p className="text-sm leading-relaxed text-indigo-900/90">{str(simplePulse?.summary, 'ÐŸÑƒÐ»ÑŒÑ ÐµÑ‰Ðµ Ñ€Ð°ÑÑÑ‡Ð¸Ñ‚Ñ‹Ð²Ð°ÐµÑ‚ÑÑ.')}</p>
                  </div>
                  {[
                    { label: 'Ð’Ñ‹Ñ€ÑƒÑ‡ÐºÐ°', row: bookedCmp },
                    { label: 'ÐœÐ°Ñ€Ð¶Ð°', row: marginCmp },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{item.label === 'ÐœÐ°Ñ€Ð¶Ð°' ? formatPct(item.row?.current) : formatEuro(item.row?.current)}</div>
                      <span className={cn('mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', deltaTone(item.row?.delta_pct))}>
                        {formatDelta(item.row?.delta_pct)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : persona === 'ceo' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <MetricCard title="Booked Revenue" value={formatEuro(kpi?.booked_revenue_eur)} icon={<DollarSign className="h-4 w-4" />} />
                  <MetricCard title="Realized Revenue" value={formatEuro(kpi?.realized_revenue_eur)} icon={<TrendingUp className="h-4 w-4" />} />
                  <MetricCard title="Net Margin" value={formatEuro(kpi?.net_margin_eur)} hint={`ÐœÐ°Ñ€Ð¶Ð° ${formatPct(kpi?.margin_pct)}`} icon={<BarChart3 className="h-4 w-4" />} />
                  <MetricCard title="Orders" value={String(num(kpi?.orders_total, 0))} hint={`AOV ${formatEuro(kpi?.avg_order_value_eur)}`} icon={<Briefcase className="h-4 w-4" />} />
                  <MetricCard title="Leads / Tasks" value={`${num(kpi?.active_leads, 0)} / ${num(kpi?.active_tasks, 0)}`} icon={<Users className="h-4 w-4" />} />
                  <MetricCard title="Alerts" value={String(num(kpi?.alert_count, 0))} hint="ÑÐ¸Ð³Ð½Ð°Ð»Ñ‹ Ñ€Ð¸ÑÐºÐ°" icon={<AlertTriangle className="h-4 w-4" />} />
                </div>

                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-900">
                    <Bot className="h-4 w-4" />
                    CEO Narrative Engine
                  </div>
                  <p className="text-sm leading-relaxed text-indigo-900/90">{str(ceo?.narrative, 'ÐÐ°Ñ€Ñ€Ð°Ñ‚Ð¸Ð² Ð¿Ð¾ÐºÐ° Ð½Ðµ ÑÑ„Ð¾Ñ€Ð¼Ð¸Ñ€Ð¾Ð²Ð°Ð½.')}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <MetricCard title="Uptime" value={`${num(ctoHealth?.uptime_sec, 0).toFixed(0)}s`} icon={<Cpu className="h-4 w-4" />} />
                <MetricCard title="Memory RSS" value={`${num(ctoHealth?.memory_mb, 0).toFixed(1)} MB`} icon={<Activity className="h-4 w-4" />} />
                <MetricCard title="Errors 24h" value={String(num(ctoHealth?.error_logs_24h, 0))} icon={<ShieldAlert className="h-4 w-4" />} />
                <MetricCard title="API p95" value={`${num(ctoHealth?.api_p95_ms, 0).toFixed(0)} ms`} hint={`ErrRate ${formatPct(ctoHealth?.api_error_rate_pct)}`} icon={<Gauge className="h-4 w-4" />} />
                <MetricCard title="Hunter (S/E/R)" value={`${num(ctoHealth?.hunter_success_24h, 0)}/${num(ctoHealth?.hunter_errors_24h, 0)}/${num(ctoHealth?.hunter_rejections_24h, 0)}`} icon={<Network className="h-4 w-4" />} />
                <MetricCard title="Queue / Anomalies" value={`${num(ctoHealth?.queue_pending, 0)} / ${num(ctoHealth?.anomalies_48h, 0)}`} icon={<Wrench className="h-4 w-4" />} />
              </div>
            )}
          </SectionCard>

          {persona === 'simple' ? (
            <>
              <SectionCard
                id="pulse-sales"
                title="Ð”ÐµÐ½ÑŒÐ³Ð¸, Ð¿Ñ€Ð¾Ð´Ð°Ð¶Ð¸ Ð¸ Ð²Ð¾Ñ€Ð¾Ð½ÐºÐ°"
                subtitle="ÐžÐ´Ð¸Ð½ ÑÐºÑ€Ð°Ð½: Ñ‚Ñ€ÐµÐ½Ð´ Ð´ÐµÐ½ÐµÐ³, Ñ‚ÐµÐºÑƒÑ‰Ð°Ñ Ð¾Ñ‡ÐµÑ€ÐµÐ´ÑŒ Ð·Ð°ÐºÐ°Ð·Ð¾Ð² Ð¸ ÑÐ¾ÑÑ‚Ð¾ÑÐ½Ð¸Ðµ Ð²Ð¾Ñ€Ð¾Ð½ÐºÐ¸"
                className="border-blue-200 bg-gradient-to-br from-blue-50/60 via-white to-emerald-50/40"
              >
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="xl:col-span-7 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ð¢Ñ€ÐµÐ½Ð´ Ð²Ñ‹Ñ€ÑƒÑ‡ÐºÐ¸ Ð¸ Ð·Ð°ÐºÐ°Ð·Ð¾Ð²</div>
                    {trendRows.some((row) => row.revenue > 0 || row.orders > 0) ? (
                      <div className="h-64 w-full">
                        <ResponsiveContainer>
                          <AreaChart data={trendRows}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Area type="monotone" dataKey="revenue" name="Ð’Ñ‹Ñ€ÑƒÑ‡ÐºÐ° â‚¬" stroke="#0f766e" fill="#99f6e4" fillOpacity={0.4} />
                            <Area type="monotone" dataKey="orders" name="Ð—Ð°ÐºÐ°Ð·Ñ‹" stroke="#1d4ed8" fill="#bfdbfe" fillOpacity={0.35} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">
                        ÐŸÐ¾ÐºÐ° Ð½ÐµÑ‚ Ð´Ð°Ð½Ð½Ñ‹Ñ… Ð¿Ð¾ ÑÐ´ÐµÐ»ÐºÐ°Ð¼ Ð·Ð° Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ñ‹Ð¹ Ð¿ÐµÑ€Ð¸Ð¾Ð´
                      </div>
                    )}
                  </div>

                  <div className="xl:col-span-5 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">Ð¡Ñ€Ð°Ð²Ð½ÐµÐ½Ð¸Ðµ Ñ Ð¿Ñ€Ð¾ÑˆÐ»Ñ‹Ð¼ Ð¿ÐµÑ€Ð¸Ð¾Ð´Ð¾Ð¼</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{period}</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: 'booked_revenue_eur', label: 'Ð’Ñ‹Ñ€ÑƒÑ‡ÐºÐ°', formatter: formatEuro },
                        { key: 'orders_total', label: 'Ð—Ð°ÐºÐ°Ð·Ñ‹', formatter: (value: unknown) => String(num(value, 0)) },
                        { key: 'margin_pct', label: 'ÐœÐ°Ñ€Ð¶Ð°', formatter: formatPct },
                        { key: 'active_leads', label: 'Ð›Ð¸Ð´Ñ‹', formatter: (value: unknown) => String(num(value, 0)) },
                      ].map((item) => {
                        const row = comparisonRow(comparison, item.key);
                        return (
                          <div key={item.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                            <span className="text-slate-600">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <strong className="text-slate-900">{item.formatter(row?.current)}</strong>
                              <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', deltaTone(row?.delta_pct))}>
                                {formatDelta(row?.delta_pct)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => openPath('/admin/metrics-core')}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      ÐžÑ‚ÐºÑ€Ñ‹Ñ‚ÑŒ Ð¿Ð¾Ð»Ð½Ñ‹Ð¹ Ð±Ð»Ð¾Ðº Ð¼ÐµÑ‚Ñ€Ð¸Ðº
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="xl:col-span-8 rounded-2xl border border-slate-200 bg-white p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Ð“Ð´Ðµ ÑÐµÐ¹Ñ‡Ð°Ñ Ð´ÐµÐ½ÑŒÐ³Ð¸ Ð¿Ð¾ ÑÑ‚Ð°Ñ‚ÑƒÑÐ°Ð¼ Ð·Ð°ÐºÐ°Ð·Ð¾Ð²</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {kanbanLanes.map((lane, idx) => (
                        <div key={`lane-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{str(lane?.label, str(lane?.lane, 'Lane'))}</div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">{formatEuro(lane?.amount_eur)}</div>
                          <div className="text-xs text-slate-500">{num(lane?.orders, 0)} Ð·Ð°ÐºÐ°Ð·Ð¾Ð² Â· Ð·Ð°Ð²Ð¸ÑÑˆÐ¸Ñ… {num(lane?.stalled_orders, 0)}</div>
                          <div className={cn('mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', deltaTone(lane?.delta_amount_eur))}>
                            {formatEuro(lane?.delta_amount_eur)} Ðº Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð¼Ñƒ
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="xl:col-span-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Ð¡Ñ€ÐµÐ· Ð¿Ð¾ Ð²Ð¾Ñ€Ð¾Ð½ÐºÐµ</h3>
                    {flowRows.length ? (
                      <div className="h-52 w-full">
                        <ResponsiveContainer>
                          <BarChart data={flowRows}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#0f172a" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">
                        ÐÐµÑ‚ Ð´Ð°Ð½Ð½Ñ‹Ñ… Ð¿Ð¾ Ð²Ð¾Ñ€Ð¾Ð½ÐºÐµ
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                id="pulse-marketing"
                title="ÐœÐ°Ñ€ÐºÐµÑ‚Ð¸Ð½Ð³ Ð¸ Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€Ñ‹"
                subtitle="ÐšÐ°Ð½Ð°Ð»Ñ‹ Ñ‚Ñ€Ð°Ñ„Ð¸ÐºÐ°, ÑÑ„Ñ„ÐµÐºÑ‚Ð¸Ð²Ð½Ð¾ÑÑ‚ÑŒ Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€Ð¾Ðº Ð¸ Ð¿ÐµÑ€ÐµÑ…Ð¾Ð´ Ð² growth attribution"
                className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 via-white to-cyan-50/30"
              >
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="xl:col-span-6 rounded-2xl border border-slate-200 bg-white p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Ð¢Ð¾Ð¿ Ð¸ÑÑ‚Ð¾Ñ‡Ð½Ð¸ÐºÐ¸ Ñ‚Ñ€Ð°Ñ„Ð¸ÐºÐ°</h3>
                    <div className="space-y-2">
                      {trafficRows.slice(0, 6).map((row, idx) => (
                        <div key={`tr-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <span className="truncate text-slate-700">{row.label}</span>
                          <span className="ml-3 text-right text-xs text-slate-600">
                            <strong className="text-sm text-slate-900">{row.sessions}</strong> ÑÐµÑÑ.
                            <span className="ml-1">Â· {row.conversionPct.toFixed(1)}%</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="xl:col-span-6 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">ÐŸÐ°Ñ€Ñ‚Ð½ÐµÑ€Ñ‹</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{partners.length}</span>
                    </div>
                    <div className="max-h-56 space-y-2 overflow-auto pr-1">
                      {partners.length ? partners.slice(0, 8).map((partner, idx) => {
                        const rec = asRecord(partner);
                        const stats = asRecord(rec?.stats);
                        return (
                          <div key={`sp-${idx}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                            <div className="font-medium text-slate-800">{str(rec?.channelName, 'Partner')}</div>
                            <div className="mt-1 text-xs text-slate-600">
                              Sessions: <strong>{num(stats?.sessions, 0)}</strong> Â· Checkout: <strong>{num(stats?.checkoutPct, 0).toFixed(1)}%</strong> Â· Orders: <strong>{num(stats?.orderPct, 0).toFixed(1)}%</strong>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">ÐŸÐ°Ñ€Ñ‚Ð½ÐµÑ€ÑÐºÐ¸Ðµ ÑÑÑ‹Ð»ÐºÐ¸ Ð¿Ð¾ÐºÐ° Ð½Ðµ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ñ‹</div>
                      )}
                    </div>
                    <button
                      onClick={() => openPath('/admin/growth-attribution')}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      ÐŸÐµÑ€ÐµÐ¹Ñ‚Ð¸ Ð² Growth Attribution
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                id="pulse-team"
                title="ÐšÐ¾Ð¼Ð°Ð½Ð´Ð° Ð¸ Ð·Ð°ÐºÐ°Ð·Ñ‹ Ð² Ñ€Ð°Ð±Ð¾Ñ‚Ðµ"
                subtitle="ÐšÑ‚Ð¾ Ð¿ÐµÑ€ÐµÐ³Ñ€ÑƒÐ¶ÐµÐ½, ÐºÐ°ÐºÐ¸Ðµ ÑÐ´ÐµÐ»ÐºÐ¸ Ð² Ñ€Ð¸ÑÐºÐµ Ð¸ Ñ‡Ñ‚Ð¾ Ð² Ð¾Ð¿ÐµÑ€Ð°Ñ‚Ð¸Ð²Ð½Ð¾Ð¹ Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸"
                className="border-violet-200 bg-gradient-to-br from-violet-50/60 via-white to-rose-50/30"
              >
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="xl:col-span-7 rounded-2xl border border-slate-200 bg-white p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">ÐžÑ‡ÐµÑ€ÐµÐ´ÑŒ Ð·Ð°ÐºÐ°Ð·Ð¾Ð² (mini CRM)</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Ð—Ð°ÐºÐ°Ð·</th>
                            <th className="px-3 py-2 text-left">ÐšÐ»Ð¸ÐµÐ½Ñ‚</th>
                            <th className="px-3 py-2 text-left">Ð¡ÑƒÐ¼Ð¼Ð°</th>
                            <th className="px-3 py-2 text-left">Ð¡Ñ‚Ð°Ñ‚ÑƒÑ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quickOrders.length ? quickOrders.map((order) => (
                            <tr key={order.order_id} className="border-t border-slate-200">
                              <td className="px-3 py-2 font-mono text-xs">{order.order_code || order.order_id}</td>
                              <td className="px-3 py-2">{order.customer_name || '-'}</td>
                              <td className="px-3 py-2">{formatEuro(order.total_amount_eur)}</td>
                              <td className="px-3 py-2">{statusLabel(order.status)}</td>
                            </tr>
                          )) : (
                            <tr><td colSpan={4} className="px-3 py-5 text-center text-sm text-slate-500">ÐÐµÑ‚ Ð°ÐºÑ‚Ð¸Ð²Ð½Ñ‹Ñ… Ð·Ð°ÐºÐ°Ð·Ð¾Ð² Ð·Ð° Ð¿ÐµÑ€Ð¸Ð¾Ð´</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="xl:col-span-5 rounded-2xl border border-slate-200 bg-white p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">ÐœÐµÐ½ÐµÐ´Ð¶ÐµÑ€Ñ‹</h3>
                    <div className="space-y-2">
                      {managerRows.length ? managerRows.slice(0, 6).map((manager, idx) => (
                        <div key={`mgr-simple-${idx}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <strong className="text-slate-800">{str(manager?.manager, 'unassigned')}</strong>
                            <span className="text-xs text-slate-500">{num(manager?.orders_total, 0)} Ð·Ð°ÐºÐ°Ð·Ð¾Ð²</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            Ð’Ñ‹Ñ€ÑƒÑ‡ÐºÐ°: <strong>{formatEuro(manager?.revenue_eur)}</strong> Â· ÐÐºÑ‚Ð¸Ð²Ð½Ñ‹Ñ…: <strong>{num(manager?.active_orders, 0)}</strong> Â· Ð—Ð°Ð²Ð¸ÑÑˆÐ¸Ñ…: <strong>{num(manager?.stalled_orders, 0)}</strong>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">ÐÐµÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ‹Ñ… Ð¼ÐµÐ½ÐµÐ´Ð¶ÐµÑ€Ð¾Ð²</div>
                      )}
                    </div>
                    <button
                      onClick={() => openPath('/crm/orders')}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      ÐžÑ‚ÐºÑ€Ñ‹Ñ‚ÑŒ CRM Ð·Ð°ÐºÐ°Ð·Ñ‹
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard id="pulse-actions" title="Ð§Ñ‚Ð¾ Ð´ÐµÐ»Ð°Ñ‚ÑŒ ÑÐµÐ¹Ñ‡Ð°Ñ" subtitle="ÐŸÑ€Ð¸Ð¾Ñ€Ð¸Ñ‚ÐµÑ‚Ñ‹ Ð´Ð»Ñ Ð²Ð»Ð°Ð´ÐµÐ»ÑŒÑ†Ð° Ð±Ð¸Ð·Ð½ÐµÑÐ° Ð½Ð° Ð±Ð»Ð¸Ð¶Ð°Ð¹ÑˆÐ¸Ðµ 24 Ñ‡Ð°ÑÐ°">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {quickActions.length ? quickActions.map((item, idx) => (
                    <div key={`qa-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium uppercase', severityTone(item.severity))}>{item.severity}</span>
                      </div>
                      <p className="text-sm text-slate-600">{item.text}</p>
                      <button
                        onClick={() => openPath(item.target)}
                        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {item.button}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                      ÐšÑ€Ð¸Ñ‚Ð¸Ñ‡Ð½Ñ‹Ñ… Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ð¹ ÑÐµÐ¹Ñ‡Ð°Ñ Ð½ÐµÑ‚. ÐšÐ¾Ð½Ñ‚ÑƒÑ€ ÑÑ‚Ð°Ð±Ð¸Ð»ÐµÐ½.
                    </div>
                  )}
                </div>
              </SectionCard>
            </>
          ) : persona === 'ceo' ? (
            <>

              <SectionCard
                id="action-center"
                title="Action Center (Anomaly -> Action)"
                subtitle={`Приоритетные действия по рискам и метрикам. Активных AI-сигналов: ${aiSignals.length}`}
              >
                {actionCenter.length ? (
                  <div className="space-y-3">
                    {actionCenter.map((action) => (
                      <div key={action.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase', severityTone(action.severity))}>
                              {action.severity}
                            </span>
                            {action.signal_id ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                                {action.signal_status || 'open'}
                              </span>
                            ) : null}
                            <h3 className="text-sm font-semibold text-slate-900">{action.title}</h3>
                          </div>
                          <button
                            onClick={() => openPath(action.target)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {action.action_label}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-sm text-slate-600">{action.insight}</p>
                        {action.signal_id ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              disabled={signalBusyId === action.signal_id}
                              onClick={() => void handleSignalDecision(action.signal_id as string, 'approve')}
                              className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              disabled={signalBusyId === action.signal_id}
                              onClick={() => void handleSignalDecision(action.signal_id as string, 'reassign')}
                              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-60"
                            >
                              Reassign
                            </button>
                            <button
                              disabled={signalBusyId === action.signal_id}
                              onClick={() => void handleSignalDecision(action.signal_id as string, 'snooze')}
                              className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-60"
                            >
                              Snooze 2h
                            </button>
                            <button
                              disabled={signalBusyId === action.signal_id}
                              onClick={() => void handleSignalDecision(action.signal_id as string, 'resolve')}
                              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                            >
                              Resolve
                            </button>
                            <button
                              disabled={signalBusyId === action.signal_id}
                              onClick={() => void handleSignalDecision(action.signal_id as string, 'reject')}
                              className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    ÐšÑ€Ð¸Ñ‚Ð¸Ñ‡Ð½Ñ‹Ñ… Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ð¹ ÑÐµÐ¹Ñ‡Ð°Ñ Ð½ÐµÑ‚. ÐšÐ¾Ð½Ñ‚ÑƒÑ€ ÑÑ‚Ð°Ð±Ð¸Ð»ÐµÐ½.
                  </div>
                )}
              </SectionCard>

              <SectionCard id="finance" title="Ð¤Ð¸Ð½Ð°Ð½ÑÑ‹ Ð¸ Cashflow" subtitle="Ð’Ñ‹Ñ€ÑƒÑ‡ÐºÐ°, Ð¸Ð·Ð´ÐµÑ€Ð¶ÐºÐ¸, Ð¼Ð°Ñ€Ð¶Ð° Ð¸ Ð¿Ñ€Ð¾Ð³Ð½Ð¾Ð· Ð½Ð° 30 Ð´Ð½ÐµÐ¹">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue / Costs / Margin (daily)</div>
                    <div className="h-72 w-full">
                      <ResponsiveContainer>
                        <AreaChart data={financeDaily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#0f766e" fill="#99f6e4" fillOpacity={0.5} />
                          <Area type="monotone" dataKey="costs" name="Costs" stroke="#0369a1" fill="#bae6fd" fillOpacity={0.45} />
                          <Area type="monotone" dataKey="margin" name="Margin" stroke="#65a30d" fill="#d9f99d" fillOpacity={0.4} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cashflow Forecaster (30d)</div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between"><span className="text-slate-500">Conservative</span><strong>{formatEuro(asRecord(forecast?.scenarios?.conservative)?.revenue_eur)}</strong></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">Base</span><strong>{formatEuro(asRecord(forecast?.scenarios?.base)?.revenue_eur)}</strong></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">Aggressive</span><strong>{formatEuro(asRecord(forecast?.scenarios?.aggressive)?.revenue_eur)}</strong></div>
                      </div>
                    </div>

                    <div id="margin-leaks" className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Margin Leak Detector</div>
                      <div className="text-sm text-amber-900">Ð—Ð°ÐºÐ°Ð·Ð¾Ð² Ñ ÑƒÑ‚ÐµÑ‡ÐºÐ¾Ð¹ Ð¼Ð°Ñ€Ð¶Ð¸: <strong>{marginLeaks.length}</strong></div>
                      <p className="mt-1 text-xs text-amber-700">ÐŸÐ¾Ñ€Ð¾Ð³ ÐºÐ¾Ð½Ñ‚Ñ€Ð¾Ð»Ñ: leak &gt; â‚¬40</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Order</th>
                        <th className="px-3 py-2 text-left">Expected Fee</th>
                        <th className="px-3 py-2 text-left">Actual Fee</th>
                        <th className="px-3 py-2 text-left">Leak</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marginLeaks.slice(0, 10).map((row, idx) => {
                        const rec = asRecord(row);
                        return (
                          <tr key={`${str(rec?.order_id)}-${idx}`} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-mono text-xs">{str(rec?.order_code, str(rec?.order_id, '-'))}</td>
                            <td className="px-3 py-2">{formatEuro(rec?.expected_service_fee_eur)}</td>
                            <td className="px-3 py-2">{formatEuro(rec?.actual_service_fee_eur)}</td>
                            <td className="px-3 py-2 font-semibold text-rose-700">{formatEuro(rec?.margin_leak_eur)}</td>
                            <td className="px-3 py-2">{statusLabel(str(rec?.status, null))}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">{formatDate(rec?.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard id="funnel" title="Ð’Ð¾Ñ€Ð¾Ð½ÐºÐ° Ð¿Ñ€Ð¾Ð´Ð°Ð¶ Ð¸ ÐºÐ¾Ð½Ð²ÐµÑ€ÑÐ¸Ñ" subtitle="ÐžÑ‚ ÑÐµÑÑÐ¸Ð¹ Ð´Ð¾ booking success Ð¸ Ð·Ð°ÐºÐ°Ð·Ð°">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">CEO Funnel Flow</div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer>
                        <BarChart data={ceoFlow}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="sessions" fill="#0f172a" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <MetricCard title="First Click Rate" value={formatPct(journey?.firstClickRatePct)} icon={<Target className="h-4 w-4" />} />
                    <MetricCard title="ATC Reach" value={formatPct(journey?.atcReachPct)} icon={<ChevronsRight className="h-4 w-4" />} />
                    <MetricCard title="Booking Success Reach" value={formatPct(journey?.bookingSuccessReachPct)} icon={<CheckCircle2 className="h-4 w-4" />} />
                    <MetricCard title="Bounce" value={formatPct(journey?.bounceRatePct)} icon={<AlertTriangle className="h-4 w-4" />} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {lossPoints.map((row, idx) => {
                    const rec = asRecord(row);
                    return (
                      <div key={`${str(rec?.stageFrom)}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                        <div className="font-semibold text-slate-800">{str(rec?.stageFrom, '?')} â†’ {str(rec?.stageTo, '?')}</div>
                        <div className="mt-1 text-slate-600">
                          Conversion: <strong>{formatPct(rec?.conversionPct)}</strong> Â· Loss: <strong>{formatPct(rec?.lossPct)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard id="traffic" title="Ð¢Ñ€Ð°Ñ„Ð¸Ðº, Ð°Ñ‚Ñ€Ð¸Ð±ÑƒÑ†Ð¸Ñ Ð¸ Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€Ñ‹" subtitle="ÐšÐ°Ð½Ð°Ð»Ñ‹ Ñ€Ð¾ÑÑ‚Ð°, ÐºÐ°Ð¼Ð¿Ð°Ð½Ð¸Ð¸ Ð¸ Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€ÑÐºÐ¸Ðµ ÑÑÑ‹Ð»ÐºÐ¸">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Top Channels</h3>
                    <div className="space-y-2">
                      {trafficRows.slice(0, 8).map((row, idx) => {
                        return (
                          <div key={`ch-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                            <span>{row.label}</span>
                            <strong>{num(row.sessions, 0)}</strong>
                          </div>
                        );
                      })}
                      {!trafficRows.length ? (
                        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">Ð”Ð°Ð½Ð½Ñ‹Ðµ Ð¿Ð¾ ÐºÐ°Ð½Ð°Ð»Ð°Ð¼ Ð¿Ð¾ÐºÐ° Ð½Ðµ ÑÐ¾Ð±Ñ€Ð°Ð½Ñ‹</div>
                      ) : null}
                    </div>

                    <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-800">Top Campaigns</h3>
                    <div className="space-y-2">
                      {campaignRows.slice(0, 6).map((row, idx) => {
                        return (
                          <div key={`camp-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                            <span className="truncate">{row.label}</span>
                            <strong>{num(row.sessions, 0)}</strong>
                          </div>
                        );
                      })}
                      {!campaignRows.length ? (
                        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">ÐšÐ°Ð¼Ð¿Ð°Ð½Ð¸Ð¸ Ð¿Ð¾ÐºÐ° Ð½ÐµÐ°ÐºÑ‚Ð¸Ð²Ð½Ñ‹</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">ÐŸÐ°Ñ€Ñ‚Ð½ÐµÑ€ÑÐºÐ¸Ðµ ÑÑÑ‹Ð»ÐºÐ¸ (Referral Management)</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{partners.length}</span>
                    </div>

                    <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <input
                        value={partnerForm.channelName}
                        onChange={(event) => setPartnerForm((prev) => ({ ...prev, channelName: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="ÐšÐ°Ð½Ð°Ð» Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€Ð°"
                      />
                      <input
                        value={partnerForm.codeWord}
                        onChange={(event) => setPartnerForm((prev) => ({ ...prev, codeWord: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Code word"
                      />
                      <input
                        value={partnerForm.targetPath}
                        onChange={(event) => setPartnerForm((prev) => ({ ...prev, targetPath: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Target path"
                      />
                    </div>
                    <button
                      onClick={() => void handlePartnerCreate()}
                      disabled={partnerBusy}
                      className="mb-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {partnerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                      Ð¡Ð¾Ð·Ð´Ð°Ñ‚ÑŒ Ð¿Ð°Ñ€Ñ‚Ð½ÐµÑ€ÑÐºÑƒÑŽ ÑÑÑ‹Ð»ÐºÑƒ
                    </button>

                    <div className="max-h-80 space-y-2 overflow-auto pr-1">
                      {partners.slice(0, 20).map((row, idx) => {
                        const rec = asRecord(row);
                        const stats = asRecord(rec?.stats);
                        const id = num(rec?.id, 0);
                        const active = Boolean(rec?.isActive);
                        return (
                          <div key={`partner-${id}-${idx}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold text-slate-800">{str(rec?.channelName, 'Partner')}</div>
                                <div className="text-xs text-slate-500">{str(rec?.maskedUrl, '-')}</div>
                              </div>
                              <button
                                onClick={() => void handlePartnerToggle(id, !active)}
                                disabled={partnerBusy || !id}
                                className={cn(
                                  'rounded-full border px-2 py-1 text-xs font-medium',
                                  active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                                )}
                              >
                                {active ? 'active' : 'paused'}
                              </button>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                              <div>Sessions: <strong>{num(stats?.sessions, 0)}</strong></div>
                              <div>Checkout: <strong>{formatPct(stats?.checkoutPct)}</strong></div>
                              <div>Orders: <strong>{formatPct(stats?.orderPct)}</strong></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard id="mini-crm" title="Mini CRM" subtitle="ÐžÐ¿ÐµÑ€Ð°Ñ‚Ð¸Ð²Ð½Ð¾Ðµ ÑƒÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð·Ð°ÐºÐ°Ð·Ð°Ð¼Ð¸, Ð»Ð¸Ð´Ð°Ð¼Ð¸ Ð¸ Ð·Ð°Ð´Ð°Ñ‡Ð°Ð¼Ð¸ Ð±ÐµÐ· ÑƒÑ…Ð¾Ð´Ð° ÑÐ¾ ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ñ‹">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="xl:col-span-7">
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Order</th>
                            <th className="px-3 py-2 text-left">ÐšÐ»Ð¸ÐµÐ½Ñ‚</th>
                            <th className="px-3 py-2 text-left">Ð¡ÑƒÐ¼Ð¼Ð°</th>
                            <th className="px-3 py-2 text-left">Risk</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {miniOrders.slice(0, 12).map((order) => (
                            <tr key={order.order_id} className="border-t border-slate-200">
                              <td className="px-3 py-2">
                                <div className="font-mono text-xs text-slate-700">#{order.order_code || order.order_id}</div>
                                <div className="text-xs text-slate-500">{formatDate(order.created_at)}</div>
                              </td>
                              <td className="px-3 py-2">
                                <div>{order.customer_name || '-'}</div>
                                <div className="text-xs text-slate-500">{order.customer_phone || order.customer_email || '-'}</div>
                              </td>
                              <td className="px-3 py-2 font-medium">{formatEuro(order.total_amount_eur)}</td>
                              <td className="px-3 py-2">
                                <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase', riskToneClass(order.risk_band))}>
                                  {order.risk_band} Â· {order.risk_score}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  defaultValue={normalizeOrderStatus(order.status) || ORDER_STATUS.BOOKED}
                                  onChange={(event) => void handleOrderStatusChange(order.order_id, event.target.value)}
                                  disabled={updatingOrderId === order.order_id}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                                >
                                  {CRM_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{statusLabel(status)}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => openPath(`/crm/orders/${encodeURIComponent(order.order_id)}`)}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
                                >
                                  CRM
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-4 xl:col-span-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">Leads</h3>
                      <div className="max-h-40 space-y-2 overflow-auto pr-1">
                        {miniLeads.slice(0, 8).map((lead, idx) => {
                          const rec = asRecord(lead);
                          return (
                            <div key={`lead-${idx}`} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                              <div className="font-medium text-slate-700">{str(rec?.source, 'website')} Â· {str(rec?.status, 'new')}</div>
                              <div className="text-slate-500">{str(rec?.contact_method, '-')}: {str(rec?.contact_value, '-')}</div>
                              <div className="text-slate-400">{formatDate(rec?.created_at)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">Tasks</h3>
                      <div className="max-h-44 space-y-2 overflow-auto pr-1">
                        {miniTasks.slice(0, 8).map((task, idx) => {
                          const rec = asRecord(task);
                          return (
                            <div key={`task-${idx}`} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-slate-700">{str(rec?.title, 'Task')}</span>
                                <span className={cn(
                                  'rounded-full px-2 py-0.5',
                                  num(rec?.completed, 0) === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                )}>
                                  {num(rec?.completed, 0) === 1 ? 'done' : 'open'}
                                </span>
                              </div>
                              <div className="text-slate-500">{str(rec?.description, '').slice(0, 100)}</div>
                              <div className="text-slate-400">due: {formatDate(rec?.due_at)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard id="risk-radar" title="Deal Risk Radar" subtitle="ÐŸÑ€Ð¸Ð¾Ñ€Ð¸Ñ‚Ð¸Ð·Ð°Ñ†Ð¸Ñ Ð¿Ñ€Ð¾Ð±Ð»ÐµÐ¼Ð½Ñ‹Ñ… Ð·Ð°ÐºÐ°Ð·Ð¾Ð² Ð´Ð»Ñ ÑƒÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ñ‡ÐµÑÐºÐ¾Ð³Ð¾ Ð²Ð¼ÐµÑˆÐ°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð°">
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Order</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Risk</th>
                        <th className="px-3 py-2 text-left">Margin</th>
                        <th className="px-3 py-2 text-left">Leak</th>
                        <th className="px-3 py-2 text-left">ÐŸÑ€Ð¸Ñ‡Ð¸Ð½Ñ‹</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskRadar.slice(0, 16).map((row, idx) => {
                        const rec = asRecord(row);
                        const reasons = asArray<string>(rec?.reasons);
                        return (
                          <tr key={`risk-${idx}`} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-mono text-xs">{str(rec?.order_code, str(rec?.order_id, '-'))}</td>
                            <td className="px-3 py-2">{statusLabel(str(rec?.status, null))}</td>
                            <td className="px-3 py-2">
                              <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase', riskToneClass(str(rec?.risk_band, 'low')))}>
                                {str(rec?.risk_band, 'low')} Â· {num(rec?.risk_score, 0)}
                              </span>
                            </td>
                            <td className="px-3 py-2">{formatEuro(rec?.margin_eur)}</td>
                            <td className="px-3 py-2 text-rose-700">{formatEuro(rec?.margin_leak_eur)}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{reasons.join(' â€¢ ') || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </>
          ) : (
            <>
              <SectionCard id="cto" title="CTO Stack" subtitle="ÐÐ°Ð´ÐµÐ¶Ð½Ð¾ÑÑ‚ÑŒ Ð¿Ð»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ñ‹, Ð¸Ð½Ñ†Ð¸Ð´ÐµÐ½Ñ‚Ñ‹, Ñ‚ÐµÑ…ÐºÐ¾Ð½Ñ‚ÑƒÑ€ Ð¸ Ð¾Ð¿ÐµÑ€Ð°Ñ†Ð¸Ð¾Ð½Ð½Ñ‹Ðµ Ñ‚ÐµÑÑ‚Ñ‹">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Incident Feed</h3>
                    <div className="max-h-80 space-y-2 overflow-auto pr-1">
                      {ctoIncidents.slice(0, 20).map((incident, idx) => {
                        const rec = asRecord(incident);
                        return (
                          <div key={`inc-${idx}`} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase', severityTone(str(rec?.level, 'info')))}>
                                {str(rec?.level, 'info')}
                              </span>
                              <span className="text-slate-400">{formatDate(rec?.ts)}</span>
                            </div>
                            <div className="mt-1 font-medium text-slate-700">{str(rec?.source, 'system')}</div>
                            <div className="text-slate-600">{str(rec?.message, '')}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">Anomalies & Data Quality</h3>
                      <div className="max-h-48 space-y-2 overflow-auto pr-1">
                        {ctoAnomalies.slice(0, 10).map((row, idx) => {
                          const rec = asRecord(row);
                          return (
                            <div key={`anom-${idx}`} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-slate-700">{str(rec?.metric_name, str(rec?.anomaly_key, 'anomaly'))}</span>
                                <span className={cn('rounded-full border px-2 py-0.5 uppercase', severityTone(str(rec?.severity, 'info')))}>{str(rec?.severity, 'info')}</span>
                              </div>
                              <div className="text-slate-500">Î” {num(rec?.delta_pct, 0).toFixed(1)}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">Lab Controls</h3>
                      <div className="flex flex-wrap gap-2">
                        {['auto_hunt', 'quality_check', 'cleaner', 'financial_sync', 'ranking_recalc'].map((testType) => (
                          <button
                            key={testType}
                            onClick={() => void handleRunTest(testType)}
                            disabled={runningTest === testType}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            {runningTest === testType ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                            {testType}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">Last Test Logs</h3>
                      <div className="max-h-44 space-y-2 overflow-auto pr-1">
                        {ctoTestLogs.slice(0, 12).map((log, idx) => {
                          const rec = asRecord(log);
                          return (
                            <div key={`tlog-${idx}`} className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
                              <div>{str(rec?.text, JSON.stringify(log))}</div>
                              <div className="text-slate-400">{formatDate(rec?.ts)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Recent Logs</h3>
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {ctoLogs.slice(0, 20).map((log, idx) => {
                      const rec = asRecord(log);
                      return (
                        <div key={`log-${idx}`} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-700">{str(rec?.source, 'system')}</span>
                            <span className="text-slate-400">{formatDate(rec?.ts)}</span>
                          </div>
                          <div className="text-slate-500">{str(rec?.message, '')}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>
            </>
          )}
        </div>

        {!user ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            ÐÐ²Ñ‚Ð¾Ñ€Ð¸Ð·Ð°Ñ†Ð¸Ñ Ð½Ðµ Ð¾Ð±Ð½Ð°Ñ€ÑƒÐ¶ÐµÐ½Ð°. Ð”Ð»Ñ Ð¿Ð¾Ð»Ð½Ð¾Ñ†ÐµÐ½Ð½Ð¾Ð¹ Ñ€Ð°Ð±Ð¾Ñ‚Ñ‹ /admin Ð½ÑƒÐ¶ÐµÐ½ JWT Ñ Ñ€Ð¾Ð»ÑŒÑŽ <code>admin</code>.
          </div>
        ) : null}
      </div>
    </div>
  );
}


