"use client";

import * as React from "react"
import { useParams } from "react-router-dom"
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX"
import { SEOHead } from "@/components/SEO/SEOHead"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { crmFrontApi, userTrackingsApi, apiPost, auth } from "@/api"
import { getAddonTitle } from "@/data/buyoutOptions"
import { motion, AnimatePresence } from "framer-motion"
import { Search, CheckCircle, Truck, Clock, Bell, Package, Copy, Check, Info, ChevronLeft, X, MapPin, MessageCircle, FileText, ChevronRight, CreditCard, User, Calendar, Loader2, ShieldAlert, Globe, Send } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { ORDER_STATUS, getOrderStatusPresentation, normalizeOrderStatus } from '@/lib/orderLifecycle'
import createGlobe from "cobe"

// Globe Config
const TRACKING_GLOBE_CONFIG = {
    width: 800,
    height: 800,
    devicePixelRatio: 2,
    phi: 0,
    theta: 0,
    dark: 1,
    diffuse: 1.2,
    mapSamples: 16000,
    mapBrightness: 6,
    baseColor: [0.3, 0.3, 0.3],
    markerColor: [0.1, 0.8, 1],
    glowColor: [1, 1, 1],
    markers: [
        // Marburg
        { location: [50.809, 8.770], size: 0.1 },
        // Moscow (example client location)
        { location: [55.755, 37.617], size: 0.05 }
    ],
    onRender: (state: any) => {
        // Called on every animation frame.
        // state.phi = current phi angle
        state.phi += 0.005
    },
}

