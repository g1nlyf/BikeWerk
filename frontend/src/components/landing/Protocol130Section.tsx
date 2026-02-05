import React from 'react';
import { Button } from "@/components/ui/button";

export const Protocol130Section: React.FC = () => {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-24 gap-y-0 lg:gap-y-12 items-center">
          
          {/* Left: Image (Visual Anchor) */}
          <div className="relative aspect-square md:aspect-[4/3] w-full bg-white md:rounded-[3rem] flex items-center justify-center order-1 lg:order-1 mb-0 md:mb-0 -mt-8 md:mt-0">
             <img 
               src="/prot130pic.jpg" 
               alt="Протокол 130 - Рентген качества" 
               className="w-full h-full object-contain"
             />
          </div>

          {/* Right: Text Content */}
          <div className="flex flex-col items-start text-left order-2 lg:order-2 -mt-8 md:mt-0 relative z-10">
             <h2 className="text-[32px] md:text-5xl lg:text-[56px] leading-[1.1] font-extrabold text-gray-900 mb-6 tracking-tight font-manrope">
               Отсеиваем «хлам»<br />
               ещё до выкупа.<br />
               Протокол 130.
             </h2>
             
             <p className="text-[16px] md:text-[19px] text-gray-600 leading-[1.6] mb-8 max-w-xl font-medium">
               Наша система — это многоступенчатый фильтр. 
               От AI-анализа объявления до эндоскопии карбона 
               в Германии. Мы не просто смотрим фото — мы 
               «сканируем» байк рентгеном инженерного опыта, 
               чтобы вы получили эталонный экземпляр, а не 
               проблемы предыдущего владельца.
             </p>

             <div className="flex flex-col gap-4 w-full md:w-auto">
               <Button 
                 className="w-full md:w-auto rounded-full px-10 h-14 md:h-16 text-base md:text-lg font-bold bg-black text-white hover:bg-gray-800 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1"
                 onClick={() => window.location.href = '/about#inspection'}
               >
                 Подробнее о системе проверки
               </Button>

               <Button 
                variant="outline"
                className="w-full md:w-auto rounded-full px-10 h-14 md:h-16 text-base md:text-lg font-bold border-2 border-black text-black hover:bg-black hover:text-white transition-all duration-300"
                onClick={() => window.open('/Protocol_130_Example.pdf', '_blank')}
              >
                Посмотреть пример отчета
              </Button>
             </div>
          </div>

        </div>
      </div>
    </section>
  );
};
