import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Calendar, Share2, MessageCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEO/SEOHead";
import { JOURNAL_ARTICLES, CATEGORIES } from '@/data/journalArticles';
import { cn } from "@/lib/utils";

export default function JournalArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const article = JOURNAL_ARTICLES.find(a => a.slug === slug);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!article) {
    return (
      <div className="min-h-screen bg-[#F5F1ED] flex items-center justify-center font-manrope">
        <SEOHead title="Статья не найдена - BikeWerk" />
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Статья не найдена</h1>
          <Button onClick={() => navigate('/journal')} variant="outline">
            Вернуться в журнал
          </Button>
        </div>
      </div>
    );
  }

  const category = CATEGORIES.find(c => c.id === article.category);

  return (
    <div className="min-h-screen bg-[#F5F1ED] font-manrope">
      <SEOHead 
        title={`${article.title} - Журнал BikeWerk`}
        description={article.subtitle}
        url={`https://bikewerk.ru/journal/${article.slug}`}
      />
      <BikeflipHeaderPX />

      {/* Hero Section */}
      <div className="relative h-[60vh] min-h-[500px] w-full overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={article.image} 
            alt={article.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F5F1ED] via-black/40 to-black/30" />
        </div>

        <div className="absolute inset-0 pt-32 pb-12 flex flex-col justify-end">
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Button 
                variant="ghost" 
                className="text-white/80 hover:text-white hover:bg-white/10 mb-8 pl-0 gap-2"
                onClick={() => navigate('/journal')}
              >
                <ArrowLeft className="w-5 h-5" />
                Назад в журнал
              </Button>

              <div className="flex items-center gap-4 mb-6">
                <span className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/10 text-white text-xs font-bold tracking-wider uppercase flex items-center gap-2">
                  {category?.icon && <category.icon className="w-3 h-3" />}
                  {category?.label}
                </span>
                <span className="flex items-center gap-2 text-white/80 text-sm font-medium">
                  <Clock className="w-4 h-4" />
                  {article.readTime} чтения
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight">
                {article.title}
              </h1>
              
              <p className="text-xl md:text-2xl text-white/90 font-medium max-w-3xl leading-relaxed">
                {article.subtitle}
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Main Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex-1"
          >
            {/* Author/Date Block */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-8 mb-10">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white font-bold text-lg">
                    BF
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Bikeflip Team</div>
                    <div className="text-sm text-gray-500">Экспертный разбор</div>
                  </div>
               </div>
               <div className="flex gap-2">
                 <Button variant="outline" size="icon" className="rounded-full">
                   <Share2 className="w-4 h-4" />
                 </Button>
               </div>
            </div>

            {/* Article Body */}
            <article 
              className="prose prose-lg prose-gray max-w-none 
                prose-headings:font-bold prose-headings:text-gray-900 prose-headings:font-manrope prose-headings:mt-8 prose-headings:mb-4
                prose-p:text-gray-600 prose-p:leading-loose prose-p:mb-6
                prose-strong:text-gray-900
                prose-li:text-gray-600 prose-li:marker:text-orange-500
                prose-img:rounded-[2rem] prose-img:shadow-xl prose-img:my-10
                prose-a:text-black prose-a:font-bold prose-a:no-underline hover:prose-a:underline
              "
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            {/* CTA Block */}
            <div className="mt-16 p-8 md:p-12 rounded-[2.5rem] bg-black text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
               
               <div className="relative z-10">
                 <h3 className="text-3xl font-bold mb-4">Остались вопросы?</h3>
                 <p className="text-white/70 text-lg mb-8 max-w-xl">
                   Если после прочтения вы все еще сомневаетесь — просто напишите нам. Мы не роботы, мы живые люди, которые любят велосипеды.
                 </p>
                 <Button 
                   className="h-14 px-8 rounded-full bg-white text-black hover:bg-gray-200 font-bold text-lg"
                   onClick={() => window.open('https://t.me/bikeflip_bot', '_blank')}
                 >
                   <MessageCircle className="w-5 h-5 mr-2" />
                   Написать эксперту
                 </Button>
               </div>
            </div>

          </motion.div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
