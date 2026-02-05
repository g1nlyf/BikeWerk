import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_WINS = [
  { id: 1, text: "Found: Specialized Levo (-30% vs Market)", time: "5 mins ago" },
  { id: 2, text: "Sold: Canyon Ultimate (Saved €450)", time: "12 mins ago" },
  { id: 3, text: "New Listing: Santa Cruz Megatower (Hot Price)", time: "Just now" },
  { id: 4, text: "Price Drop: Trek Madone SLR (-15%)", time: "20 mins ago" },
  { id: 5, text: "Sniper Alert: Scott Spark RC (Rare Size)", time: "1 hour ago" },
];

export const MarketWatch = () => {
  const [currentWinIndex, setCurrentWinIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWinIndex((prev) => (prev + 1) % MOCK_WINS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Desktop Version: Redesigned with Liquid Glass & Ticker */}
      <section className="hidden md:block w-full relative overflow-hidden rounded-[2.5rem] min-h-[600px] shadow-2xl group my-12">
        {/* Background Image */}
        <div className="absolute inset-0 w-full h-full">
            <img 
              src="/analyticsPCmini.jpg" 
              alt="Умная аналитика" 
              className="w-full h-full object-cover transition-transform duration-[20s] ease-linear group-hover:scale-105"
            />
            {/* Gradient Overlay for Text Readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
        </div>

        {/* Liquid Glass Island */}
        <div className="absolute top-1/2 left-12 transform -translate-y-1/2 max-w-lg w-full">
            <div className="backdrop-blur-md bg-white/30 border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] rounded-3xl p-8 text-white relative overflow-hidden">
                {/* Glossy Reflection */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-100">Пульс рынка</span>
                    </div>

                    <h2 className="text-4xl font-extrabold mb-4 leading-tight drop-shadow-md font-manrope">
                        Умная аналитика:<br/>
                        Прогноз честной цены
                    </h2>

                    <div className="flex items-end gap-4 mb-8">
                        <div className="bg-white/90 text-gray-900 rounded-xl px-4 py-2 shadow-lg backdrop-blur-sm">
                             <div className="text-3xl font-bold font-mono">810 €</div>
                             <div className="text-xs font-semibold text-gray-500">Средняя экономия</div>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-300 font-bold bg-black/40 px-3 py-1 rounded-lg backdrop-blur-md">
                            <TrendingDown className="w-4 h-4" />
                            <span>-12.4%</span>
                        </div>
                    </div>

                    <p className="text-lg text-white/90 font-medium mb-8 leading-relaxed drop-shadow-sm">
                        Наши алгоритмы ежедневно обрабатывают тысячи объявлений, отсеивая шум и находя настоящие сокровища.
                    </p>

                    <Button 
                        onClick={() => window.location.href = '/about#analytics'}
                        className="bg-white text-gray-900 hover:bg-gray-100 font-bold rounded-full px-8 py-6 text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                    >
                        Подробнее
                        <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                </div>
            </div>
        </div>

        {/* Real-Time Ticker */}
        <div className="absolute bottom-8 right-8 left-auto max-w-sm w-full">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
                 <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Live Hunter Log</span>
                    </div>
                    <span className="text-[10px] text-white/50">Updated just now</span>
                 </div>

                 <div className="h-12 relative overflow-hidden">
                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={currentWinIndex}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 flex flex-col justify-center"
                        >
                            <div className="text-sm font-semibold text-white truncate">
                                {MOCK_WINS[currentWinIndex].text}
                            </div>
                            <div className="text-xs text-emerald-400 font-mono mt-1">
                                {MOCK_WINS[currentWinIndex].time}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                 </div>
            </div>
        </div>
      </section>

      {/* Mobile Version: Original Content */}
      <section className="md:hidden py-12 bg-white overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-0 md:gap-12">
            
            {/* Top: Image (Visual Anchor) */}
            <div className="relative w-[calc(100%+2rem)] -mx-4 md:w-full md:mx-0 aspect-[4/5] md:aspect-[16/9] rounded-none md:rounded-[2.5rem] overflow-hidden shadow-none md:shadow-2xl">
              <img 
                src="/analyticspic.jpg" 
                alt="Умная аналитика" 
                className="w-full h-full object-cover"
              />
            </div>

            {/* Bottom: Text Content */}
            <div className="flex flex-col items-start text-left max-w-4xl mx-auto md:text-center md:items-center pt-0 md:pt-0 -mt-2 relative z-10">
               <h2 className="text-[32px] md:text-5xl leading-[1.1] font-bold text-gray-900 mb-6 tracking-tight font-manrope">
                 Умная аналитика:<br />
                 Прогноз честной цены
               </h2>
               
               <p className="text-[16px] md:text-lg text-gray-600 leading-[1.6] mb-10 font-medium">
                 Наши алгоритмы ежедневно обрабатывают тысячи 
                 объявлений в Европе. Мы обучаем систему на реальных 
                 данных, чтобы вы получали байк по его истинной 
                 рыночной стоимости, очищенной от наценок и скрытых 
                 дефектов.
               </p>

               <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full sm:w-auto">
                 <Button 
                   className="rounded-full w-full sm:w-auto px-10 h-14 md:h-16 text-base md:text-lg font-bold bg-black text-white hover:bg-gray-800 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1"
                   onClick={() => window.location.href = '/about#analytics'}
                 >
                   Подробнее о системе
                 </Button>
                 
                 <Button 
                   variant="outline"
                   className="rounded-full w-full sm:w-auto px-10 h-14 md:h-16 text-base md:text-lg font-bold border-2 border-black text-black hover:bg-black hover:text-white transition-all duration-300 bg-transparent"
                   onClick={() => window.location.href = '/catalog'}
                 >
                   Посмотреть каталог
                 </Button>
               </div>
            </div>

          </div>
        </div>
      </section>
    </>
  );
};

export default MarketWatch;
