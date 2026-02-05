import React from 'react';
import { ShieldCheck, Camera, MessageCircle, FileText } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const ValueStack = () => {
  const items = [
    {
      icon: <ShieldCheck className="w-5 h-5 text-green-600" />,
      title: "Страховка 100%",
      desc: "Байк застрахован нами до вашей двери."
    },
    {
      icon: <Camera className="w-5 h-5 text-blue-600" />,
      title: "Складской контроль",
      desc: "Бесплатный фотосет при прибытии на консолидацию."
    },
    {
      icon: <MessageCircle className="w-5 h-5 text-purple-600" />,
      title: "Экспертный опрос",
      desc: "Мы сами выжмем из продавца всю правду после бронирования."
    }
  ];

  return (
    <div className="flex flex-col gap-3 my-4 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Гарантии по умолчанию</h4>
      {items.map((item, idx) => (
        <TooltipProvider key={idx}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-help group">
                <div className="bg-white p-1.5 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-gray-900 block">{item.title}</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[200px] bg-gray-900 text-white border-0">
              <p className="text-xs">{item.desc}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
};

export const AIInsightTooltip = ({ grade, children }: { grade: string, children?: React.ReactNode }) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {children || (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold uppercase rounded cursor-help hover:bg-black transition-colors">
              <TargetIcon className="w-3 h-3" />
              <span>AI Grade {grade}</span>
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-[280px] p-4 bg-white text-gray-900 border border-gray-200 shadow-xl">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b pb-2 mb-2">
              <TargetIcon className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-sm">Мультивекторный Анализ</span>
            </div>
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li className="flex gap-2">
                <CheckIcon className="w-3 h-3 text-green-500 mt-0.5" />
                <span>Проанализировано 12+ фото на артефакты коррозии</span>
              </li>
              <li className="flex gap-2">
                <CheckIcon className="w-3 h-3 text-green-500 mt-0.5" />
                <span>Текст проверен на скрытые негативные триггеры</span>
              </li>
              <li className="flex gap-2">
                <CheckIcon className="w-3 h-3 text-green-500 mt-0.5" />
                <span>Рейтинг продавца сопоставлен с историей цен</span>
              </li>
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