function GlobeComponent() {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    React.useEffect(() => {
        let phi = 0;
        let width = 0;

        const onResize = () => {
            if (canvasRef.current && (width = canvasRef.current.offsetWidth)) {
                window.requestAnimationFrame(() => {
                    if (!canvasRef.current) return;
                    const height = canvasRef.current.offsetWidth; // Square
                    canvasRef.current.width = width * 2;
                    canvasRef.current.height = height * 2;
                })
            }
        }
        window.addEventListener('resize', onResize)
        onResize()

        if (!canvasRef.current) return;

        const globe = createGlobe(canvasRef.current, {
            ...TRACKING_GLOBE_CONFIG,
            width: width * 2,
            height: width * 2,
            onRender: (state) => {
                state.phi = phi
                phi += 0.005
            }
        })

        return () => {
            globe.destroy()
            window.removeEventListener('resize', onResize)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', maxWidth: '600px', maxHeight: '600px', aspectRatio: 1 }}
            className="mx-auto opacity-80 mix-blend-screen"
        />
    )
}

type OrderItem = {
  order_id?: string
  order_number?: string
  status?: string
  total_amount?: number
  customer_name?: string
  estimated_delivery?: string | null
  // Sprint 4 additions
  bike_id?: number
  bike_name?: string
  final_price_eur?: number
  booking_price?: number
  booking_amount_rub?: number
  is_refundable?: boolean
  initial_quality_class?: string
  final_quality_class?: string
  inspection_photos?: string[] // URLs
  expert_comment?: string
  confirmation_timestamp?: string
  attention_required?: boolean
  seller_response?: any
  assigned_manager?: string | null
  assigned_manager_name?: string | null
  queue_hint?: string | null
  route_from?: string | null
  route_to?: string | null
  customer?: {
      full_name?: string | null
      phone?: string | null
      email?: string | null
      city?: string | null
      contact_value?: string | null
      preferred_channel?: string | null
  } | null
  // Financials
  service_fee_eur?: number
  shipping_cost_eur?: number
  payment_commission_eur?: number
  total_price_rub?: number
  exchange_rate?: number
  delivery_method?: string
  created_at?: string
  bike_snapshot?: any
  reservation_paid_at?: string | null
}

type OrderDetails = {
  order: OrderItem | null
  history: Array<{ created_at?: string; new_status?: string; change_notes?: string }>
  logistics: Array<{ 
      id: string;
      carrier?: string | null; 
      tracking_number?: string | null; 
      delivery_status?: string | null; 
      estimated_delivery?: string | null;
      warehouse_received?: boolean;
      warehouse_photos_received?: boolean;
      ruspost_status?: any;
  }>
}

type SavedItem = {
  id?: number
  tracking_id: string
  tracking_type: string
  title?: string | null
  status?: string
  status_label?: string
  created_at?: string
  last_viewed?: string
}

function normalizeId(input: string): string {
  return input.trim()
}

// Status Logic
const STATUS_CONFIG: Record<string, { label: string; description: string; progress: number; color: string }> = {
    'new': { label: 'Новая заявка', description: 'Мы получили вашу заявку и назначаем менеджера.', progress: 1, color: 'bg-blue-500' },
    'awaiting_payment': { label: 'Ждем принятия менеджером', description: 'Менеджер подтвердит заказ и запустит проверку.', progress: 1, color: 'bg-yellow-500' },
    'awaiting_deposit': { label: 'Ожидает резервирования', description: 'Рекомендуем оплатить резерв 2%, чтобы закрепить байк.', progress: 1, color: 'bg-yellow-500' },
    'deposit_paid': { label: 'Резерв оплачен', description: 'Менеджер связывается с продавцом и запрашивает информацию.', progress: 2, color: 'bg-blue-500' },
    'under_inspection': { label: 'Идет проверка', description: 'Эксперт анализирует фото и видео велосипеда.', progress: 2, color: 'bg-purple-500' },
    'quality_confirmed': { label: 'Качество подтверждено', description: 'Велосипед соответствует описанию. Готов к выкупу.', progress: 3, color: 'bg-green-500' },
    'quality_degraded': { label: 'Качество снижено', description: 'Обнаружены нюансы. Мы обсуждаем скидку с продавцом.', progress: 3, color: 'bg-orange-500' },
    'confirmed': { label: 'Подтвержден', description: 'Сделка согласована. Готовим документы.', progress: 3, color: 'bg-green-500' },
    'processing': { label: 'В сборке', description: 'Велосипед на складе, готовится к отправке.', progress: 3, color: 'bg-blue-500' },
    'pending_manager': { label: 'Ждет менеджера', description: 'Менеджер скоро вернется с ответом.', progress: 2, color: 'bg-yellow-500' },
    'shipped': { label: 'В пути', description: 'Велосипед передан в доставку.', progress: 4, color: 'bg-indigo-500' },
    'delivered': { label: 'Доставлен', description: 'Заказ успешно доставлен.', progress: 5, color: 'bg-green-500' },
    'cancelled': { label: 'Отменен', description: 'Заказ отменен.', progress: 0, color: 'bg-red-500' },
};

const FLAT_CHECKLIST_ITEMS = [
    { key: '1_brand_verified', label: 'Бренд подтвержден' },
    { key: '2_model_verified', label: 'Модель подтверждена' },
    { key: '3_year_verified', label: 'Год подтвержден' },
    { key: '4_frame_size_verified', label: 'Размер рамы подтвержден' },
    { key: '5_serial_number', label: 'Серийный номер' },
    { key: '6_frame_condition', label: 'Состояние рамы' },
    { key: '7_fork_condition', label: 'Состояние вилки' },
    { key: '8_shock_condition', label: 'Состояние амортизатора' },
    { key: '9_drivetrain_condition', label: 'Трансмиссия' },
    { key: '10_brakes_condition', label: 'Тормоза' },
    { key: '11_wheels_condition', label: 'Колеса' },
    { key: '12_tires_condition', label: 'Покрышки' },
    { key: '13_headset_check', label: 'Рулевая' },
    { key: '14_bottom_bracket_check', label: 'Каретка' },
    { key: '15_suspension_service_history', label: 'История обслуживания подвески' },
    { key: '16_brake_pads_percentage', label: 'Износ колодок' },
    { key: '17_chain_wear', label: 'Износ цепи' },
    { key: '18_cassette_wear', label: 'Износ кассеты' },
    { key: '19_rotor_condition', label: 'Состояние роторов' },
    { key: '20_bearing_play', label: 'Люфт подшипников' },
    { key: '21_original_owner', label: 'Первый владелец' },
    { key: '22_proof_of_purchase', label: 'Документы покупки' },
    { key: '23_warranty_status', label: 'Статус гарантии' },
    { key: '24_crash_history', label: 'История падений' },
    { key: '25_reason_for_sale', label: 'Причина продажи' },
    { key: '26_upgrades_verified', label: 'Апгрейды подтверждены' },
    { key: '27_test_ride_completed', label: 'Тест‑райд' },
    { key: '28_final_approval', label: 'Финальное одобрение' },
];

function getStatusInfo(s?: string | null) {
    const normalized = normalizeOrderStatus(s) || ORDER_STATUS.BOOKED;
    const presentation = getOrderStatusPresentation(normalized);
    const legacy = STATUS_CONFIG[String(s || '').toLowerCase()];
    const byStatus: Record<string, { description: string; progress: number; color: string }> = {
        [ORDER_STATUS.BOOKED]: { description: 'Booking is created. Manager will start processing shortly.', progress: 1, color: 'bg-blue-500' },
        [ORDER_STATUS.RESERVE_PAYMENT_PENDING]: { description: 'Optional reserve payment is available.', progress: 1, color: 'bg-yellow-500' },
        [ORDER_STATUS.RESERVE_PAID]: { description: 'Reserve is paid and bike is locked for you.', progress: 2, color: 'bg-indigo-500' },
        [ORDER_STATUS.SELLER_CHECK_IN_PROGRESS]: { description: 'Manager is checking bike details with seller.', progress: 2, color: 'bg-purple-500' },
        [ORDER_STATUS.CHECK_READY]: { description: 'Check is ready for your decision.', progress: 3, color: 'bg-cyan-500' },
        [ORDER_STATUS.AWAITING_CLIENT_DECISION]: { description: 'Waiting for your decision after check.', progress: 3, color: 'bg-cyan-500' },
        [ORDER_STATUS.FULL_PAYMENT_PENDING]: { description: 'Waiting for full payment.', progress: 3, color: 'bg-yellow-500' },
        [ORDER_STATUS.FULL_PAYMENT_RECEIVED]: { description: 'Payment received, buyout starts.', progress: 3, color: 'bg-green-500' },
        [ORDER_STATUS.BIKE_BUYOUT_COMPLETED]: { description: 'Bike buyout completed.', progress: 4, color: 'bg-blue-500' },
        [ORDER_STATUS.SELLER_SHIPPED]: { description: 'Seller shipped the bike.', progress: 4, color: 'bg-blue-500' },
        [ORDER_STATUS.EXPERT_RECEIVED]: { description: 'Bike received by expert.', progress: 4, color: 'bg-blue-500' },
        [ORDER_STATUS.EXPERT_INSPECTION_IN_PROGRESS]: { description: 'Expert inspection in progress.', progress: 4, color: 'bg-blue-500' },
        [ORDER_STATUS.EXPERT_REPORT_READY]: { description: 'Expert report is ready.', progress: 4, color: 'bg-blue-500' },
        [ORDER_STATUS.AWAITING_CLIENT_DECISION_POST_INSPECTION]: { description: 'Waiting for your decision after report.', progress: 4, color: 'bg-cyan-500' },
        [ORDER_STATUS.WAREHOUSE_RECEIVED]: { description: 'Bike received at warehouse.', progress: 4, color: 'bg-indigo-500' },
        [ORDER_STATUS.WAREHOUSE_REPACKED]: { description: 'Bike repacked at warehouse.', progress: 4, color: 'bg-indigo-500' },
        [ORDER_STATUS.SHIPPED_TO_RUSSIA]: { description: 'Bike shipped to Russia.', progress: 4, color: 'bg-indigo-500' },
        [ORDER_STATUS.DELIVERED]: { description: 'Order delivered.', progress: 5, color: 'bg-green-500' },
        [ORDER_STATUS.CLOSED]: { description: 'Order fully closed.', progress: 5, color: 'bg-green-500' },
        [ORDER_STATUS.CANCELLED]: { description: 'Order cancelled.', progress: 0, color: 'bg-red-500' },
    };
    const config = byStatus[normalized] || byStatus[ORDER_STATUS.BOOKED];
    return {
        code: normalized,
        label: presentation.label || legacy?.label || String(s || ORDER_STATUS.BOOKED),
        description: config.description || legacy?.description || presentation.description,
        progress: Number.isFinite(Number(legacy?.progress)) ? Number(legacy?.progress) : config.progress,
        color: legacy?.color || config.color,
    };
}

export default function OrderTrackingPage() {
  const { token } = useParams<{ token?: string }>()
  
  // Initial query from URL
  const [query, setQuery] = React.useState<string>(() => {
    if (token) return token;
    const parts = typeof window !== "undefined" ? window.location.pathname.split("/") : []
    const last = parts[parts.length - 1] || ""
    return last && last !== "order-tracking" ? decodeURIComponent(last) : ""
  })
  
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [details, setDetails] = React.useState<OrderDetails | null>(null)
  const [saved, setSaved] = React.useState<SavedItem[]>([])
  const [copied, setCopied] = React.useState(false)
  const [reserving, setReserving] = React.useState(false)
  const [isSearchFocused, setIsSearchFocused] = React.useState(false)
  
  // New States for Interactions
  const [managerMessageOpen, setManagerMessageOpen] = React.useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = React.useState(false);
  const [deliveryConfirmOpen, setDeliveryConfirmOpen] = React.useState(false);
  const [pendingDeliveryMethod, setPendingDeliveryMethod] = React.useState<string | null>(null);
  const [messageText, setMessageText] = React.useState('');
  const [sendingMessage, setSendingMessage] = React.useState(false);
  const [reserveDialogOpen, setReserveDialogOpen] = React.useState(false);
  const [reserveStep, setReserveStep] = React.useState<'confirm' | 'processing' | 'success'>('confirm');
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(false);
  const [profileEmail, setProfileEmail] = React.useState('');
  const [profilePassword, setProfilePassword] = React.useState('');
  const [profileConfirm, setProfileConfirm] = React.useState('');
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [authHint, setAuthHint] = React.useState<{ login?: string; tempPassword?: string } | null>(null);

  // Auto-fetch if token exists or query is set in URL
  React.useEffect(() => {
    if (token) {
        fetchOrder(token, true);
    } else if (query && query.length > 3) {
        fetchOrder(query);
    }
  }, [token]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('currentUser');
      if (!raw) return;
      const user = JSON.parse(raw);
      if (user?.email) setProfileEmail(user.email);
    } catch { }
  }, []);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem('booking_auth_hint');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.login || parsed.tempPassword)) {
        setAuthHint({ login: parsed.login || '', tempPassword: parsed.tempPassword || '' });
      }
    } catch {
      // no-op
    }
  }, []);

  const fetchOrder = async (q: string, isToken: boolean = false) => {
    if (!q) return
    setLoading(true)
    setError(null)
    setDetails(null)
    
    try {
      let d: any = null;
      if (isToken) {
           const res = await crmFrontApi.getOrderByToken(q)
           d = res
      } else {
          const normalized = normalizeId(q)
          let res = await crmFrontApi.getOrderDetails(normalized)
          d = res?.data || res
          
          if (!d?.order) {
              const s = await crmFrontApi.searchOrders(normalized, 1)
              const orders = Array.isArray(s?.orders) ? (s.orders as OrderItem[]) : []
              const match = orders.find((o) => String(o.order_number || "") === normalized || String(o.order_id || "") === normalized) || null
              if (match?.order_id) {
                res = await crmFrontApi.getOrderDetails(String(match.order_id))
                d = res?.data || res
              }
          }
      }
      
      if (d?.order) {
          setDetails(d as OrderDetails)
          addToHistory(d.order, isToken ? 'magic_link' : 'manual')
      } else {
          setError("Заказ не найден. Проверьте номер или ссылку.")
          setDetails(null)
      }
    } catch (e: any) {
      setError("Не удалось загрузить информацию")
      setDetails(null)
    } finally {
      setLoading(false)
    }
  }

  const addToHistory = (order: OrderItem, source: 'manual' | 'magic_link' = 'manual') => {
      const id = order.order_number || order.order_id
      if (!id) return
      
      const newItem: SavedItem = {
          tracking_id: String(id),
          tracking_type: 'order',
          title: order.customer_name || 'Заказ',
          status: order.status,
          status_label: getStatusInfo(order.status).label,
          created_at: new Date().toISOString(),
          last_viewed: new Date().toISOString()
      }

      try {
          const key = "recent_searches_v2"
          const current = JSON.parse(localStorage.getItem(key) || "[]") as SavedItem[]
          const filtered = current.filter(x => x.tracking_id !== String(id))
          const next = [newItem, ...filtered].slice(0, 6)
          localStorage.setItem(key, JSON.stringify(next))
          setSaved(next)
          userTrackingsApi.add(String(id), 'order', order.customer_name).catch(() => {})
      } catch (e) {
          console.error("Failed to save history", e)
      }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      fetchOrder(query)
  }

  const handleCopy = async (text: string) => {
      try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
      } catch { void 0 }
  }
  
  const handleSendMessage = async () => {
      if (!messageText.trim() || !details?.order?.order_number) return;
      setSendingMessage(true);
      try {
          await apiPost(`/v1/crm/orders/${details.order.order_number}/ask`, { question: messageText });
          setMessageText('');
          setManagerMessageOpen(false);
          alert('Сообщение отправлено менеджеру!');
      } catch (e) {
          alert('Ошибка отправки сообщения');
      } finally {
          setSendingMessage(false);
      }
  }

  const handleDeliverySelect = (method: string) => {
      setPendingDeliveryMethod(method);
      setDeliveryDialogOpen(false);
      setDeliveryConfirmOpen(true);
  }

  const handleDeliveryConfirm = async () => {
      if (!details?.order?.order_number || !pendingDeliveryMethod) return;
      try {
          await apiPost(`/v1/crm/orders/${details.order.order_number}/delivery`, { method: pendingDeliveryMethod });
          setDeliveryConfirmOpen(false);
          setPendingDeliveryMethod(null);
          fetchOrder(query); // Refresh to show new price
      } catch (e) {
          alert('Ошибка смены доставки');
      }
  }

  const openReserveDialog = () => {
      setReserveStep('confirm');
      setReserveDialogOpen(true);
  }

  const handleReserve = async () => {
      if (!details?.order?.order_number) return;
      setReserving(true);
      setReserveStep('processing');
      try {
          await crmFrontApi.reserve(details.order.order_number);
          await fetchOrder(details.order.order_number);
          setReserveStep('success');
      } catch (e) {
          setReserveStep('confirm');
          alert('Не удалось провести резервирование');
      } finally {
          setReserving(false);
      }
  }

  const handleCompleteProfile = async () => {
      setProfileError(null);
      if (!profileEmail || !profileEmail.includes('@')) {
          setProfileError('Введите корректный email');
          return;
      }
      if (!profilePassword || profilePassword.length < 8) {
          setProfileError('Пароль должен содержать минимум 8 символов');
          return;
      }
      if (profilePassword !== profileConfirm) {
          setProfileError('Пароли не совпадают');
          return;
      }
      setProfileSaving(true);
      try {
          const res: any = await auth.completeProfile(profileEmail.trim(), profilePassword);
          if (!res?.success) {
              setProfileError(res?.error || 'Не удалось обновить профиль');
              return;
          }
          try {
              if (res?.token) localStorage.setItem('authToken', res.token);
              if (res?.user) localStorage.setItem('currentUser', JSON.stringify(res.user));
          } catch { }
          setProfileDialogOpen(false);
          setProfilePassword('');
          setProfileConfirm('');
      } catch (e: any) {
          setProfileError(e?.message || 'Ошибка сохранения');
      } finally {
          setProfileSaving(false);
      }
  }

  const currentStatus = details?.order?.status
  const statusInfo = getStatusInfo(currentStatus);
  const normalizedCurrentStatus = String(statusInfo.code || '');
  const progress = statusInfo.progress;
  const financials = (details as any)?.order?.bike_snapshot?.financials || (details as any)?.order?.bike_snapshot?.booking_meta?.financials || {};
  const bookingMeta = (details as any)?.order?.bike_snapshot?.booking_meta || {};
  const totalPriceRub = (details as any)?.order?.total_price_rub ?? financials.total_price_rub ?? null;
  const bookingAmountRub = (details as any)?.order?.booking_amount_rub ?? financials.booking_amount_rub ?? (totalPriceRub ? Math.ceil(totalPriceRub * 0.02) : null);
  const reservationPaid = normalizedCurrentStatus === ORDER_STATUS.RESERVE_PAID || Boolean((details as any)?.order?.reservation_paid_at || bookingMeta?.reservation_paid_at);
  const queueLabel = details?.order?.queue_hint || bookingMeta.queue_hint || null;
  const managerName =
      details?.order?.assigned_manager_name ||
      (details?.order?.assigned_manager && !/^\d+$/.test(String(details.order.assigned_manager))
          ? details.order.assigned_manager
          : null) ||
      "Ваш менеджер";
  const routeFrom = details?.order?.route_from || bookingMeta?.route_from || "Марбург";
  const routeTo = details?.order?.route_to || details?.order?.customer?.city || bookingMeta?.booking_form?.city || "Город доставки";
  const showQueue = [
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
      ORDER_STATUS.DELIVERED
  ].includes(normalizedCurrentStatus);
  const addonsSelection = bookingMeta.addons_selection || bookingMeta.booking_form?.addons_selection || {};
  const addonsLines = Array.isArray(bookingMeta.addons)
        ? bookingMeta.addons.map((a: any) => ({ ...a, title: a.title || getAddonTitle(a.id) }))
        : Object.entries(addonsSelection || {}).map(([id, qty]) => ({ id, qty, title: getAddonTitle(id) }));

  const getChecklistItems = () => {
      const checklist = details?.inspection?.checklist;
      if (checklist && typeof checklist === 'object') {
          const hasFlat = FLAT_CHECKLIST_ITEMS.some((item) => Object.prototype.hasOwnProperty.call(checklist, item.key));
          if (hasFlat) {
              return FLAT_CHECKLIST_ITEMS.map((item) => {
                  const entry: any = (checklist as any)[item.key];
                  const rawStatus = typeof entry === 'object' ? entry?.status : entry;
                  const rawNote = typeof entry === 'object' ? (entry?.comment ?? entry?.note ?? entry?.value) : (typeof entry === 'string' ? entry : '');
                  const status = rawStatus === true ? 'checked' : rawStatus === false ? 'failed' : 'pending';
                  const note = rawNote ? String(rawNote) : 'Нет данных';
                  return { id: item.key, label: item.label, status, note };
              });
          }
      }
      if (!checklist) {
          return [];
      }

      const items = [];
      const c = checklist;
      const getStatus = (val: any) => (val && val !== 'null' && val !== 'unknown') ? 'checked' : 'pending';
      const getNote = (val: any) => (val && val !== 'null' && val !== 'unknown') ? String(val) : 'Нет данных';

      // Identification
      if (c.identification) {
          items.push({ label: 'Серийный номер', status: getStatus(c.identification.serial_number), note: getNote(c.identification.serial_number) });
          items.push({ label: 'Документы', status: c.identification.documents_available ? 'checked' : 'pending', note: c.identification.documents_available ? 'В наличии' : 'Не подтверждено' });
          items.push({ label: 'Владельцев', status: getStatus(c.identification.owners_count), note: getNote(c.identification.owners_count) });
      }

      // Specs
      if (c.specs) {
          items.push({ label: 'Размер рамы', status: getStatus(c.specs.frame_size_confirmed), note: getNote(c.specs.frame_size_confirmed) });
          items.push({ label: 'Размер колес', status: getStatus(c.specs.wheel_size_confirmed), note: getNote(c.specs.wheel_size_confirmed) });
          items.push({ label: 'Материал рамы', status: getStatus(c.specs.frame_material_confirmed), note: getNote(c.specs.frame_material_confirmed) });
          items.push({ label: 'Комплектация', status: getStatus(c.specs.components_check_status), note: c.specs.components_check_status === 'factory' ? 'Заводская' : 'Кастом' });
      }

      // History
      if (c.history) {
          items.push({ label: 'Пробег (км)', status: getStatus(c.history.mileage_km), note: getNote(c.history.mileage_km) });
          items.push({ label: 'Срок использования', status: getStatus(c.history.usage_years), note: getNote(c.history.usage_years) });
          items.push({ label: 'Режим использования', status: getStatus(c.history.usage_mode), note: getNote(c.history.usage_mode) });
          items.push({ label: 'История повреждений', status: c.history.frame_damage_history === 'None' ? 'checked' : 'pending', note: getNote(c.history.frame_damage_history) });
      }

      // Maintenance
      if (c.maintenance) {
          items.push({ label: 'Последний сервис', status: getStatus(c.maintenance.last_service_details), note: getNote(c.maintenance.last_service_details) });
          items.push({ label: 'Состояние расходников', status: getStatus(c.maintenance.consumables_status), note: getNote(c.maintenance.consumables_status) });
      }

      // Configuration
      if (c.configuration) {
          items.push({ label: 'Тормоза', status: getStatus(c.configuration.brakes), note: getNote(c.configuration.brakes) });
          items.push({ label: 'Вилка', status: getStatus(c.configuration.fork), note: getNote(c.configuration.fork) });
          items.push({ label: 'Амортизатор', status: getStatus(c.configuration.shock), note: getNote(c.configuration.shock) });
      }

      return items;
  };

  const checklistItems = getChecklistItems();

  const clearSearch = () => {
      setDetails(null)
      setQuery("")
      setError(null)
      if (typeof window !== 'undefined') window.history.pushState({}, '', '/order-tracking')
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      <SEOHead title="Отслеживание заказа - BikeWerk" />
      <BikeflipHeaderPX />
      
      <main className="container mx-auto px-4 py-6 md:py-12 max-w-5xl min-h-[80vh] flex flex-col justify-center">
        <AnimatePresence mode="wait">
            {!details ? (
                // SEARCH STATE
                <motion.div 
                    key="search"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-xl mx-auto"
                >
                    <div className="bg-white rounded-[2rem] shadow-xl shadow-zinc-200/50 p-6 md:p-12 text-center ring-1 ring-zinc-100 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/50 to-transparent pointer-events-none" />
                        <div className="relative z-10">
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 ring-8 ring-zinc-50">
                                <Search size={28} className="text-zinc-900 md:w-8 md:h-8" strokeWidth={2} />
                            </div>
                            
                            <h1 className="text-2xl md:text-4xl font-bold text-zinc-900 mb-3 md:mb-4 tracking-tight">
                                Где мой заказ?
                            </h1>
                            <p className="text-zinc-500 mb-8 md:mb-10 leading-relaxed text-base md:text-lg px-2">
                                Введите номер заказа, чтобы узнать его статус и детали доставки
                            </p>

                            <form onSubmit={handleSearchSubmit} className="relative max-w-md mx-auto space-y-3 md:space-y-4">
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-100 to-zinc-100 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-200"></div>
                                    <div className="relative">
                                        <Input 
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            onFocus={() => setIsSearchFocused(true)}
                                            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                            placeholder="ORD-..."
                                            className="h-14 pl-5 pr-12 rounded-xl text-lg bg-white border-zinc-200 focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all font-medium shadow-sm"
                                        />
                                        {query && (
                                            <button 
                                                type="button"
                                                onClick={() => setQuery('')}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1.5 rounded-full hover:bg-zinc-100 transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <Button 
                                    type="submit" 
                                    disabled={loading || !query.trim()}
                                    className="w-full h-14 rounded-xl text-lg font-bold bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg shadow-zinc-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <span>Найти заказ</span>
                                            <ChevronRight size={20} className="opacity-70" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        </div>
                    </div>
                </motion.div>
            ) : (
                // RESULT STATE - EUPHORIA DASHBOARD
                <motion.div 
                    key="result"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6 md:space-y-8"
                >
                    {/* Header with Back Button */}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 mb-2">
                         <button 
                            onClick={clearSearch}
                            className="group flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors px-0 sm:px-4 py-2 rounded-full hover:bg-white self-start"
                        >
                            <div className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center group-hover:border-zinc-300 transition-colors">
                                <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                            </div>
                            <span className="font-bold text-sm">Назад к поиску</span>
                        </button>
                        <div className="flex items-center justify-between w-full sm:w-auto gap-2 bg-white px-4 py-3 sm:py-2 rounded-2xl border border-zinc-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Заказ</span>
                                <span className="text-sm font-mono font-bold text-zinc-900">
                                    {details?.order?.order_number || details?.order?.order_id}
                                </span>
                            </div>
                            <button 
                                onClick={() => handleCopy(String(details?.order?.order_number || details?.order?.order_id))}
                                className="ml-2 text-zinc-400 hover:text-zinc-900 transition-colors p-1.5 hover:bg-zinc-50 rounded-lg"
                            >
                                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                        
                        {/* LEFT COLUMN (Status & Map) */}
                        <div className="lg:col-span-8 space-y-6">
                            
                            {/* 1. Status Pulse Card */}
                            <div className="bg-zinc-900 rounded-[2.5rem] p-6 md:p-10 text-white relative overflow-hidden shadow-2xl">
                                {/* Pulse Glow */}
                                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] ${statusInfo.color.replace('bg-', 'bg-')}/20 rounded-full blur-[100px] animate-pulse pointer-events-none`} />
                                
                                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                                    <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center relative shrink-0">
                                        {progress === 1 && <Package size={32} className="text-white" />}
                                        {progress === 2 && <Search size={32} className="text-white animate-pulse" />}
                                        {progress === 3 && <CheckCircle size={32} className="text-green-400" />}
                                        {progress === 4 && <Truck size={32} className="text-white" />}
                                        {progress === 5 && <Check size={32} className="text-green-400" />}
                                        {progress === 0 && <X size={32} className="text-red-400" />}
                                        
                                        {/* Status Ring */}
                                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                                            <circle cx="48" cy="48" r="46" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                                            <circle cx="48" cy="48" r="46" fill="none" stroke="currentColor" strokeWidth="2" className="text-white" strokeDasharray="289" strokeDashoffset={289 - (289 * (progress / 5))} strokeLinecap="round" />
                                        </svg>
                                    </div>

                                    <div className="flex-1 text-center md:text-left space-y-2">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-wider text-white/80">
                                            <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.color} animate-pulse`} />
                                            Live Status
                                        </div>
                                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
                                            {statusInfo.label}
                                        </h2>
                                        <p className="text-lg text-white/60 leading-relaxed font-medium max-w-lg">
                                            {statusInfo.description}
                                        </p>
                                        {showQueue && queueLabel && (
                                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 text-sm text-white font-semibold">
                                                <Clock size={14} />
                                                {queueLabel}
                                            </div>
                                        )}
                                        
                                        {/* AI Insight / Status Description */}
                                        {details?.order?.expert_comment && (
                                            <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 text-sm md:text-base text-white/80 leading-relaxed font-mono">
                                                <span className="text-blue-400 font-bold mr-2">Expert Note:</span>
                                                "{details.order.expert_comment}"
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Visual Stepper Line */}
                                <div className="mt-12 relative h-1 bg-white/10 rounded-full">
                                    <div 
                                        className={`absolute top-0 left-0 h-full ${statusInfo.color} rounded-full transition-all duration-1000 shadow-[0_0_20px_currentColor]`}
                                        style={{ width: `${((progress - 1) / 4) * 100}%` }}
                                    />
                                    <div className="absolute inset-0 flex justify-between -top-1.5">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <div key={s} className={cn(
                                                "w-4 h-4 rounded-full border-2 transition-all duration-500",
                                                progress >= s ? `bg-current border-current shadow-[0_0_10px_currentColor] ${statusInfo.color.replace('bg-', 'text-')}` : "bg-zinc-900 border-white/20"
                                            )} />
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-white/40">
                                    <span>Start</span>
                                    <span>Finish</span>
                                </div>
                            </div>

                            {/* Mobile Quick Actions Grid */}
                            <div className="grid grid-cols-3 gap-3 md:hidden">
                                <div onClick={() => setDeliveryDialogOpen(true)} className="bg-white p-3 rounded-2xl border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Truck size={20} />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-900">Доставка</span>
                                </div>
                                <div onClick={() => setManagerMessageOpen(true)} className="bg-white p-3 rounded-2xl border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
                                    <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center">
                                        <MessageCircle size={20} />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-900">Чат</span>
                                </div>
                                <div className="bg-white p-3 rounded-2xl border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform opacity-50">
                                    <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                                        <FileText size={20} />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-900">Доки</span>
                                </div>
                            </div>

                            {/* 2. 3D Globe Flight Map & Delivery Control */}
                            <div className="bg-black rounded-[2.5rem] h-[320px] md:h-[500px] relative overflow-hidden shadow-2xl border border-zinc-800 group">
                                <div className="absolute top-6 left-6 z-10 pointer-events-none">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Globe className="text-blue-500" size={20} />
                                        <span className="text-white font-bold tracking-wide">GLOBAL TRACKING</span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">{routeFrom} <span className="text-zinc-500">→</span> {routeTo}</h3>
                                    <p className="text-zinc-500 text-sm mt-1">Маршрут и сроки уточняются по данным заказа</p>
                                </div>

                                <div className="absolute inset-0 flex items-center justify-center">
                                    <GlobeComponent />
                                </div>
                                
                                <div className="absolute bottom-6 left-6 right-6 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0">
                                        <Truck size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs text-white/60 font-bold uppercase">Способ доставки</div>
                                        <div className="text-white font-bold truncate">
                                            {details?.order?.delivery_method || "Не выбран"}
                                        </div>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-white hover:bg-white/20 hover:text-white rounded-full px-3 h-8 text-xs font-bold"
                                        onClick={() => setDeliveryDialogOpen(true)}
                                    >
                                        Изменить
                                    </Button>
                                    <div className="text-right pl-2 border-l border-white/10 hidden sm:block">
                                        <div className="text-xs text-white/60 font-bold uppercase">Оценка</div>
                                        <div className="text-white font-bold">~14 дней</div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* 3. Live Checklist (New - Integrated into Left Column for visibility) */}
                            <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-xl shadow-zinc-200/50">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                        <CheckCircle size={20} />
                                    </div>
                                    <h3 className="text-xl font-bold text-zinc-900">Чеклист инспекции</h3>
                                    <span className="ml-auto text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full uppercase tracking-wider">
                                        Проверка AI
                                    </span>
                                </div>
                                
                                <div className="space-y-3">
                                    {checklistItems.length === 0 && (
                                        <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-500">
                                            Чеклист еще не заполнен. Менеджер добавит результаты после проверки.
                                        </div>
                                    )}
                                    {checklistItems.map((item, i) => (
                                        <Accordion key={i} type="single" collapsible className="bg-zinc-50 rounded-xl border border-zinc-100 overflow-hidden">
                                            <AccordionItem value={`item-${i}`} className="border-0">
                                                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-zinc-100/50 transition-colors">
                                                    <div className="flex items-center justify-between w-full pr-4">
                                                        <span className="font-medium text-zinc-700">{item.label}</span>
                                                        {item.status === 'checked' ? (
                                                            <div className="flex items-center gap-1.5 text-green-600 text-xs font-bold uppercase">
                                                                <Check size={14} /> OK
                                                            </div>
                                                        ) : item.status === 'failed' ? (
                                                            <div className="flex items-center gap-1.5 text-red-600 text-xs font-bold uppercase">
                                                                <X size={14} /> Проблема
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold uppercase">
                                                                <Loader2 size={14} className="animate-spin" /> Проверка
                                                            </div>
                                                        )}
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-4 pb-3 pt-0 text-sm text-zinc-500">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-start gap-2">
                                                            <div className={`min-w-[4px] h-4 rounded-full ${item.status === 'checked' ? 'bg-green-500' : item.status === 'failed' ? 'bg-red-500' : 'bg-zinc-300'} mt-0.5`} />
                                                            <span>{item.note}</span>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    ))}
                                </div>
                            </div>
 
                         </div>

                        {/* RIGHT COLUMN (Manager & Receipt) */}
                        <div className="lg:col-span-4 space-y-6">

                            {/* Reservation */}
                            <div className="bg-white rounded-[2rem] p-6 border border-zinc-100 shadow-xl shadow-zinc-200/50">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold">2%</div>
                                        <div>
                                            <div className="font-bold text-lg text-zinc-900">Резервирование</div>
                                            <div className="text-xs text-zinc-500 uppercase tracking-wider">Опционально</div>
                                        </div>
                                    </div>
                                    {reservationPaid ? (
                                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">Оплачено</span>
                                    ) : null}
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between font-semibold text-zinc-900">
                                        <span>Сумма резерва</span>
                                        <span>{bookingAmountRub ? bookingAmountRub.toLocaleString('ru-RU') : '...'} ₽</span>
                                    </div>
                                    <div className="text-zinc-600 leading-relaxed">
                                        Резерв закрепляет байк за вами. Возвращается, если класс окажется хуже или продавец откажется.
                                    </div>
                                </div>
                                <Button 
                                    className="w-full h-11 mt-4 rounded-xl bg-black text-white font-bold disabled:bg-zinc-300"
                                    disabled={reservationPaid || !bookingAmountRub || reserving}
                                    onClick={openReserveDialog}
                                >
                                    {reservationPaid ? "Резерв оплачен" : reserving ? "Оплачиваем..." : "Оплатить резерв"}
                                </Button>
                            </div>

                            {/* Addons */}
                            <div className="bg-white rounded-[2rem] p-6 border border-zinc-100 shadow-xl shadow-zinc-200/50">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700 font-bold">+</div>
                                    <div>
                                        <div className="font-bold text-lg text-zinc-900">Доп услуги</div>
                                        <div className="text-xs text-zinc-500 uppercase tracking-wider">Выбраны при брони</div>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    {addonsLines && addonsLines.length ? addonsLines.map((a: any) => (
                                        <div key={a.id} className="flex justify-between">
                                            <span className="text-zinc-700">{a.title || a.id}</span>
                                            <span className="text-zinc-900 font-medium">×{a.qty}</span>
                                        </div>
                                    )) : (
                                        <div className="text-zinc-500">Без доп услуг</div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Manager Card */}
                            <div className="bg-white rounded-[2rem] p-6 border border-zinc-100 shadow-xl shadow-zinc-200/50 hidden md:block">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                        {managerName ? managerName[0].toUpperCase() : "M"}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg text-zinc-900">
                                                {managerName}
                                            </h3>
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Online" />
                                        </div>
                                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Персональный эксперт</p>
                                    </div>
                                </div>
                                
                                <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 mb-4 relative">
                                    <div className="absolute -top-2 left-6 w-4 h-4 bg-zinc-50 border-t border-l border-zinc-100 transform rotate-45" />
                                    <p className="text-sm text-zinc-600 italic leading-relaxed">
                                        "Ваш эксперт уже связался с продавцом, ожидаем ответ по состоянию трансмиссии в течение 2 часов."
                                    </p>
                                </div>

                                <Button 
                                    className="w-full h-12 rounded-xl bg-black text-white hover:bg-zinc-800 font-bold shadow-lg"
                                    onClick={() => setManagerMessageOpen(true)}
                                >
                                    <MessageCircle className="w-4 h-4 mr-2" />
                                    Написать в чат
                                </Button>
                            </div>

                            <div className="bg-white rounded-[2rem] p-6 border border-zinc-100 shadow-xl shadow-zinc-200/50">
                                <div className="font-bold text-zinc-900">Доступ к отслеживанию</div>
                                <p className="text-sm text-zinc-500 mt-2">
                                    Отслеживание уже работает без регистрации. Чтобы не потерять доступ на других устройствах, сохраните email и пароль.
                                </p>
                                {authHint && (
                                    <div className="mt-3 rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-700 space-y-1">
                                        <div>Войдите с данными:</div>
                                        <div>Логин: <span className="font-semibold">{authHint.login || 'ваш контакт'}</span></div>
                                        <div>Пароль: <span className="font-semibold">{authHint.tempPassword || 'одноразовый пароль из брони'}</span></div>
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    className="w-full h-11 mt-4 rounded-xl"
                                    onClick={() => setProfileDialogOpen(true)}
                                >
                                    Сохранить доступ
                                </Button>
                            </div>

                            {/* Documents Vault (Genius) */}
                            <div className="bg-white rounded-[2rem] p-6 border border-zinc-100 shadow-xl shadow-zinc-200/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                        <FileText size={20} />
                                    </div>
                                    <h3 className="font-bold text-zinc-900">Документы</h3>
                                </div>
                                <div className="space-y-2">
                                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                                        <div className="text-sm font-bold text-zinc-900">Пакет документов по заказу {details?.order?.order_number}</div>
                                        <div className="text-xs text-zinc-500 mt-1">
                                            {[ORDER_STATUS.WAREHOUSE_RECEIVED, ORDER_STATUS.WAREHOUSE_REPACKED, ORDER_STATUS.SHIPPED_TO_RUSSIA, ORDER_STATUS.DELIVERED, ORDER_STATUS.CLOSED].includes(normalizedCurrentStatus)
                                                ? 'Документы формируются менеджером и будут доступны по запросу.'
                                                : 'Документы будут подготовлены после подтверждения и оплаты заказа.'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Apple-Style Receipt */}
                            <Accordion type="single" collapsible className="bg-white rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-200/50 overflow-hidden">
                                <AccordionItem value="receipt" className="border-0">
                                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-zinc-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                                                <FileText size={16} className="text-zinc-600" />
                                            </div>
                                            <span className="font-bold text-zinc-900">Детализация цены</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-6 pb-6 pt-2 bg-zinc-50/50">
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-zinc-500">Стоимость байка</span>
                                                <span className="font-medium text-zinc-900">{financials?.bike_price_eur ?? '...'} €</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-zinc-500 flex items-center gap-1">
                                                    <Truck size={12} /> Доставка
                                                </span>
                                                <span className="font-medium text-zinc-900">{financials?.shipping_cost_eur ?? '...'} €</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-zinc-500 flex items-center gap-1">
                                                    <ShieldAlert size={12} /> Комиссия сервиса
                                                </span>
                                                <span className="font-medium text-zinc-900">{financials?.service_fee_eur ?? '...'} €</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-zinc-500 flex items-center gap-1">
                                                    <CreditCard size={12} /> Комиссия перевода
                                                </span>
                                                <span className="font-medium text-zinc-900">{financials?.payment_commission_eur ?? 0} €</span>
                                            </div>
                                            <div className="h-px bg-zinc-200 my-2" />
                                            <div className="flex justify-between text-base font-bold">
                                                <span className="text-zinc-900">Итого</span>
                                                <span className="text-zinc-900">{financials?.final_price_eur ?? details?.order?.final_price_eur ?? '...'} €</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-zinc-400">
                                                <span>В рублях (курс {financials?.exchange_rate ?? details?.order?.exchange_rate ?? 105})</span>
                                                <span>{(totalPriceRub || details?.order?.total_price_rub || 0).toLocaleString('ru-RU') || '...'} ₽</span>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>

                        </div>
                    </div>

                    {/* Mobile Sticky Footer */}
                    <div className="fixed bottom-4 left-4 right-4 md:hidden z-50">
                        <Button 
                            className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-bold shadow-2xl shadow-black/20 flex items-center justify-between px-6 active:scale-[0.98] transition-transform"
                            onClick={() => setManagerMessageOpen(true)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <MessageCircle size={18} />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs text-white/60 uppercase font-bold tracking-wider">Есть вопросы?</div>
                                    <div className="text-sm">Написать менеджеру</div>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-white/60" />
                        </Button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Dialogs */}
        <Dialog open={managerMessageOpen} onOpenChange={setManagerMessageOpen}>
            <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Написать менеджеру</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <p className="text-sm text-zinc-500">
                        Ваше сообщение будет отправлено личному менеджеру в Telegram. Ответ придет в течение 15 минут.
                    </p>
                    <textarea 
                        className="w-full h-32 p-4 rounded-xl bg-zinc-50 border-zinc-200 focus:ring-2 focus:ring-black focus:border-transparent resize-none text-sm"
                        placeholder="Напишите ваш вопрос..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                    />
                    <Button 
                        className="w-full h-12 rounded-xl font-bold"
                        onClick={handleSendMessage}
                        disabled={sendingMessage || !messageText.trim()}
                    >
                        {sendingMessage ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 w-4 h-4" />}
                        Отправить
                    </Button>
                </div>
            </DialogContent>
        </Dialog>

        <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
            <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Способ доставки</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                    {[
                        { id: 'Cargo', title: 'Cargo (Авто)', time: '14-18 дней', price: 'Включено' },
                        { id: 'EMS', title: 'EMS (Авиа)', time: '7-10 дней', price: '+120 €' },
                        { id: 'Premium', title: 'Premium (Лично)', time: '3-5 дней', price: '+450 €' },
                    ].map((method) => (
                        <div 
                            key={method.id}
                            onClick={() => handleDeliverySelect(method.id)}
                            className={cn(
                                "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all hover:bg-zinc-50",
                                (details?.order?.delivery_method === method.id || (!details?.order?.delivery_method && method.id === 'Cargo')) ? "border-black bg-zinc-50 ring-1 ring-black" : "border-zinc-200"
                            )}
                        >
                            <div>
                                <div className="font-bold text-sm text-zinc-900">{method.title}</div>
                                <div className="text-xs text-zinc-500">{method.time}</div>
                            </div>
                            <div className="text-sm font-medium text-zinc-900">{method.price}</div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>

        {/* Confirmation Dialog for Delivery Change */}
        <Dialog open={deliveryConfirmOpen} onOpenChange={setDeliveryConfirmOpen}>
            <DialogContent className="sm:max-w-[400px] rounded-3xl p-6 text-center">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-center">Изменить способ доставки?</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-3">
                    <p className="text-zinc-500 text-sm leading-relaxed">
                        Вы собираетесь изменить способ доставки на <b>{pendingDeliveryMethod}</b>. 
                        Это изменит итоговую стоимость заказа. Цена бронирования (задаток) не изменится.
                    </p>
                    <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-xs font-bold">
                        Менеджер получит уведомление об изменении.
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setDeliveryConfirmOpen(false)}>
                        Отмена
                    </Button>
                    <Button className="flex-1 rounded-xl h-12 bg-black text-white hover:bg-black/90" onClick={handleDeliveryConfirm}>
                        Подтвердить
                    </Button>
                </div>
            </DialogContent>
        </Dialog>

        <Dialog open={reserveDialogOpen} onOpenChange={(open) => {
            if (!open && reserving) return;
            if (!open) setReserveStep('confirm');
            setReserveDialogOpen(open);
        }}>
            <DialogContent className="sm:max-w-[420px] rounded-[16px] p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Оплата резерва</DialogTitle>
                </DialogHeader>
                {reserveStep === 'success' ? (
                    <div className="space-y-4 pt-2">
                        <div className="rounded-xl bg-emerald-50 text-emerald-700 p-4 text-sm font-medium">
                            Спасибо за оплату. Резерв успешно зачислен, байк закреплен за вами в очереди.
                        </div>
                        <div className="rounded-xl bg-zinc-50 text-zinc-600 p-3 text-xs">
                            Текущий режим оплаты: placeholder (тестовый шлюз). Позже заменим на реальный платежный API.
                        </div>
                        <Button className="w-full h-12 rounded-[8px] bg-black text-white" onClick={() => setReserveDialogOpen(false)}>
                            Закрыть
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4 pt-2">
                        <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 space-y-2">
                            <div className="flex justify-between font-semibold text-zinc-900">
                                <span>Сумма резерва</span>
                                <span>{bookingAmountRub ? bookingAmountRub.toLocaleString('ru-RU') : '...'} ₽</span>
                            </div>
                            <p className="text-xs text-zinc-500">Резерв 2% фиксирует приоритет и вычитается из стоимости выкупа.</p>
                            <p className="text-xs text-zinc-500">Возвращается, если класс хуже ожиданий или сделка срывается по вине продавца.</p>
                        </div>
                        <Button
                            className="w-full h-12 rounded-[8px] bg-black text-white"
                            disabled={reserving || !bookingAmountRub}
                            onClick={handleReserve}
                        >
                            {reserving || reserveStep === 'processing' ? "Оплачиваем..." : "Оплатить"}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>

        <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
            <DialogContent className="sm:max-w-[420px] rounded-[16px] p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Подтвердите доступ</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                    <p className="text-sm text-zinc-500">
                        Мы создали для вас аккаунт с одноразовым паролем. Укажите email и задайте новый пароль, чтобы не потерять доступ.
                    </p>
                    <div>
                        <label className="text-xs uppercase tracking-wide text-zinc-500">Email</label>
                        <Input
                            value={profileEmail}
                            onChange={(e) => setProfileEmail(e.target.value)}
                            className="mt-2 h-12 rounded-[12px] bg-[#f4f4f5] border-none"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-wide text-zinc-500">Новый пароль</label>
                        <Input
                            type="password"
                            value={profilePassword}
                            onChange={(e) => setProfilePassword(e.target.value)}
                            className="mt-2 h-12 rounded-[12px] bg-[#f4f4f5] border-none"
                            placeholder="Минимум 8 символов"
                        />
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-wide text-zinc-500">Подтверждение пароля</label>
                        <Input
                            type="password"
                            value={profileConfirm}
                            onChange={(e) => setProfileConfirm(e.target.value)}
                            className="mt-2 h-12 rounded-[12px] bg-[#f4f4f5] border-none"
                            placeholder="Повторите пароль"
                        />
                    </div>
                    {profileError && <div className="text-sm text-red-600">{profileError}</div>}
                    <Button
                        className="w-full h-12 rounded-[8px] bg-black text-white"
                        disabled={profileSaving}
                        onClick={handleCompleteProfile}
                    >
                        {profileSaving ? "Сохраняем..." : "Сохранить"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>

      </main>
    </div>
  )
}



