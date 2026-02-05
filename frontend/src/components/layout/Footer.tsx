import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border/30 bg-[#F3F4F6]">
      <div className="container mx-auto grid gap-10 px-6 py-8 md:grid-cols-4 md:px-16 md:py-12">
        {/* Company Info */}
        <div className="flex flex-col gap-4">
          <div className="font-extrabold text-xl tracking-tight text-gray-900 font-manrope">BikeEU</div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Подбор, выкуп и доставка велосипедов из Европы под ключ.
          </p>
          <p className="text-sm text-muted-foreground font-medium">
            Работаем из Марбурга, Германия.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <div className="font-bold text-gray-900 mb-4">Быстрые ссылки</div>
          <ul className="space-y-3 text-sm text-gray-600">
            <li><a href="/catalog" className="hover:text-black transition-colors">Каталог</a></li>
            <li><a href="/calculator" className="hover:text-black transition-colors">Калькулятор</a></li>
            <li><a href="/sniper" className="hover:text-black transition-colors">Снайпер</a></li>
            <li><a href="/about" className="hover:text-black transition-colors">О компании</a></li>
            <li><a href="/about#contacts" className="hover:text-black transition-colors">Контакты</a></li>
            <li><a href="/#journal" className="hover:text-black transition-colors">Журнал</a></li>
          </ul>
        </div>

        {/* Documents */}
        <div>
          <div className="font-bold text-gray-900 mb-4">Документы</div>
          <ul className="space-y-3 text-sm text-gray-600">
            <li>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <a 
                      href="/documents/Offer_Agreement.pdf" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-black transition-colors"
                    >
                      Договор оферты
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className="bg-black text-white text-xs px-2 py-1">
                    <p>Скачать PDF</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </li>
            <li>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <a 
                      href="/documents/Privacy_Policy.pdf" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-black transition-colors"
                    >
                      Политика конфиденциальности
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className="bg-black text-white text-xs px-2 py-1">
                    <p>Скачать PDF</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </li>
          </ul>
        </div>

        {/* Partnership */}
        <div>
          <div className="font-bold text-gray-900 mb-4">Партнёрство</div>
          <ul className="space-y-3 text-sm text-gray-600">
            <li><a href="/about#contacts" className="hover:text-black transition-colors">Для партнёров</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-center px-6 py-8 text-sm text-gray-500">
          <span className="text-center">© 2026 BikeEU. Все права защищены.</span>
        </div>
      </div>
    </footer>
  );
};
