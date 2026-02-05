import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Crosshair, Sparkles, Zap, ArrowRight, Search, Clock, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import BikeflipHeaderPX from '@/components/layout/BikeflipHeaderPX';
import { apiPost } from '@/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function SniperPage() {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [contactMethod, setContactMethod] = useState<'telegram' | 'email'>('telegram');
  const [contactValue, setContactValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    try {
      const payload: any = {
        brand,
        model,
        max_price: maxPrice
      };

      if (contactMethod === 'telegram') {
        payload.telegram_chat_id = contactValue;
      } else {
        payload.email = contactValue;
      }

      await apiPost('/waitlist/add', payload);
      setStatus('success');
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  const benefits = [
    { icon: Search, title: 'Глубокий поиск', desc: 'Сканируем Kleinanzeigen, Buycycle и закрытые форумы.' },
    { icon: Clock, title: 'Мгновенно', desc: 'Уведомление приходит через 30-60 секунд после публикации.' },
    { icon: Zap, title: 'Первенство', desc: 'Вы узнаете о лоте раньше перекупов.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-emerald-100 dark:selection:bg-emerald-900">
      <BikeflipHeaderPX />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Crosshair className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">Beta v2.0</Badge>
                </div>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">
                    Снайпер <span className="text-emerald-500">24/7</span>
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                    Автоматический охотник за редкими велосипедами. 
                    Настройте параметры, и мы уведомим вас, как только байк появится в продаже.
                </p>
            </div>
            
            <div className="hidden md:flex gap-8">
                {benefits.map((b, i) => (
                    <div key={i} className="flex flex-col gap-2 max-w-[140px]">
                        <b.icon className="h-5 w-5 text-slate-400" />
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">{b.title}</div>
                        <div className="text-xs text-slate-500 leading-snug">{b.desc}</div>
                    </div>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Form Area */}
            <div className="lg:col-span-7">
                <Card className="border-0 shadow-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden relative">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
                    
                    <CardHeader className="pb-6">
                        <CardTitle>Параметры цели</CardTitle>
                        <CardDescription>Укажите детали велосипеда, который нужно поймать.</CardDescription>
                    </CardHeader>
                    
                    <CardContent>
                         <AnimatePresence mode="wait">
                            {status === 'success' ? (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="py-12 text-center"
                                >
                                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ловушка установлена!</h3>
                                    <p className="text-slate-500 max-w-sm mx-auto mb-8">
                                        Снайпер начал сканирование рынка. Как только появится подходящий вариант, мы мгновенно пришлем уведомление.
                                    </p>
                                    <Button onClick={() => setStatus('idle')} variant="outline">
                                        Настроить еще одну цель
                                    </Button>
                                </motion.div>
                            ) : (
                                <motion.form 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onSubmit={handleSubmit} 
                                    className="space-y-6"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="brand" className="text-slate-700 dark:text-slate-300">Бренд</Label>
                                            <Input 
                                                id="brand" 
                                                value={brand} 
                                                onChange={(e) => setBrand(e.target.value)} 
                                                placeholder="Например: Specialized" 
                                                className="h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="model" className="text-slate-700 dark:text-slate-300">Модель</Label>
                                            <Input 
                                                id="model" 
                                                value={model} 
                                                onChange={(e) => setModel(e.target.value)} 
                                                placeholder="Например: Tarmac SL7" 
                                                className="h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="price" className="text-slate-700 dark:text-slate-300">Максимальный бюджет (€)</Label>
                                        <div className="relative">
                                            <Input 
                                                id="price" 
                                                type="number"
                                                value={maxPrice} 
                                                onChange={(e) => setMaxPrice(e.target.value)} 
                                                placeholder="2500" 
                                                className="h-11 pl-9 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">€</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400">Мы будем искать лоты только ниже этой цены.</p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800">
                                        <Label className="text-slate-700 dark:text-slate-300 mb-3 block">Куда прислать "добычу"?</Label>
                                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                                            <button
                                                type="button"
                                                onClick={() => setContactMethod('telegram')}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border transition-all text-sm font-medium",
                                                    contactMethod === 'telegram' 
                                                        ? "bg-white dark:bg-slate-800 border-emerald-500 text-emerald-600 shadow-sm ring-1 ring-emerald-500/20" 
                                                        : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                )}
                                            >
                                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.638z"/></svg>
                                                Telegram
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setContactMethod('email')}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border transition-all text-sm font-medium",
                                                    contactMethod === 'email' 
                                                        ? "bg-white dark:bg-slate-800 border-emerald-500 text-emerald-600 shadow-sm ring-1 ring-emerald-500/20" 
                                                        : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                )}
                                            >
                                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
                                                Email
                                            </button>
                                        </div>
                                        <Input 
                                            id="contact" 
                                            value={contactValue} 
                                            onChange={(e) => setContactValue(e.target.value)} 
                                            placeholder={contactMethod === 'email' ? 'ivan@example.com' : '@username (без https)'} 
                                            className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-emerald-500"
                                            required
                                        />
                                    </div>

                                    <Button 
                                        type="submit" 
                                        disabled={status === 'loading'}
                                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02]"
                                    >
                                        {status === 'loading' ? (
                                            <span className="flex items-center gap-2">
                                                <Sparkles className="animate-spin h-5 w-5" /> Активация...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <Target className="h-5 w-5" /> Активировать Снайпера
                                            </span>
                                        )}
                                    </Button>
                                    
                                    {status === 'error' && (
                                        <p className="text-rose-500 text-sm text-center bg-rose-50 dark:bg-rose-900/20 py-2 rounded-lg">
                                            Произошла ошибка. Проверьте данные и попробуйте снова.
                                        </p>
                                    )}
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </div>

            {/* Sidebar / Info */}
            <div className="lg:col-span-5 space-y-6">
                 {/* Live Status Card */}
                 <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-24 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none" />
                    
                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Система активна</span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">Server: EU-Central</span>
                    </div>

                    <div className="space-y-4 relative z-10">
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                            <span className="text-slate-400 text-sm">Лотов просканировано</span>
                            <span className="font-mono font-bold">12,842</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                            <span className="text-slate-400 text-sm">Найдено "Супер-цен"</span>
                            <span className="font-mono font-bold text-emerald-400">147</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                            <span className="text-slate-400 text-sm">Среднее время реакции</span>
                            <span className="font-mono font-bold">0.8 сек</span>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 relative z-10">
                         <div className="flex gap-3">
                             <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                 <Bell className="w-5 h-5 text-white" />
                             </div>
                             <div>
                                 <h4 className="font-bold text-sm mb-1">Как это работает?</h4>
                                 <p className="text-xs text-slate-400 leading-relaxed">
                                     Наши боты мониторят все площадки. Когда появляется байк по вашим параметрам, вы получаете прямую ссылку в Telegram или на почту.
                                 </p>
                             </div>
                         </div>
                    </div>
                 </div>

                 {/* Testimonials or Trust */}
                 <Card className="border-0 shadow-sm bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <img src="/placeholder-user.jpg" className="w-10 h-10 rounded-full bg-slate-200" alt="User" />
                            <div>
                                <div className="text-sm font-medium text-slate-900 dark:text-white mb-1">Алексей М. поймал Canyon Aeroad</div>
                                <p className="text-xs text-slate-500 italic">
                                    "Искал этот цвет полгода. Снайпер прислал уведомление через 2 часа после настройки. Успел купить за 2800€, хотя рынок 3500€."
                                </p>
                            </div>
                        </div>
                    </CardContent>
                 </Card>
            </div>
        </div>
      </main>
    </div>
  );
}