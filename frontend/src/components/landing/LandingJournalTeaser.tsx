import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowRight, HelpCircle, BookOpen } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from 'react-router-dom';

const FAQS = [
  {
    question: "Как выбрать размер рамы, если я не могу примерить?",
    answer: "Рост — это только начало. Мы смотрим на Stack и Reach. Для первого шоссейника мы рекомендуем отношение 1.5.",
    linkText: "Подробнее о геометрии",
    linkUrl: "/journal/geometry-guide"
  },
  {
    question: "А если велосипед приедет сломанным?",
    answer: "Мы страхуем каждый груз на 100% стоимости. Если царапина появилась в пути — мы компенсируем. Если критическое повреждение — вернем деньги.",
    linkText: "Как работает страховка",
    linkUrl: "/journal/insurance-guarantee"
  },
  {
    question: "Что лучше: карбон или алюминий б/у?",
    answer: "Карбон не имеет усталости металла, но боится точечных ударов. Алюминий накапливает усталость, но дешевле. Мы проверяем карбон ультразвуком.",
    linkText: "Карбон vs Алюминий",
    linkUrl: "/journal/carbon-vs-aluminum"
  },
  {
    question: "Гравийник или шоссейник?",
    answer: "Если вы планируете съезжать с асфальта хотя бы на 10% времени — берите гравийник. Современные модели почти не уступают в скорости.",
    linkText: "Честный разбор",
    linkUrl: "/journal/gravel-vs-road"
  }
];

export function LandingJournalTeaser() {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-white font-manrope">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          
          {/* Left Column: Teaser */}
          <div className="flex flex-col justify-center h-full">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-700 text-sm font-bold w-fit mb-6">
              <BookOpen className="w-4 h-4" />
              Bikeflip Журнал
            </div>
            
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
              Мы знаем о велосипедах <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
                немного больше
              </span>
            </h2>
            
            <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-lg">
              В нашем журнале мы честно рассказываем о том, как выбрать, проверить и доставить велосипед мечты. Без маркетинговой воды, только опыт тысяч сделок.
            </p>

            <Button 
              size="lg"
              className="w-fit h-14 rounded-full px-8 text-lg font-bold bg-black hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
              onClick={() => navigate('/journal')}
            >
              Читать Журнал
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Right Column: FAQ */}
          <div className="bg-gray-50 rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Частые вопросы</h3>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-4">
              {FAQS.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-none bg-white rounded-2xl px-6 shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-5 text-lg font-bold text-gray-900 text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <p className="text-gray-600 text-base leading-relaxed mb-4">
                      {faq.answer}
                    </p>
                    <button 
                      onClick={() => navigate(faq.linkUrl)}
                      className="text-orange-600 font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      {faq.linkText}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

        </div>
      </div>
    </section>
  );
}
