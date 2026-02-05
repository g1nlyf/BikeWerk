import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, CheckCircle, FileText, Scale, Headphones } from "lucide-react";

const guarantees = [
  { 
    title: "Финансовая защита", 
    desc: "Деньги переводятся продавцу только после того, как вы получите велосипед и подтвердите, что он соответствует описанию. Эскроу-счет гарантирует безопасность.",
    icon: Shield
  },
  { 
    title: "Страхование доставки", 
    desc: "Каждый груз застрахован на 100% стоимости. В случае повреждения или утери мы полностью возмещаем ущерб или ремонтируем за свой счет.",
    icon: CheckCircle
  },
  { 
    title: "Юридическая чистота", 
    desc: "Мы проверяем каждого продавца и историю велосипеда. Предоставляем официальный договор и закрывающие документы для таможни.",
    icon: FileText
  },
  { 
    title: "Честные условия", 
    desc: "Никаких скрытых комиссий. Итоговая цена фиксируется в договоре и не меняется в процессе доставки, даже если курсы валют скачут.",
    icon: Scale
  },
  { 
    title: "Личная поддержка", 
    desc: "За вами закрепляется персональный менеджер. Он ведет сделку от первого звонка до вручения велосипеда и решает любые вопросы.",
    icon: Headphones
  },
];

export const GuaranteesSection: React.FC = () => {
  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
          Полный пакет гарантий
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Мы работаем официально и прозрачно. Ваше спокойствие — наш главный приоритет на каждом этапе сделки.
        </p>
      </div>
      
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {guarantees.map((g, i) => (
          <Card 
            key={i} 
            className="group relative overflow-hidden border-none bg-gradient-to-br from-muted/50 to-muted/10 hover:from-primary/5 hover:to-primary/0 transition-all duration-500 rounded-3xl"
          >
            <CardContent className="p-8 flex flex-col h-full">
              <div className="mb-6 w-14 h-14 rounded-2xl bg-background shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                <g.icon className="w-7 h-7" />
              </div>
              
              <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                {g.title}
              </h3>
              
              <p className="text-muted-foreground leading-relaxed">
                {g.desc}
              </p>
            </CardContent>
          </Card>
        ))}
        
        {/* Call to Action Card */}
        <Card className="relative overflow-hidden border-none bg-primary text-primary-foreground rounded-3xl flex flex-col justify-center items-center text-center p-8 shadow-xl shadow-primary/20">
           <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-soft-light" />
           <div className="relative z-10 space-y-4">
              <h3 className="text-2xl font-bold">Остались вопросы?</h3>
              <p className="text-primary-foreground/90">
                 Изучите договор или задайте вопрос юристу.
              </p>
              <button className="px-6 py-3 rounded-full bg-background text-primary font-bold hover:bg-background/90 transition-colors w-full">
                 Связаться с нами
              </button>
           </div>
        </Card>
      </div>
    </section>
  );
};
