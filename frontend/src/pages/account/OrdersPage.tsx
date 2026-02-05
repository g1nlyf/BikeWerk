import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Truck, CheckCircle2, AlertCircle, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogisticsStepper, MOCK_STEPS } from '@/components/LogisticsStepper';
import { useAuth } from '@/lib/auth';
import BikeflipHeaderPX from '@/components/layout/BikeflipHeaderPX';

// Mock orders for demo
const MOCK_ORDERS = [
  {
    id: "ORD-7782-XJ",
    date: "2024-03-15",
    status: "in_transit",
    total: "€4,250",
    bike: "Specialized Tarmac SL7",
    image: "/images/bikes/id10/0.webp"
  },
  {
    id: "ORD-9921-MC",
    date: "2023-11-20",
    status: "delivered",
    total: "€3,800",
    bike: "Canyon Ultimate CF SLX",
    image: "/images/bikes/id11/0.webp"
  }
];

export default function OrdersPage() {
  const { user } = useAuth();
  const [activeOrder, setActiveOrder] = useState(MOCK_ORDERS[0]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-emerald-100 dark:selection:bg-emerald-900">
      <BikeflipHeaderPX />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Мои Заказы</h1>
            <p className="text-slate-500 dark:text-slate-400">Отслеживайте статус доставки и историю покупок</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Orders List */}
            <div className="space-y-4">
                {MOCK_ORDERS.map((order) => (
                    <div 
                        key={order.id}
                        onClick={() => setActiveOrder(order)}
                        className={`
                            cursor-pointer rounded-xl border p-4 transition-all duration-200
                            ${activeOrder.id === order.id 
                                ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/20' 
                                : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-emerald-200'}
                        `}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-mono text-xs text-slate-400">#{order.id}</span>
                            <Badge variant={order.status === 'delivered' ? 'secondary' : 'default'} className={order.status === 'in_transit' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : ''}>
                                {order.status === 'in_transit' ? 'В пути' : 'Доставлен'}
                            </Badge>
                        </div>
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{order.bike}</h3>
                        <div className="flex justify-between items-center text-sm text-slate-500">
                            <span>{order.date}</span>
                            <span className="font-medium text-slate-900 dark:text-slate-200">{order.total}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Order Details & Stepper */}
            <div className="lg:col-span-2 space-y-6">
                <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle>Статус Заказа #{activeOrder.id}</CardTitle>
                        <CardDescription>Ожидаемая доставка: 25 Марта - 28 Марта</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activeOrder.status === 'in_transit' ? (
                            <LogisticsStepper steps={MOCK_STEPS} currentStep={2} />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Заказ успешно доставлен!</h3>
                                <p className="text-slate-500 mt-2 max-w-md">
                                    Надеемся, вам нравится ваш новый велосипед. Если у вас есть вопросы, наша поддержка всегда на связи.
                                </p>
                                <Button className="mt-6" variant="outline">Оставить отзыв</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {activeOrder.status === 'in_transit' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Адрес Доставки</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-start gap-3">
                                    <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-slate-900">Александр Иванов</p>
                                        <p className="text-slate-600">ул. Пушкина, д. 10, кв. 5</p>
                                        <p className="text-slate-600">Москва, 101000</p>
                                        <p className="text-slate-600">+7 (999) 123-45-67</p>
                                    </div>
                                </div>
                            </CardContent>
                         </Card>
                         
                         <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Детали Оплаты</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Метод</span>
                                        <span className="font-medium">Банковская карта •••• 4242</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Сумма</span>
                                        <span className="font-medium">{activeOrder.total}</span>
                                    </div>
                                    <div className="pt-2 border-t mt-2">
                                        <Button variant="link" className="p-0 h-auto text-emerald-600 text-xs">Скачать инвойс</Button>
                                    </div>
                                </div>
                            </CardContent>
                         </Card>
                    </div>
                )}
            </div>
        </div>
      </main>
    </div>
  );
}
