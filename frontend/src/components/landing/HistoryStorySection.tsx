import React from 'react';
import { Button } from "@/components/ui/button";

export const HistoryStorySection: React.FC = () => {
  return (
    <section className="py-12 md:py-24 bg-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-8 lg:gap-y-12 items-center lg:gap-x-12">
          
          {/* Text Content */}
          <div className="flex flex-col items-start text-left order-2 lg:order-1 pt-0 relative z-10">
             <h2 className="text-[32px] md:text-5xl lg:text-[56px] leading-[1.1] font-extrabold text-gray-900 mb-6 tracking-tight font-manrope">
               Как мы начинали
             </h2>
             
             <div className="text-[15px] md:text-lg text-gray-600 leading-[1.6] mb-8 max-w-xl space-y-4">
               <p>
                 Я — Влад. Живу в Германии и больше 6 лет катаю даунхилл.
               </p>
               <p>
                 В 2023 году, еще живя в России, искал себе новый байк. Европейские цены казались волшебными — но я рискнул и, продумав всю схему, выкупил себе YT Tues, сэкономив больше 80 тысяч. Пройдя через все этапы оплаты, логистики и таможни, я понял, насколько это непростая задача.
               </p>
               <p>
                 Друзья попросили помочь и им. Потом их друзья. Потом совсем незнакомые люди с Авито. Так я постепенно создавал систему, которая стала BikeEU.
               </p>
               <p>
                 Сейчас мы — команда из менеджеров, логистов и разработчиков. Наши партнеры — опытные механики. Мы работаем каждый день, чтобы держать и поднимать планку качества, которую взяли на себя.
               </p>
               <p className="font-medium text-gray-900">
                 Подробнее обо всех процессах можно почитать в <a href="/journal" target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] hover:underline transition-all">журнале</a> — или <a href="https://t.me/g1nlyf" target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] hover:underline transition-all">написать лично мне</a>. Я всегда на связи.
               </p>
             </div>

             <div className="w-full sm:w-auto">
               <Button 
                 variant="outline"
                 className="h-14 px-8 rounded-full text-base font-bold border-2 border-black text-black hover:bg-black hover:text-white transition-all duration-300"
                 onClick={() => window.open('https://www.avito.ru/brands/23d2e394fb382cd468d8d2d489bb8b11', '_blank')}
               >
                 → Посмотреть наши первые сделки на Авито
               </Button>
             </div>
          </div>

          {/* Image */}
          <div className="relative aspect-[3/4] md:aspect-[16/9] lg:aspect-[4/3] w-[calc(100%+2rem)] -mx-4 md:w-full md:mx-0 bg-white md:bg-gray-50 md:rounded-[2rem] overflow-hidden order-1 lg:order-2 md:shadow-sm">
             <img 
               src="/AVTIOmobileland.jpg" 
               alt="История Bikeflip" 
               className="w-full h-full object-cover"
             />
          </div>

        </div>
      </div>
    </section>
  );
};
