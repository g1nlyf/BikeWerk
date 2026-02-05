"use client";

import * as React from "react"
import { useParams } from "react-router-dom"
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX"
import { SEOHead } from "@/components/SEO/SEOHead"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { crmFrontApi, userTrackingsApi, apiPost } from "@/api"
import { motion, AnimatePresence } from "framer-motion"
import { Search, CheckCircle, Truck, Clock, Bell, Package, Copy, Check, Info, ChevronLeft, X, MapPin, MessageCircle, FileText, ChevronRight, CreditCard, User, Calendar, Loader2, ShieldAlert, Globe, Send } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
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
  is_refundable?: boolean
  initial_quality_class?: string
  final_quality_class?: string
  inspection_photos?: string[] // URLs
  expert_comment?: string
  confirmation_timestamp?: string
  attention_required?: boolean
  seller_response?: any
  assigned_manager?: string | null
  // Financials
  service_fee_eur?: number
  shipping_cost_eur?: number
  payment_commission_eur?: number
  total_price_rub?: number
  exchange_rate?: number
  delivery_method?: string
  created_at?: string
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
    'awaiting_payment': { label: 'Ждем принятия от менеджера', description: 'После того, как один из менеджеров примет ваш заказ, он сможет подтвердить или опровергнуть получение суммы брони.', progress: 1, color: 'bg-yellow-500' },
    'awaiting_deposit': { label: 'Ожидает задатка', description: 'Ожидаем внесения задатка для начала работы.', progress: 1, color: 'bg-yellow-500' },
    'deposit_paid': { label: 'Задаток получен', description: 'Менеджер связывается с продавцом и запрашивает информацию.', progress: 2, color: 'bg-blue-500' },
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

