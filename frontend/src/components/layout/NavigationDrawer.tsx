import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bike, BarChart3, Search, ChevronRight, HelpCircle, FileText, Info, Truck, PackageCheck, AlertCircle } from 'lucide-react';
import { useDrawer } from '@/context/DrawerContext';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
                 <img src="/minilogo11.png" alt="BikeEU" className="h-8 w-8 select-none" />
                 <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">BikeEU</span>
              </Link>
              <Button variant="ghost" size="icon" onClick={closeDrawer} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              
              {/* Navigation - Catalog */}
              <div className="space-y-3">
                <h3 className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Каталог</h3>
                <nav className="space-y-1">
                  {[
                    { name: 'МТБ', path: '/catalog?category=mtb', icon: Bike },
                    { name: 'Шоссе', path: '/catalog?category=road', icon: Bike },
                    { name: 'Грэвел', path: '/catalog?category=gravel', icon: Bike },
                    { name: 'Электро', path: '/catalog?category=ebike', icon: Bike },
                  ].map((item) => (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.path)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                    >
                      <item.icon className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      {item.name}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Logistics Smart Filters (Sniper 2.0) */}
              <div className="space-y-2">
                <h3 className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Тип Сделки</h3>
                <nav className="space-y-1">
                  <button
                    onClick={() => handleNavigation('/catalog?shipping=available')}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-all group border border-emerald-100 dark:border-emerald-800/30"
                  >
                    <span className="flex items-center gap-3">
                      <PackageCheck className="h-4 w-4" />
                      Готовы к отправке
                    </span>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Fast</Badge>
                  </button>

                  <button
                    onClick={() => handleNavigation('/catalog?shipping=pickup')}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-all group border border-amber-100 dark:border-amber-800/30"
                  >
                    <span className="flex items-center gap-3">
                      <AlertCircle className="h-4 w-4" />
                      Охота (Pickup)
                    </span>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">-25%</Badge>
                  </button>
                </nav>
              </div>

              {/* Analytics & Tools */}
              <div className="space-y-3">
                <h3 className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Инструменты</h3>
                <nav className="space-y-1">
                  <button
                     onClick={() => handleNavigation('/calculator')}
                     className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <Truck className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    Калькулятор доставки
                  </button>
                  <div className="relative">
                    <button
                        onClick={() => handleNavigation('/sniper')}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                    >
                        <Search className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                        Снайпер
                    </button>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                         <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <HelpCircle className="h-3.5 w-3.5 text-slate-300 hover:text-slate-400 cursor-help" />
                             </TooltipTrigger>
                             <TooltipContent>
                               <p className="w-[200px] text-xs">AI-оценка рыночной стоимости велосипеда на основе 12,000+ сделок.</p>
                             </TooltipContent>
                           </Tooltip>
                         </TooltipProvider>
                    </div>
                  </div>
                  <button
                    onClick={() => handleNavigation('/analytics')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                  >
                    <BarChart3 className="h-4 w-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                    Живой Архив
                    <Badge variant="secondary" className="ml-auto text-[10px] bg-blue-50 text-blue-600 border-blue-100">Live</Badge>
                  </button>
                </nav>
              </div>

              {/* Help */}
              <div className="space-y-3">
                <h3 className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Справка</h3>
                <nav className="space-y-1">
                  {[
                    { name: 'Журнал', path: '/#journal', icon: FileText },
                    { name: 'FAQ', path: '/about#faq', icon: HelpCircle },
                    { name: 'О нас', path: '/about', icon: Info },
                    { name: 'Весь процесс', path: '/about#how-it-works', icon: Truck },
                  ].map((item) => (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.path)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all group"
                    >
                      <item.icon className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                      {item.name}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Promo Block */}
              <div className="px-2 pt-2">
                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 to-slate-900 p-5 rounded-2xl shadow-lg border border-emerald-500/20 group cursor-pointer" onClick={() => handleNavigation('/sniper')}>
                   <div className="absolute top-0 right-0 p-12 bg-emerald-500/20 blur-[40px] rounded-full pointer-events-none group-hover:bg-emerald-500/30 transition-all" />
                   <h4 className="relative z-10 font-bold text-white mb-2 text-sm leading-tight">Не нашли нужный байк?</h4>
                   <p className="relative z-10 text-xs text-emerald-100/80 mb-4 leading-relaxed">
                     ИИ-Снайпер найдет велосипед мечты по вашим параметрам.
                   </p>
                   <div className="relative z-10 flex items-center text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                     Заказать поиск <ChevronRight className="ml-1 h-3 w-3" />
                   </div>
                </div>
              </div>

            </div>
            
            {/* Mini Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <Link to="/about#contacts" className="hover:text-slate-800 transition-colors">Документы</Link>
                        <Link to="/about#contacts" className="hover:text-slate-800 transition-colors">Контакты</Link>
                        <span className="ml-auto text-[10px] opacity-50">v2.4.0</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">© 2026 EUBike. Все права защищены.</p>
                </div>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
