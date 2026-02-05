import React from 'react';

export const ProcessStepsSection: React.FC = () => {
  return (
    <section className="py-8 md:py-24 bg-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 md:mb-24">
          <h2 className="text-[36px] md:text-[56px] leading-[1.05] font-black tracking-tight text-gray-800 mb-4 md:mb-6 font-serif">
            Процесс: От выбора в Германии до вашей двери
          </h2>
          <p className="text-base md:text-lg text-gray-500 font-normal">
            Прозрачный путь вашего велосипеда в 4 этапа. Технологии, экспертиза и забота.
          </p>
        </div>

        {/* Grid Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-20 gap-y-4 lg:gap-y-24">
          
          {/* --- ROW 1 LEFT (01) --- */}
          {/* Text Left, Image Right */}
          <div className="flex flex-col lg:flex-row items-start gap-2 lg:gap-8">
            <div className="flex-1 pt-2 order-1 lg:order-none relative z-10">
              <div className="relative mb-0 md:mb-4">
                <span className="text-[75px] md:text-[100px] leading-none font-bold text-gray-200 block">01</span>
                {/* Dashed line */}
                <div className="hidden lg:block absolute top-[50%] left-[110px] right-[-40px] h-[2px] border-t-2 border-dashed border-gray-200"></div>
              </div>
              <h3 className="text-2xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-4 leading-tight">
                Умный подбор и<br />AI-прогноз
              </h3>
              <p className="text-base md:text-[15px] text-gray-600 leading-relaxed">
                Выбираете байк в каталоге. Наша система мгновенно анализирует данные и дает предварительный прогноз класса качества еще до бронирования.
              </p>
            </div>
            {/* Image Placeholder */}
             <div className="flex-shrink-0 relative order-2 lg:order-none w-full lg:w-auto flex justify-center lg:block -mt-2 lg:mt-0 z-0">
               <img 
                 src="/ext photos/stage1.png" 
                 alt="Умный подбор" 
                 className="w-full max-w-[320px] md:max-w-[390px] h-auto object-contain"
               />
             </div>
           </div>

          {/* --- ROW 1 RIGHT (02) --- */}
          {/* Image Left, Text Right */}
          <div className="flex flex-col lg:flex-row items-start gap-2 lg:gap-8">
            {/* Image Placeholder */}
            <div className="flex-shrink-0 relative order-2 lg:order-none w-full lg:w-auto flex justify-center lg:block -mt-2 lg:mt-0 z-0">
              <img 
                src="/ext photos/stage2.png" 
                alt="Удаленный техосмотр" 
                className="w-full max-w-[280px] md:max-w-[315px] h-auto object-contain"
              />
            </div>
            
            <div className="flex-1 pt-2 order-1 lg:order-none relative z-10">
              <div className="relative mb-0 md:mb-4">
                <span className="text-[75px] md:text-[100px] leading-none font-bold text-gray-200 block">02</span>
                {/* Dashed line */}
                <div className="hidden lg:block absolute top-[50%] left-[110px] right-[-100px] h-[2px] border-t-2 border-dashed border-gray-200"></div>
              </div>
              <h3 className="text-2xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-4 leading-tight">
                Удаленный техосмотр:<br />30 пунктов
              </h3>
              <p className="text-base md:text-[15px] text-gray-600 leading-relaxed">
                Мы запрашиваем детальные фото у продавца. Эксперт и обновленный ИИ проводят глубокий анализ по 30 параметрам, подтверждая финальный класс качества.
              </p>
            </div>
          </div>

          {/* --- ROW 2 LEFT (03) --- */}
          {/* Text Left, Image Right */}
          <div className="flex flex-col lg:flex-row items-start gap-2 lg:gap-8">
            <div className="flex-1 pt-2 order-1 lg:order-none relative z-10">
              <div className="relative mb-0 md:mb-4">
                <span className="text-[75px] md:text-[100px] leading-none font-bold text-gray-200 block">03</span>
                {/* Dashed line */}
                <div className="hidden lg:block absolute top-[50%] left-[110px] right-[-40px] h-[2px] border-t-2 border-dashed border-gray-200"></div>
              </div>
              <h3 className="text-2xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-4 leading-tight">
                Экспертный техосмотр:<br />130 пунктов
              </h3>
              <p className="text-base md:text-[15px] text-gray-600 leading-relaxed">
                Байк прибывает к нам. Механик досконально проверяет каждый узел вживую, демонстрируя процесс и состояние байка вам по видеосвязи.
              </p>
            </div>
             {/* Image Placeholder */}
             <div className="flex-shrink-0 relative order-2 lg:order-none w-full lg:w-auto flex justify-center lg:block -mt-2 lg:-mt-16 z-0">
               <img 
                 src="/ext photos/Stage 3.png" 
                 alt="Экспертный техосмотр" 
                 className="w-full max-w-[320px] md:max-w-[380px] h-auto object-contain"
               />
             </div>
           </div>

          {/* --- ROW 2 RIGHT (04) --- */}
          {/* Image Left, Text Right */}
          <div className="flex flex-col lg:flex-row items-start gap-2 lg:gap-8">
            {/* Image Placeholder */}
            <div className="flex-shrink-0 relative order-2 lg:order-none w-full lg:w-auto flex justify-center lg:block -mt-2 lg:-mt-16 z-0">
              <img 
                src="/ext photos/stage 4.png" 
                alt="Надежная упаковка" 
                className="w-full max-w-[330px] md:max-w-[400px] h-auto object-contain"
              />
            </div>

            <div className="flex-1 pt-2 order-1 lg:order-none relative z-10">
              <div className="relative mb-0 md:mb-4">
                <span className="text-[75px] md:text-[100px] leading-none font-bold text-gray-200 block">04</span>
                {/* Dashed line */}
                <div className="hidden lg:block absolute top-[50%] left-[110px] right-[-40px] h-[2px] border-t-2 border-dashed border-gray-200"></div>
              </div>
              <h3 className="text-2xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-4 leading-tight">
                Надежная упаковка<br />и отправка
              </h3>
              <p className="text-base md:text-[15px] text-gray-600 leading-relaxed">
                Сверхнадежная упаковка с защитой всех компонентов. Байк с печатью качества отправляется в застрахованное путешествие к вам домой.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
