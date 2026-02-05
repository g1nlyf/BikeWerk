import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, Box, Truck, Settings, Ruler } from 'lucide-react';
import { cn } from "@/lib/utils";
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEO/SEOHead";
import { JOURNAL_ARTICLES, CATEGORIES, type JournalCategory } from '@/data/journalArticles';

export default function JournalPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<JournalCategory>('choosing');

  const filteredArticles = JOURNAL_ARTICLES.filter(a => a.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#F5F1ED] font-manrope">
      <SEOHead title="Журнал - BikeWerk" />
      <BikeflipHeaderPX />
      
      <main className="pt-32 pb-20 overflow-hidden relative">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] bg-orange-200/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-[10%] right-[-10%] w-[600px] h-[600px] bg-blue-200/20 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Header & Navigation */}
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 mb-16">
            <div className="max-w-xl">
              <h1 className="text-[42px] md:text-[64px] leading-[1] font-extrabold text-gray-900 tracking-tight mb-6">
                Журнал
              </h1>
              <p className="text-xl text-gray-500 font-medium leading-relaxed">
                Навигатор по мечте. Мы собрали опыт тысяч сделок, чтобы ответить на ваши вопросы еще до того, как они появятся.
              </p>
            </div>

            {/* Quick Filters - Horizontal Scroll on Mobile */}
            <div className="w-full md:w-auto overflow-x-auto pb-4 md:pb-0 -mx-4 md:mx-0 px-4 md:px-0 scrollbar-hide">
              <div className="flex gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 border-2",
                      activeCategory === cat.id
                        ? "bg-black text-white border-black shadow-lg transform scale-105"
                        : "bg-white/50 text-gray-600 border-transparent hover:bg-white hover:border-gray-200 backdrop-blur-sm"
                    )}
                  >
                    <cat.icon className="w-4 h-4" />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stories-Cards Stack */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <AnimatePresence mode='popLayout'>
              {filteredArticles.map((article, index) => (
                <motion.div
                  key={article.id}
                  layout
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="group relative h-[420px] md:h-[500px] w-full rounded-[2.5rem] overflow-hidden cursor-pointer shadow-xl hover:shadow-2xl transition-shadow duration-500 bg-gray-900"
                  onClick={() => navigate(`/journal/${article.slug}`)}
                >
                  {/* Background Image with Zoom Effect */}
                  <div className="absolute inset-0 w-full h-full">
                    <img 
                      src={article.image} 
                      alt={article.title}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 opacity-90"
                    />
                    {/* Glass Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end text-white">
                    {/* Floating Tag */}
                    <div className="absolute top-6 left-6">
                       <div className="px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/10 text-xs font-bold tracking-wider uppercase flex items-center gap-2">
                          <Box className="w-3 h-3" />
                          {CATEGORIES.find(c => c.id === article.category)?.label}
                       </div>
                    </div>

                    {/* Text */}
                    <div className="transform transition-transform duration-300 group-hover:-translate-y-2">
                      <div className="text-white/80 text-sm font-medium mb-2 flex items-center gap-2">
                        <span>{article.readTime} чтения</span>
                        <span className="w-1 h-1 bg-white/50 rounded-full" />
                        <span>Bikeflip Originals</span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold leading-tight mb-3 font-manrope">
                        {article.title}
                      </h3>
                      <p className="text-white/70 text-sm md:text-base line-clamp-2 mb-6">
                        {article.subtitle}
                      </p>
                      
                      {/* Button that appears/glows on hover */}
                      <div className="flex items-center gap-3 text-sm font-bold opacity-80 group-hover:opacity-100 transition-opacity">
                        <span className="border-b border-white/30 pb-0.5 group-hover:border-white transition-colors">
                          Читать статью
                        </span>
                        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* "Ask Expert" Card - Always last */}
            <motion.div
               layout
               className="h-[420px] md:h-[500px] w-full rounded-[2.5rem] bg-black text-white p-8 flex flex-col justify-between overflow-hidden relative shadow-xl"
            >
               {/* Abstract BG */}
               <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
               
               <div>
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-sm">
                     <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold mb-4 font-manrope">
                     Не нашли ответ?
                  </h3>
                  <p className="text-white/60 text-lg">
                     Наш эксперт Влад ответит на любой вопрос о геометрии, доставке или состоянии конкретного байка.
                  </p>
               </div>

               <div>
                  <div className="flex items-center gap-4 mb-8">
                     <div className="flex -space-x-3">
                        {[1,2,3].map(i => (
                           <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-gray-800 flex items-center justify-center text-xs font-bold">
                              <span className="opacity-50">E{i}</span>
                           </div>
                        ))}
                     </div>
                     <div className="text-sm font-medium text-white/80">
                        Отвечаем за 5 минут
                     </div>
                  </div>
                  <Button 
                     className="w-full h-14 rounded-full bg-white text-black hover:bg-gray-200 font-bold text-lg shadow-lg hover:shadow-white/20 transition-all"
                     onClick={() => window.open('https://t.me/bikeflip_bot', '_blank')}
                  >
                     Спросить эксперта
                  </Button>
               </div>
            </motion.div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}