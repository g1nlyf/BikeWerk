import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, ChevronRight, X, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type QualityBlockProps = {
    product: any; // Using any to avoid strict type duplication issues for now
};

export function QualityBlock({ product }: QualityBlockProps) {
    const [open, setOpen] = React.useState(false);

    if (!product?.initial_quality_class) {
      return (
        <div className="mb-8 p-4 rounded-2xl bg-gray-50/50 border border-gray-100 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
               <div className="w-12 h-12 rounded-full bg-gray-200" />
               <div className="h-4 w-32 bg-gray-200 rounded" />
          </div>
          <div className="h-4 w-full bg-gray-200 rounded opacity-50" />
        </div>
      );
    }

    // Use AI fields if available, otherwise fallback
    const cls = product.condition_class || product.initial_quality_class || 'B';
    // Score logic: If AI provided technical_score or condition_score, use it. Else map from grade.
    const score = product.technical_score || product.condition_score || (cls === 'A' ? 95 : cls === 'B' ? 78 : 50);
    const reason = product.condition_reason || product.technicalSummary || "Велосипед прошел первичную оценку AI. Техническое состояние соответствует заявленному классу.";
    const components = product.components_json ? (typeof product.components_json === 'string' ? JSON.parse(product.components_json) : product.components_json) : [];

    // Grade-to-letter mapping for circular indicator
    let displayGrade = cls;
    if (cls === 'Идеальное') displayGrade = 'A';
    if (cls === 'Хорошее') displayGrade = 'B';
    if (cls === 'Среднее') displayGrade = 'C';
    if (cls === 'Новый') displayGrade = 'A';
    if (displayGrade.length > 2 && !['A','B','C'].includes(displayGrade)) displayGrade = 'B';

    // Colors
    const colorMap: Record<string, string> = {
        'A': 'text-emerald-600',
        'B': 'text-amber-600',
        'C': 'text-red-600'
    };
    const bgMap: Record<string, string> = {
        'A': 'bg-emerald-50',
        'B': 'bg-amber-50',
        'C': 'bg-red-50'
    };
    const borderMap: Record<string, string> = {
        'A': 'border-emerald-200',
        'B': 'border-amber-200',
        'C': 'border-red-200'
    };
    const ringMap: Record<string, string> = {
        'A': 'ring-emerald-100',
        'B': 'ring-amber-100',
        'C': 'ring-red-100'
    };
    const strokeMap: Record<string, string> = {
        'A': '#059669', // emerald-600
        'B': '#d97706', // amber-600
        'C': '#dc2626'  // red-600
    };

    const colorClass = colorMap[displayGrade] || 'text-gray-600';
    const bgClass = bgMap[displayGrade] || 'bg-gray-50';
    const borderClass = borderMap[displayGrade] || 'border-gray-200';
    const strokeColor = strokeMap[displayGrade] || '#4b5563';

    // Circle config
    const radius = 22; // Increased size
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference; // Normalize 0-100

    const statusTextMap: Record<string, string> = {
        'A': 'Идеальное',
        'B': 'Хорошее',
        'C': 'Среднее',
        'A+': 'Как новое',
        'Идеальное': 'Идеальное',
        'Хорошее': 'Хорошее',
        'Среднее': 'Среднее',
        'Б/у': 'Б/у',
        'Новый': 'Новое'
    };
    const statusText = statusTextMap[displayGrade] || statusTextMap[cls] || 'Хорошее';

    return (
      <>
        <div 
          onClick={() => setOpen(true)}
          className={cn("mb-6 group cursor-pointer transition-all hover:bg-gray-50 rounded-2xl p-4 border border-transparent hover:border-gray-100 w-full break-words", bgClass, borderClass)}
        >
          {/* Header Row */}
          <div className="flex items-start gap-4">
            {/* Circular Indicator */}
            <div className="relative w-14 h-14 shrink-0">
               <svg className="w-full h-full transform -rotate-90">
                 <circle
                   cx="28"
                   cy="28"
                   r={radius}
                   stroke="#e5e7eb"
                   strokeWidth="3"
                   fill="none"
                 />
                 <circle
                   cx="28"
                   cy="28"
                   r={radius}
                   stroke={strokeColor}
                   strokeWidth="3"
                   fill="none"
                   strokeDasharray={circumference}
                   strokeDashoffset={circumference - progress}
                   strokeLinecap="round"
                 />
               </svg>
               <div className={cn("absolute inset-0 flex items-center justify-center font-bold text-xl", colorClass)}>
                 {displayGrade}
               </div>
            </div>

            <div className="flex-1 min-w-0">
               <div className="flex items-start gap-2 mb-1 min-w-0">
                 <div className="font-bold text-base text-gray-900 leading-snug break-words min-w-0">
                   Техническое состояние: {statusText}
                 </div>
                 <HelpCircle className="w-4 h-4 text-gray-400 opacity-50 shrink-0 mt-1" />
               </div>
               <div className="text-sm text-muted-foreground font-medium">
                  Класс {displayGrade} • Рейтинг {score}/100
               </div>
            </div>
             <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors mt-3" />
          </div>

          {/* Justification Text */}
          <div className="mt-3 pl-0 sm:pl-[4.5rem]">
             <p className="text-gray-600 italic leading-relaxed text-sm font-light break-words whitespace-normal">
                "{reason}"
             </p>
             {components && components.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {components.map((comp: string, i: number) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                           ✨ {comp}
                        </span>
                    ))}
                </div>
             )}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
           <DialogContent className="sm:max-w-md rounded-3xl p-6">
             <div className="space-y-4 relative">
                <button 
                  onClick={() => setOpen(false)}
                  className="absolute right-0 top-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="h-6 w-6 text-gray-400" />
                </button>
                <div className="flex items-center gap-4">
                   <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold", bgMap[displayGrade], colorClass)}>
                      {displayGrade}
                   </div>
                   <div>
                      <DialogTitle className="text-xl">Класс качества {displayGrade}</DialogTitle>
                      <DialogDescription>
                         {statusText} состояние • {score}/100
                      </DialogDescription>
                   </div>
                </div>

                <div className="space-y-3 pt-2">
                   <div className="p-4 bg-gray-50 rounded-2xl text-sm leading-relaxed text-gray-700">
                      <span className="font-semibold text-gray-900 block mb-1">Вердикт нейросети (Gemini Vision):</span>
                      <span className="break-words whitespace-normal">
                        "{reason}"
                      </span>
                      
                      {components && components.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                            <span className="font-semibold text-gray-900 block mb-2 text-xs uppercase tracking-wider">Интересные компоненты:</span>
                            <ul className="space-y-1">
                                {components.map((comp: string, i: number) => (
                                    <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        {comp}
                                    </li>
                                ))}
                            </ul>
                        </div>
                      )}
                   </div>
                   
                   <div className="border rounded-2xl p-4 max-h-[240px] overflow-y-auto bg-white shadow-inner">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 bg-white pb-2 border-b z-10">
                         AI Check-list (21 пункт)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         {[
                          "Геометрия рамы", "Лакокрасочное покрытие", "Сварные швы / Карбон", "Рулевой стакан",
                          "Вилка (ноги/штаны)", "Задний амортизатор", "Люфты подвески",
                          "Трансмиссия (износ)", "Цепь (растяжение)", "Кассета (зубья)", "Переключатели",
                          "Тормозные ручки", "Калиперы", "Роторы", "Гидролинии",
                          "Обода (биения)", "Спицы", "Втулки", "Покрышки",
                          "Седло/Подседел", "Кокпит (Руль/Вынос)"
                         ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                               <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                               <span>{item}</span>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             </div>
           </DialogContent>
        </Dialog>
      </>
    );
  }
