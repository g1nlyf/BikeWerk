import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bike, Search, ChevronRight, FileText, HelpCircle, Info, Truck, Shield, CreditCard, FileCheck, Users, Phone } from 'lucide-react';
import { useDrawer } from '@/context/DrawerContext';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

export function NavigationDrawer() {
  const { isDrawerOpen, closeDrawer } = useDrawer();
  const navigate = useNavigate();

  const handleNavigation = (path: string) => {
    navigate(path);
    closeDrawer();
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop - High Z-index to be above everything except drawer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
          />

          {/* Drawer Panel - Highest Z-index */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 h-full w-[300px] sm:w-[350px] bg-white dark:bg-slate-900 shadow-2xl z-[100] flex flex-col border-r border-slate-100 dark:border-slate-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <Link to="/" onClick={closeDrawer} className="flex items-center gap-3">
                <img src="/minilogo11.png" alt="BikeWerk" className="h-8 w-8 select-none" />
                <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">BikeWerk</span>
              </Link>
              <Button variant="ghost" size="icon" onClick={closeDrawer} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">

              {/* BLOCK 1: НАЙТИ БАЙК */}
              <div className="space-y-3">
                <h3 className="px-4 text-xs font-bold text-primary uppercase tracking-wider">НАЙТИ БАЙК</h3>
                <nav className="space-y-1">
                  {/* Catalog Categories */}
                  <button
                    onClick={() => handleNavigation('/catalog')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Bike className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
                    Все велосипеды
                  </button>
                  <button
                    onClick={() => handleNavigation('/catalog?category=mtb')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Bike className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    МТБ
                  </button>
                  <button
                    onClick={() => handleNavigation('/catalog?category=road')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Bike className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    Шоссе
                  </button>
                  <button
                    onClick={() => handleNavigation('/catalog?category=gravel')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Bike className="h-4 w-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                    Грэвел
                  </button>
                  <button
                    onClick={() => handleNavigation('/catalog?category=ebike')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Bike className="h-4 w-4 text-slate-400 group-hover:text-purple-500 transition-colors" />
                    Электро
                  </button>

                  {/* Divider */}
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

                  {/* Sniper Tool */}
                  <button
                    onClick={() => handleNavigation('/sniper')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-primary rounded-lg bg-primary/5 hover:bg-primary/10 transition-all group"
                  >
                    <Search className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                    Снайпер (Подбор на заказ)
                    <Badge variant="secondary" className="ml-auto text-[10px] bg-primary/10 text-primary border-primary/20">AI</Badge>
                  </button>

                  {/* Calculator */}
                  <button
                    onClick={() => handleNavigation('/calculator')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Truck className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    Калькулятор доставки
                  </button>
                </nav>
              </div>

              {/* BLOCK 2: КАК ВСЁ РАБОТАЕТ */}
              <div className="space-y-3">
                <h3 className="px-4 text-xs font-bold text-primary uppercase tracking-wider">КАК ВСЁ РАБОТАЕТ</h3>
                <nav className="space-y-1">
                  <button
                    onClick={() => handleNavigation('/how-it-works')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Info className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    Как это работает
                  </button>
                  <button
                    onClick={() => handleNavigation('/guarantees')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Shield className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    Гарантии
                  </button>
                  <button
                    onClick={() => handleNavigation('/delivery')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Truck className="h-4 w-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                    Доставка и сроки
                  </button>
                  <button
                    onClick={() => handleNavigation('/payment')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <CreditCard className="h-4 w-4 text-slate-400 group-hover:text-purple-500 transition-colors" />
                    Оплата
                  </button>
                  <button
                    onClick={() => handleNavigation('/documents')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <FileCheck className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                    Документы и таможня
                  </button>
                </nav>
              </div>

              {/* BLOCK 3: КОМПАНИЯ */}
              <div className="space-y-3">
                <h3 className="px-4 text-xs font-bold text-primary uppercase tracking-wider">КОМПАНИЯ</h3>
                <nav className="space-y-1">
                  <button
                    onClick={() => handleNavigation('/about')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Users className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    О нас
                  </button>
                  <button
                    onClick={() => handleNavigation('/journal')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <FileText className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                    Журнал
                  </button>
                  <button
                    onClick={() => handleNavigation('/about#faq')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <HelpCircle className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    FAQ
                  </button>
                  <button
                    onClick={() => handleNavigation('/about#contacts')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Phone className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
                    Контакты
                  </button>
                </nav>
              </div>

              {/* Promo Block */}
              <div className="px-2 pt-2">
                <div className="relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-5 rounded-2xl shadow-lg border border-primary/20 group cursor-pointer" onClick={() => handleNavigation('/sniper')}>
                  <div className="absolute top-0 right-0 p-12 bg-white/10 blur-[40px] rounded-full pointer-events-none group-hover:bg-white/20 transition-all" />
                  <h4 className="relative z-10 font-bold text-white mb-2 text-sm leading-tight">Не нашли нужный байк?</h4>
                  <p className="relative z-10 text-xs text-white/90 mb-4 leading-relaxed">
                    ИИ-Снайпер найдет велосипед мечты по вашим параметрам.
                  </p>
                  <div className="relative z-10 flex items-center text-xs font-bold text-white group-hover:translate-x-1 transition-transform">
                    Заказать поиск <ChevronRight className="ml-1 h-3 w-3" />
                  </div>
                </div>
              </div>

            </div>

            {/* Mini Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <Link to="/documents" onClick={closeDrawer} className="hover:text-slate-800 transition-colors">Документы</Link>
                  <Link to="/about#contacts" onClick={closeDrawer} className="hover:text-slate-800 transition-colors">Контакты</Link>
                  <span className="ml-auto text-[10px] opacity-50">v2.5.0</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">© 2026 BikeWerk. Все права защищены.</p>
              </div>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
