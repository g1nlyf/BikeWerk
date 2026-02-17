"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Check, X, Bike, ArrowRight, Lock, Zap, Search, ChevronDown, Wallet, ShieldCheck, Pencil, Truck, Phone, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiPost, metricsApi } from "@/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { calculatePriceBreakdown } from "@/lib/pricing";
import { OrderSuccessOverlay } from "@/components/checkout/OrderSuccessOverlay";

// Types
type OrderItem = {
  id: string | number;
  name: string;
  price: number; // EUR
  image?: string;
  details?: { brand?: string; model?: string; year?: number; size?: string; };
  link?: string;
};

interface UniversalOrderOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: OrderItem[];
  mode: "single" | "cart";
  onSuccess?: (result: any) => void;
  initialStep?: "contact" | "faq";
  depositAmount?: number; // Should be in RUB
  priceRub?: number; // Total price in RUB
  shippingOption?: string;
  insuranceIncluded?: boolean;
  finalPriceEur?: number;
  exchangeRate?: number;
  onEditDelivery?: () => void;
}

export function BookingOverlay({
  open,
  onOpenChange,
  items,
  shippingOption,
  insuranceIncluded,
  onEditDelivery
}: UniversalOrderOverlayProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form State
  const [name, setName] = React.useState(user?.name || "");
  const [contactMethod, setContactMethod] = React.useState<"telegram" | "whatsapp" | "phone">("telegram");
  const [contactValue, setContactValue] = React.useState(user?.phone || user?.email || "");
  const [communicationMode, setCommunicationMode] = React.useState<"autopilot" | "concierge">("autopilot");

  // SPRINT 2: UNIFIED UI
  // Always use the single source of truth for pricing.
  // Use props from parent if available (dynamic selection), otherwise default to business logic.
  const calc = React.useMemo(() => {
    const bikePrice = items[0]?.price || 0;
    const method = (shippingOption as 'Cargo' | 'EMS' | 'Premium') || 'Cargo';
    const insurance = insuranceIncluded !== undefined ? insuranceIncluded : true;
    return calculatePriceBreakdown(bikePrice, method, insurance);
  }, [items, shippingOption, insuranceIncluded]);

  const safePriceRub = calc.totalRub;
  const depositAmount = calc.bookingRub;
  const eurToRubRate = calc.details.exchangeRate;

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setError(null);
      if (user) {
        setName(user.name || "");
        setContactValue(user.phone || user.email || "");
      }
    }
  }, [open, user]);

  // Timeline State
  const [timelineExpanded, setTimelineExpanded] = React.useState(false);

  // New Process Info State
  const [showProcessInfo, setShowProcessInfo] = React.useState(false);

  // New Success Flow State
  const [successOrderCode, setSuccessOrderCode] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !contactValue.trim()) {
      const missingFields: string[] = [];
      if (!name.trim()) missingFields.push("name");
      if (!contactValue.trim()) missingFields.push("contact");
      metricsApi.sendEvents([
        {
          type: "checkout_validation_error",
          bikeId: Number(items[0]?.id || 0),
          metadata: { flow: "booking_overlay", missing_fields: missingFields }
        }
      ]).catch(() => void 0);
      setError("Представьтесь, пожалуйста");
      return;
    }
    setSubmitting(true);
    setError(null);
    metricsApi.sendEvents([
      {
        type: "checkout_submit_attempt",
        bikeId: Number(items[0]?.id || 0),
        metadata: { flow: "booking_overlay", contact_method: contactMethod, delivery_option: shippingOption || 'Cargo' }
      }
    ]).catch(() => void 0);

    try {
      // SPRINT 3.1: Ensure delivery method is never empty
      const effectiveDeliveryMethod = shippingOption || 'Cargo';

      const payload = {
        bike_id: items[0].id,
        delivery_method: effectiveDeliveryMethod,
        communication_mode: communicationMode,
        customer: {
            full_name: name,
            name,
            email: contactMethod === 'phone' ? undefined : contactValue, 
            phone: contactMethod === 'phone' ? contactValue : undefined,
            telegram_id: contactMethod === 'telegram' ? contactValue.replace('@', '') : undefined
        },
        bike_details: {
            ...items[0],
            bike_url: items[0].link || (items[0] as any).url, // Ensure external link is captured
            shipping_option: effectiveDeliveryMethod
        },
        // Financials
        total_price_rub: safePriceRub,
        booking_amount_rub: depositAmount,
        exchange_rate: eurToRubRate,
        final_price_eur: items.reduce((s, i) => s + i.price, 0)
      };

      const res = await apiPost('/v1/booking', payload);
      
      if (res?.success) {
        metricsApi.sendEvents([
          {
            type: "checkout_submit_success",
            bikeId: Number(items[0]?.id || 0),
            metadata: { flow: "booking_overlay", order_code: res?.order_code || null }
          }
        ]).catch(() => void 0);
        // SPRINT 2: NO REDIRECT - Show Success Overlay
        setSuccessOrderCode(res.order_code);
        // Do NOT close the modal immediately, switch content
      } else {
        throw new Error(res?.error || "Ошибка создания заявки");
      }
    } catch (e: any) {
      metricsApi.sendEvents([
        {
          type: "checkout_submit_failed",
          bikeId: Number(items[0]?.id || 0),
          metadata: { flow: "booking_overlay", error: String(e?.message || "unknown") }
        }
      ]).catch(() => void 0);
      setError(e.message || "Ошибка соединения. Мы уже сохранили ваш черновик.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-version="2.0" className="w-[95vw] max-w-[400px] sm:max-w-[900px] p-0 gap-0 overflow-hidden bg-white rounded-3xl sm:rounded-[24px] border-0 shadow-2xl h-[90dvh] sm:h-[85vh] flex flex-col my-auto top-[50%] translate-y-[-50%]">
        
        {/* Success State */}
        {successOrderCode ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-white p-8">
                <OrderSuccessOverlay orderNumber={successOrderCode} orderId={successOrderCode} onClose={() => onOpenChange(false)} embedded={true} />
            </div>
        ) : (
            <div className="flex flex-col sm:flex-row h-full">
                
                {/* LEFT SIDE: Bike Info & Process Steps (Visible on Desktop, Top on Mobile) */}
                <div className="hidden sm:flex w-[350px] bg-slate-50 border-r border-gray-100 flex-col shrink-0 overflow-y-auto">

                    {/* Bike Card */}
                    <div className="p-5 sm:p-6">
                        <div className="flex sm:flex-col gap-4">
                            <div className="h-20 w-20 sm:h-48 sm:w-full rounded-2xl bg-white p-1 shadow-sm border border-gray-100 overflow-hidden shrink-0 relative group">
                                <div className="h-full w-full rounded-xl overflow-hidden relative">
                                    {items[0]?.image ? (
                                        <img src={items[0].image} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" alt="" />
                                    ) : <Bike className="absolute inset-0 m-auto text-gray-400 h-8 w-8"/>}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <Badge variant="outline" className="bg-white text-gray-500 border-gray-200 mb-1.5 text-[10px] uppercase tracking-wider">
                                    {items[0]?.details?.brand || "Bike"}
                                </Badge>
                                <h3 className="font-bold text-base sm:text-xl text-gray-900 leading-tight mb-1 truncate">
                                    {items[0]?.name}
                                </h3>
                                <div className="text-sm text-muted-foreground mb-3">
                                    Полная цена: <span className="text-gray-900 font-semibold">{safePriceRub.toLocaleString()} ₽</span>
                                </div>
                            </div>
                        </div>

                        {/* Desktop Process Steps */}
                        <div className="hidden sm:block mt-8 space-y-6">
                            <h4 className="font-bold text-sm uppercase tracking-wider text-gray-400 mb-4">Процесс сделки</h4>
                            
                            <div className="relative pl-4 border-l-2 border-gray-100 space-y-6">
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-black ring-4 ring-slate-50" />
                                    <div className="text-sm font-bold text-gray-900">Оплата брони</div>
                                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        Вносите задаток {depositAmount.toLocaleString()} ₽. Мы фиксируем цену и снимаем байк с продажи.
                                    </div>
                                </div>

                                <div className="relative">
                                    <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-gray-200 ring-4 ring-slate-50" />
                                    <div className="text-sm font-bold text-gray-900">Проверка истории</div>
                                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        Полностью проверяем историю байка и предоставляем подробный отчет.
                                    </div>
                                </div>

                                <div className="relative">
                                    <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-gray-200 ring-4 ring-slate-50" />
                                    <div className="text-sm font-bold text-gray-900">Выкуп и логистика</div>
                                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        Выкупаем байк, он едет на личную проверку к нашему эксперту.
                                    </div>
                                </div>

                                <div className="relative">
                                    <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-gray-200 ring-4 ring-slate-50" />
                                    <div className="text-sm font-bold text-gray-900">Экспертная инспекция</div>
                                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        Распаковка, сборка, проверка комплектности и качества велосипеда.
                                    </div>
                                </div>

                                <div className="relative">
                                    <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-gray-200 ring-4 ring-slate-50" />
                                    <div className="text-sm font-bold text-gray-900">Упаковка и отправка</div>
                                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        После заключения эксперта байк профессионально упаковывается и отправляется к вам.
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                                    За счет такой схемы мы достигаем максимального качества сервиса, гарантируя что вам приедет именно то, что вы ожидаете.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE: Form & Actions */}
                <div className="flex-1 flex flex-col bg-white h-full relative">
                    <div className="sm:hidden flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white">
                        <span className="font-extrabold text-sm tracking-tight">Бронирование</span>
                        <button type="button" onClick={() => onOpenChange(false)} className="p-2 -mr-2 text-gray-400 active:scale-[0.98] transition-transform">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Header Desktop */}
                    <div className="hidden sm:flex items-center justify-between p-6 pb-2">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">Оформление заказа</h2>
                            <p className="text-sm text-muted-foreground">Заполните данные для договора</p>
                        </div>
                        <div onClick={() => onOpenChange(false)} className="cursor-pointer p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="h-5 w-5 text-gray-400" />
                        </div>
                    </div>

                    {/* Scrollable Form Content */}
                    <div 
                        data-testid="booking-overlay-content" 
                        className={cn(
                            "flex-1 min-h-0 p-4 sm:p-6 space-y-3 sm:space-y-5 scrollbar-hide pb-24",
                            timelineExpanded ? "overflow-y-auto" : "overflow-hidden sm:overflow-y-auto"
                        )}
                    >
                        
                        {/* 1. Mini Product Card (Mobile) */}
                        <div className="sm:hidden flex gap-3 p-2 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="h-12 w-12 rounded-xl bg-white border border-gray-100 overflow-hidden shrink-0">
                                {items[0]?.image ? (
                                    <img src={items[0].image} className="h-full w-full object-cover" alt="" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                        <Bike className="h-5 w-5 text-gray-400" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 truncate">
                                    {items[0]?.details?.brand || "Bike"}
                                </div>
                                <div className="text-xs font-extrabold tracking-tight text-gray-900 leading-tight line-clamp-1">
                                    {items[0]?.name}
                                </div>
                                <div className="flex items-center gap-2 text-[10px]">
                                    <span className="font-bold text-gray-900">{safePriceRub.toLocaleString()} ₽</span>
                                    <span className="text-gray-400">Бронь: {depositAmount.toLocaleString()} ₽</span>
                                </div>
                            </div>
                        </div>

                        {/* Delivery Method Summary (Mobile) */}
                        <div className="sm:hidden flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <Truck className="h-3.5 w-3.5 text-gray-500" />
                                <span className="text-xs font-medium text-gray-700">
                                    Доставка: <span className="text-gray-900 font-bold">{shippingOption === 'Premium' ? 'Сборный груз' : (shippingOption === 'EMS' ? 'Курьер (EMS)' : 'Карго')}</span>
                                </span>
                            </div>
                            {onEditDelivery && (
                                <button 
                                    onClick={onEditDelivery}
                                    className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {/* 2. Timeline with Fade (Mobile) */}
                        <div className="sm:hidden relative">
                            <div className="space-y-3 relative pl-4 ml-2 border-l border-gray-100">
                                {/* Step 1: Always Visible */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-black ring-4 ring-white" />
                                    <div className="text-xs font-bold text-gray-900">1. Оплата брони</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                                        Вносите задаток {depositAmount.toLocaleString()} ₽. Мы фиксируем цену.
                                    </div>
                                </div>

                                {/* Collapsible Steps */}
                                <AnimatePresence initial={false}>
                                    {timelineExpanded ? (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-3 pt-3"
                                        >
                                            {[
                                                { title: "2. Проверка истории", desc: "Полный отчет по базе и юридическая чистота." },
                                                { title: "3. Выкуп и логистика", desc: "Доставка к эксперту на базу в Европе." },
                                                { title: "4. Инспекция", desc: "Распаковка, сборка, проверка всех узлов." },
                                                { title: "5. Отправка вам", desc: "Профессиональная упаковка и страховка." }
                                            ].map((step, idx) => (
                                                <div key={idx} className="relative">
                                                    <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-gray-200 ring-4 ring-white" />
                                                    <div className="text-xs font-bold text-gray-900">{step.title}</div>
                                                    <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{step.desc}</div>
                                                </div>
                                            ))}
                                            
                                            <div className="pt-1">
                                                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-2 items-start">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                                                    <p className="text-[9px] text-emerald-800 font-medium leading-relaxed">
                                                        Гарантируем: если состояние байка не совпадет с заявленным — вернем задаток 100% моментально.
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => setTimelineExpanded(false)}
                                                className="w-full py-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1"
                                            >
                                                Свернуть <ChevronDown className="h-3 w-3 rotate-180" />
                                            </button>
                                        </motion.div>
                                    ) : (
                                        <div className="relative pt-3">
                                            {/* Step 2 Preview (Faded) */}
                                            <div className="relative opacity-40 blur-[1px]">
                                                <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-gray-200 ring-4 ring-white" />
                                                <div className="text-xs font-bold text-gray-900">2. Проверка истории</div>
                                                <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                                                    Полностью проверяем историю байка...
                                                </div>
                                            </div>
                                            
                                            {/* Fade Overlay & Button */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-white flex items-end justify-center pb-0">
                                                <button 
                                                    onClick={() => setTimelineExpanded(true)}
                                                    className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 shadow-sm rounded-full text-[10px] font-bold text-gray-700 hover:bg-gray-50 transition-all active:scale-95"
                                                >
                                                    Показать этапы <ChevronDown className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 ml-1">Ваши данные</Label>
                                <Input 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    placeholder="Имя Фамилия"
                                    className="h-10 text-base sm:text-sm rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all shadow-sm"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 ml-1">Куда отправить отчет</Label>
                                <div className="grid grid-cols-[auto_1fr] gap-2">
                                    <div className="relative">
                                        <div className="relative w-[50px] h-10">
                                            <select 
                                                className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                                                value={contactMethod}
                                                onChange={(e) => setContactMethod(e.target.value as any)}
                                            >
                                                <option value="telegram">Telegram</option>
                                                <option value="whatsapp">WhatsApp</option>
                                                <option value="phone">Телефон</option>
                                            </select>
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-gray-50 rounded-xl border border-transparent shadow-sm">
                                                {contactMethod === 'telegram' && <Send className="h-5 w-5 text-blue-500" />}
                                                {contactMethod === 'whatsapp' && <MessageCircle className="h-5 w-5 text-green-500" />}
                                                {contactMethod === 'phone' && <Phone className="h-5 w-5 text-gray-700" />}
                                            </div>
                                        </div>
                                    </div>
                                    <Input 
                                        value={contactValue} 
                                        onChange={e => setContactValue(e.target.value)} 
                                        placeholder={contactMethod === 'phone' || contactMethod === 'whatsapp' ? "+7 999 000-00-00" : "@username"}
                                        className="h-10 text-base sm:text-sm rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Communication Mode Cards */}
                        <div className="space-y-1.5">
                             <Label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 ml-1">Формат работы</Label>
                             <div className="grid grid-cols-2 gap-2">
                                <div
                                    onClick={() => setCommunicationMode('autopilot')}
                                    className={cn(
                                        "cursor-pointer p-3 rounded-xl border transition-all relative overflow-hidden group flex flex-col justify-between min-h-[4.5rem]",
                                        communicationMode === 'autopilot' 
                                            ? "border-black bg-black text-white shadow-xl shadow-black/20" 
                                            : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <Zap className={cn("h-4 w-4", communicationMode === 'autopilot' ? "fill-white text-white" : "fill-black text-black")} />
                                        {communicationMode === 'autopilot' && <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs leading-tight mb-0.5">
                                            Автопилот
                                        </div>
                                        <div className={cn("text-[9px] leading-tight", communicationMode === 'autopilot' ? "text-gray-400" : "text-gray-500")}>
                                            Уведомления в бот
                                        </div>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setCommunicationMode('concierge')}
                                    className={cn(
                                        "cursor-pointer p-3 rounded-xl border transition-all relative overflow-hidden group flex flex-col justify-between min-h-[4.5rem]",
                                        communicationMode === 'concierge' 
                                            ? "border-black bg-black text-white shadow-xl shadow-black/20" 
                                            : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <MessageCircle className={cn("h-4 w-4", communicationMode === 'concierge' ? "fill-white text-white" : "text-black")} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs leading-tight mb-0.5">
                                            Консьерж
                                        </div>
                                        <div className={cn("text-[9px] leading-tight", communicationMode === 'concierge' ? "text-gray-400" : "text-gray-500")}>
                                            Личный чат с профи
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm bg-red-50 p-4 rounded-2xl text-center font-medium border border-red-100 shadow-sm">
                                {error}
                            </div>
                        )}
                        
                        {/* Desktop Padding Bottom for safety */}
                        <div className="hidden sm:block h-6" />
                        {/* Mobile Extra Padding */}
                        <div className="sm:hidden h-20" />
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 sm:p-6 border-t border-gray-100 bg-white/80 backdrop-blur-md relative z-20">
                         <Button 
                            onClick={handleSubmit} 
                            disabled={submitting}
                            className="w-full h-14 sm:h-16 rounded-2xl text-base sm:text-lg font-bold bg-black text-white hover:bg-black/90 shadow-xl shadow-black/10 active:scale-[0.98] transition-all flex items-center justify-between px-6 group relative overflow-hidden"
                        >
                            {submitting ? (
                                <span className="w-full text-center">Обработка...</span>
                            ) : (
                                <>
                                    <div className="flex flex-col items-start relative z-10">
                                        <span className="leading-none tracking-tight">Внести задаток</span>
                                        <span className="text-[11px] sm:text-xs font-medium text-white/60 mt-0.5 tracking-wide">{depositAmount.toLocaleString()} ₽</span>
                                    </div>
                                    <div className="flex items-center gap-2 relative z-10">
                                        <span className="text-sm sm:text-base font-medium">Далее</span>
                                        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                    
                                    {/* Subtle gradient effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                                </>
                            )}
                        </Button>
                        
                        <div className="mt-3 hidden sm:flex items-center justify-center gap-2 text-[10px] text-gray-400 font-medium">
                            <Lock className="h-3 w-3" />
                            <span>Деньги холдируются. Возврат без вопросов.</span>
                        </div>
                        
                        <button 
                            onClick={() => setShowProcessInfo(true)}
                            className="w-full text-center text-[10px] text-gray-400 font-medium hover:text-gray-600 transition-colors py-1 sm:hidden"
                        >
                            Подробнее о процессе
                        </button>
                    </div>

                    {/* Mobile Process Info Sheet/Modal */}
                    <AnimatePresence>
                        {showProcessInfo && (
                            <motion.div 
                                initial={{ opacity: 0, y: 100 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 100 }}
                                className="absolute inset-0 z-50 bg-white p-6 flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold">Как это работает</h3>
                                    <button onClick={() => setShowProcessInfo(false)} className="p-2 -mr-2 bg-gray-100 rounded-full">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                                    <div className="relative pl-4 border-l-2 border-gray-100 space-y-8">
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-black ring-4 ring-white" />
                                            <div className="text-sm font-bold text-gray-900">1. Оплата брони</div>
                                            <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                                                Вносите задаток {depositAmount.toLocaleString()} ₽. Мы фиксируем цену и снимаем байк с продажи.
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-black ring-4 ring-white" />
                                            <div className="text-sm font-bold text-gray-900">2. Проверка истории</div>
                                            <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                                                Полностью проверяем историю байка и предоставляем подробный отчет.
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-black ring-4 ring-white" />
                                            <div className="text-sm font-bold text-gray-900">3. Выкуп и логистика</div>
                                            <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                                                Выкупаем байк, он едет на личную проверку к нашему эксперту.
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-black ring-4 ring-white" />
                                            <div className="text-sm font-bold text-gray-900">4. Экспертная инспекция</div>
                                            <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                                                Распаковка, сборка, проверка комплектности и качества велосипеда.
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-black ring-4 ring-white" />
                                            <div className="text-sm font-bold text-gray-900">5. Упаковка и отправка</div>
                                            <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                                                После заключения эксперта байк профессионально упаковывается и отправляется к вам.
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <p className="text-sm text-emerald-800 font-medium leading-relaxed">
                                            За счет такой схемы мы достигаем максимального качества сервиса, гарантируя что вам приедет именно то, что вы ожидаете.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 mt-auto">
                                    <Button onClick={() => setShowProcessInfo(false)} className="w-full h-12 rounded-xl bg-black text-white font-bold">
                                        Всё понятно
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
