"use client";

import * as React from "react"
import { useParams } from "react-router-dom"
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX"
import { crmFrontApi } from "@/api"
import { motion } from "framer-motion"
import { CheckCircle, Truck, Clock, Package, Check, User, MapPin, Copy, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

type TimelineEvent = {
    date: string
    title: string
    description?: string
    status?: string
    photoUrl?: string
}

type OrderData = {
    order_code: string
    status: string
    bike_id: string
    total_amount: number
    currency: string
    timeline_events: TimelineEvent[]
    customer?: {
        full_name: string
    }
}

function statusLabel(s?: string): string {
    const k = String(s || "").toLowerCase()
    if (k === "new") return "Заказ создан"
    if (k === "negotiation") return "Переговоры"
    if (k === "inspection") return "Инспекция"
    if (k === "payment") return "Оплата"
    if (k === "logistics") return "В пути"
    if (k === "delivered") return "Доставлен"
    return s || "В обработке"
}

export default function MagicTrackerPage() {
    const { token } = useParams<{ token: string }>()
    const [order, setOrder] = React.useState<OrderData | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (token) {
            crmFrontApi.getOrderByToken(token)
                .then(res => {
                    if (res && !res.error) {
                        setOrder(res)
                    } else {
                        setError("Заказ не найден или ссылка устарела")
                    }
                })
                .catch(() => setError("Ошибка загрузки данных"))
                .finally(() => setLoading(false))
        }
    }, [token])

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4">
                    <CheckCircle className="rotate-45" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-zinc-900 mb-2">Ссылка недействительна</h1>
                <p className="text-zinc-500">{error || "Попробуйте запросить ссылку у менеджера"}</p>
            </div>
        )
    }

    const events = order.timeline_events || []
    // Determine progress step based on status
    const getProgress = (status: string) => {
        const s = status.toLowerCase()
        if (s === 'new') return 1
        if (s === 'negotiation') return 2
        if (s === 'inspection') return 3
        if (s === 'payment') return 4
        if (s === 'logistics') return 5
        if (s === 'delivered') return 6
        return 1
    }
    const progress = getProgress(order.status)
    const steps = [
        { id: 1, label: 'Заявка', icon: Package },
        { id: 2, label: 'Переговоры', icon: User },
        { id: 3, label: 'Инспекция', icon: CheckCircle },
        { id: 4, label: 'Оплата', icon: Clock },
        { id: 5, label: 'Логистика', icon: Truck },
        { id: 6, label: 'Вручение', icon: MapPin },
    ]

    return (
        <div className="min-h-screen bg-zinc-50 font-sans">
            <BikeflipHeaderPX />
            
            <main className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Hero Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2rem] shadow-xl shadow-zinc-200/50 overflow-hidden border border-zinc-100 relative mb-8"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full opacity-50 pointer-events-none" />
                    
                    <div className="p-8 md:p-12 relative z-10">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">
                                    Заказ #{order.order_code}
                                </div>
                                <h1 className="text-3xl md:text-5xl font-bold text-zinc-900 mb-2">
                                    {statusLabel(order.status)}
                                </h1>
                                <p className="text-zinc-500 text-lg">
                                    Клиент: <span className="text-zinc-900 font-medium">{order.customer?.full_name}</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-zinc-400 font-bold uppercase tracking-wider">Сумма</div>
                                <div className="text-3xl font-mono font-bold text-zinc-900">
                                    €{order.total_amount}
                                </div>
                                <div className="text-sm text-zinc-400 mt-1">Bike ID: {order.bike_id}</div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-12 relative">
                            <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-1 bg-zinc-100 rounded-full" />
                            <div 
                                className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-zinc-900 rounded-full transition-all duration-1000 ease-out" 
                                style={{ width: `${((progress - 1) / (steps.length - 1)) * 100}%` }} 
                            />
                            
                            <div className="relative flex justify-between">
                                {steps.map((step) => {
                                    const Icon = step.icon
                                    const isActive = progress >= step.id
                                    const isCurrent = progress === step.id
                                    
                                    return (
                                        <div key={step.id} className="flex flex-col items-center gap-3 relative group cursor-default">
                                            <div className={cn(
                                                "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center z-10 transition-all duration-500 border-4",
                                                isActive 
                                                    ? "bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-900/20" 
                                                    : "bg-white border-zinc-200 text-zinc-300"
                                            )}>
                                                <Icon size={18} strokeWidth={2.5} />
                                            </div>
                                            <span className={cn(
                                                "absolute -bottom-8 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors duration-300 w-24 text-center",
                                                isActive ? "text-zinc-900" : "text-zinc-300",
                                                isCurrent && "scale-110"
                                            )}>
                                                {step.label}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Timeline Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                            <Clock size={20} />
                            Хронология событий
                        </h2>
                        
                        <div className="space-y-6 relative pl-8 before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-[2px] before:bg-zinc-200">
                            {events.slice().reverse().map((event, idx) => (
                                <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="relative"
                                >
                                    <div className="absolute -left-[39px] top-0 w-8 h-8 bg-white border-4 border-zinc-100 rounded-full flex items-center justify-center z-10">
                                        <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full" />
                                    </div>
                                    
                                    <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-zinc-900 text-lg">{event.title}</h3>
                                            <span className="text-xs font-medium text-zinc-400 bg-zinc-50 px-2 py-1 rounded-full">
                                                {new Date(event.date).toLocaleDateString()} {new Date(event.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        {event.description && (
                                            <p className="text-zinc-600 leading-relaxed text-sm">
                                                {event.description}
                                            </p>
                                        )}
                                        {event.photoUrl && (
                                            <div className="mt-4 rounded-xl overflow-hidden border border-zinc-100">
                                                <img src={event.photoUrl} alt="Event attachment" className="w-full h-auto" />
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {events.length === 0 && (
                                <div className="text-zinc-400 italic pl-4">Событий пока нет...</div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                         <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="font-bold text-zinc-900 mb-4">Нужна помощь?</h3>
                                <p className="text-sm text-zinc-500 mb-6">Наш менеджер всегда на связи в Telegram.</p>
                                <a 
                                    href="https://t.me/bikeflip_support" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="block w-full py-3 bg-zinc-900 text-white font-bold rounded-xl text-center hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/20"
                                >
                                    Написать менеджеру
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
