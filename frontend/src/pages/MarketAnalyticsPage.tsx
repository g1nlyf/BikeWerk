import React from 'react';
import BikeflipHeaderPX from '@/components/layout/BikeflipHeaderPX';
import { MarketWatch } from '@/components/MarketWatch';
import { MarketHistoryTable } from '@/components/MarketHistoryTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BarChart3, Download, Info, CheckCircle2, TrendingUp, TrendingDown, Activity } from 'lucide-react';

export default function MarketAnalyticsPage() {
  const [historyOpen, setHistoryOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-emerald-100 dark:selection:bg-emerald-900">
      <BikeflipHeaderPX />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="flex items-start gap-5">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <BarChart3 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Прозрачность Рынка</h1>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                        Мы анализируем 12,000+ объявлений ежедневно, чтобы вы видели честные цены. 
                        Наша методология открыта, а данные доступны каждому.
                    </p>
                </div>
            </div>
            <div className="flex gap-3">
                 <Button variant="outline" onClick={() => setHistoryOpen(true)} className="gap-2">
                    <Activity className="w-4 h-4" />
                    Живой лог
                 </Button>
                 <Button variant="default" className="bg-slate-900 hover:bg-slate-800 text-white gap-2" onClick={() => window.open('/api/market/export', '_blank')}>
                    <Download className="w-4 h-4" />
                    Скачать CSV
                 </Button>
            </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 bg-white/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Индекс цен (MTB)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-900">1,840 €</span>
                        <span className="text-sm font-semibold text-emerald-600 flex items-center bg-emerald-50 px-2 py-0.5 rounded-full">
                            <TrendingDown className="w-3 h-3 mr-1" /> -2.4%
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Средняя цена за последние 30 дней</p>
                </CardContent>
            </Card>
            <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 bg-white/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Новых лотов</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-900">+482</span>
                        <span className="text-sm font-semibold text-emerald-600 flex items-center bg-emerald-50 px-2 py-0.5 rounded-full">
                            <TrendingUp className="w-3 h-3 mr-1" /> +12%
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">За последние 24 часа</p>
                </CardContent>
            </Card>
            <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 bg-white/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Выгодных сделок</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-900">15%</span>
                        <span className="text-sm font-medium text-slate-500">от всего рынка</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Лоты с ценой ниже рыночной на 10%+</p>
                </CardContent>
            </Card>
        </div>

        {/* Main Chart Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1">
                    <MarketWatch />
                </div>
                
                {/* Methodology Accordion */}
                <Card className="border-0 shadow-none bg-transparent">
                    <CardHeader className="px-0">
                        <CardTitle className="text-xl font-bold">Методология</CardTitle>
                        <CardDescription>Как мы собираем и анализируем данные</CardDescription>
                    </CardHeader>
                    <CardContent className="px-0">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1" className="border-slate-200">
                                <AccordionTrigger className="text-slate-700 hover:text-emerald-600">Откуда данные?</AccordionTrigger>
                                <AccordionContent className="text-slate-600 leading-relaxed">
                                    Мы сканируем крупнейшие европейские площадки (Kleinanzeigen, Buycycle, Bikemarkt) каждые 15 минут. 
                                    Наши алгоритмы отфильтровывают дубликаты, запчасти и неактуальные объявления.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2" className="border-slate-200">
                                <AccordionTrigger className="text-slate-700 hover:text-emerald-600">Как считается рыночная цена?</AccordionTrigger>
                                <AccordionContent className="text-slate-600 leading-relaxed">
                                    Мы используем медианное значение цены для конкретной модели и года выпуска, исключая экстремальные выбросы (слишком дешевые или дорогие лоты). 
                                    Это дает более честную картину, чем среднее арифметическое.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-3" className="border-slate-200">
                                <AccordionTrigger className="text-slate-700 hover:text-emerald-600">Что такое "Выгодная сделка"?</AccordionTrigger>
                                <AccordionContent className="text-slate-600 leading-relaxed">
                                    Это предложение, цена которого ниже рыночной оценки минимум на 10%, при этом состояние велосипеда оценивается как хорошее или отличное.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>
            </div>

            {/* Sidebar / CTA */}
            <div className="space-y-6">
                 <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-24 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none" />
                    <h3 className="text-lg font-bold mb-3 relative z-10">Ищете что-то конкретное?</h3>
                    <p className="text-slate-300 text-sm mb-6 relative z-10 leading-relaxed">
                        Настройте Снайпера на поиск редкой модели. Мы уведомим вас через 30 секунд после появления объявления.
                    </p>
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-900/20" onClick={() => window.location.href = '/account/waitlist'}>
                        Настроить Снайпера
                    </Button>
                 </div>

                 <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        Почему нам доверяют
                    </h3>
                    <ul className="space-y-4">
                        {[
                            "Только проверенные продавцы",
                            "История цен за 2 года",
                            "Прозрачная комиссия",
                            "Защита покупателя"
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                {item}
                            </li>
                        ))}
                    </ul>
                 </div>
            </div>
        </div>

        <MarketHistoryTable open={historyOpen} onOpenChange={setHistoryOpen} />
      </main>
    </div>
  );
}