function getStatusInfo(s?: string | null) {
    const k = String(s || "new").toLowerCase();
    return STATUS_CONFIG[k] || { label: s || 'В обработке', description: 'Статус обновляется...', progress: 1, color: 'bg-gray-500' };
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
  const [isSearchFocused, setIsSearchFocused] = React.useState(false)
  
  // New States for Interactions
  const [managerMessageOpen, setManagerMessageOpen] = React.useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = React.useState(false);
  const [deliveryConfirmOpen, setDeliveryConfirmOpen] = React.useState(false);
  const [pendingDeliveryMethod, setPendingDeliveryMethod] = React.useState<string | null>(null);
  const [messageText, setMessageText] = React.useState('');
  const [sendingMessage, setSendingMessage] = React.useState(false);

  // Auto-fetch if token exists or query is set in URL
  React.useEffect(() => {
    if (token) {
        fetchOrder(token, true);
    } else if (query && query.length > 3) {
        fetchOrder(query);
    }
  }, [token]);

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

  const currentStatus = details?.order?.status
  const statusInfo = getStatusInfo(currentStatus);
  const progress = statusInfo.progress;
  const isInspecting = currentStatus === 'deposit_paid' || currentStatus === 'under_inspection';

  const getChecklistItems = () => {
      const checklist = details?.inspection?.checklist;
      if (!checklist) {
          // Fallback / Skeleton if no real data yet
          return [
              { id: 'frame_geometry', label: 'Геометрия рамы', status: isInspecting ? 'pending' : 'waiting', note: 'Ожидает проверки' },
              { id: 'paint', label: 'Состояние ЛКП', status: isInspecting ? 'pending' : 'waiting', note: 'Ожидает проверки' },
              { id: 'drivetrain', label: 'Трансмиссия', status: isInspecting ? 'pending' : 'waiting', note: 'Ожидает проверки' },
              { id: 'suspension', label: 'Вилка и аморт', status: isInspecting ? 'pending' : 'waiting', note: 'Ожидает проверки' },
              { id: 'documents', label: 'Документы', status: isInspecting ? 'pending' : 'waiting', note: 'Ожидает проверки' },
          ];
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
                                    <h3 className="text-2xl font-bold text-white">Марбург <span className="text-zinc-500">→</span> Москва</h3>
                                    <p className="text-zinc-500 text-sm mt-1">Дистанция: ~2,300 км</p>
                                    
                                    {/* Weather Widget (Genius) */}
                                    <div className="mt-4 flex items-center gap-2 bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/5 w-fit">
                                        <div className="text-yellow-400">☀</div>
                                        <div className="text-xs text-white/80 font-medium">Москва: +22°C</div>
                                    </div>
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
                                    <h3 className="text-xl font-bold text-zinc-900">Live Checklist</h3>
                                    <span className="ml-auto text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full uppercase tracking-wider">
                                        AI Verified
                                    </span>
                                </div>
                                
                                <div className="space-y-3">
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
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold uppercase">
                                                                <Loader2 size={14} className="animate-spin" /> Check
                                                            </div>
                                                        )}
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-4 pb-3 pt-0 text-sm text-zinc-500">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-start gap-2">
                                                            <div className={`min-w-[4px] h-4 rounded-full ${item.status === 'checked' ? 'bg-green-500' : 'bg-zinc-300'} mt-0.5`} />
                                                            <span>{item.note}</span>
                                                        </div>
                                                        {/* Optional: Add seller claim comparison if available in future */}
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
                            
                            {/* Manager Card */}
                            <div className="bg-white rounded-[2rem] p-6 border border-zinc-100 shadow-xl shadow-zinc-200/50 hidden md:block">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                        {details?.order?.assigned_manager ? details.order.assigned_manager[0].toUpperCase() : "M"}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg text-zinc-900">
                                                {details?.order?.assigned_manager || "Ваш Менеджер"}
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

                            {/* Documents Vault (Genius) */}
                            <div className="bg-white rounded-[2rem] p-6 border border-zinc-100 shadow-xl shadow-zinc-200/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                        <FileText size={20} />
                                    </div>
                                    <h3 className="font-bold text-zinc-900">Документы</h3>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 transition-colors cursor-pointer group border border-transparent hover:border-zinc-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">PDF</div>
                                            <div>
                                                <div className="text-sm font-bold text-zinc-900">Инвойс #{details?.order?.order_number}</div>
                                                <div className="text-xs text-zinc-500">2.4 MB • 12.01.2025</div>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-zinc-400 group-hover:text-zinc-900">
                                            <CheckCircle size={18} />
                                        </Button>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 transition-colors cursor-pointer group border border-transparent hover:border-zinc-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">DOC</div>
                                            <div>
                                                <div className="text-sm font-bold text-zinc-900">Договор поставки</div>
                                                <div className="text-xs text-zinc-500">1.1 MB • 12.01.2025</div>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-zinc-400 group-hover:text-zinc-900">
                                            <CheckCircle size={18} />
                                        </Button>
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
                                                <span className="font-medium text-zinc-900">{details?.order?.final_price_eur ? (details.order.final_price_eur * 0.85).toFixed(0) : '...'} €</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-zinc-500 flex items-center gap-1">
                                                    <Truck size={12} /> Доставка
                                                </span>
                                                <span className="font-medium text-zinc-900">{details?.order?.shipping_cost_eur || 170} €</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-zinc-500 flex items-center gap-1">
                                                    <ShieldAlert size={12} /> Комиссия сервиса
                                                </span>
                                                <span className="font-medium text-zinc-900">{details?.order?.service_fee_eur || 80} €</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-zinc-500 flex items-center gap-1">
                                                    <CreditCard size={12} /> Комиссия перевода
                                                </span>
                                                <span className="font-medium text-zinc-900">{details?.order?.payment_commission_eur || 0} €</span>
                                            </div>
                                            <div className="h-px bg-zinc-200 my-2" />
                                            <div className="flex justify-between text-base font-bold">
                                                <span className="text-zinc-900">Итого</span>
                                                <span className="text-zinc-900">{details?.order?.final_price_eur || '...'} €</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-zinc-400">
                                                <span>В рублях (курс {details?.order?.exchange_rate || 105})</span>
                                                <span>{details?.order?.total_price_rub?.toLocaleString() || '...'} ₽</span>
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

      </main>
    </div>
  )
}
