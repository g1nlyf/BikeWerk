import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SearchIcon, UserIcon, FileTextIcon, ShoppingCartIcon, PackageIcon, TruckIcon, ShieldCheckIcon, CheckCircle2 } from 'lucide-react';

interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: Step[] = [
  {
    id: 1,
    title: 'Подбор и проверка',
    description: 'Находим лучшие варианты по вашим требованиям. Проверяем историю, состояние и продавца.',
    icon: <SearchIcon className="w-6 h-6" />,
  },
  {
    id: 2,
    title: 'Юридическая чистота',
    description: 'Заключаем договор. Вы получаете инвойсы и прозрачную историю платежей.',
    icon: <FileTextIcon className="w-6 h-6" />,
  },
  {
    id: 3,
    title: 'Выкуп и приёмка',
    description: 'Выкупаем байк в Германии. Принимаем на складе, делаем фотоотчет и проверяем соответствие.',
    icon: <ShoppingCartIcon className="w-6 h-6" />,
  },
  {
    id: 4,
    title: 'Таможенное оформление',
    description: 'Полное сопровождение. Официальный ввоз, уплата всех пошлин и сборов.',
    icon: <ShieldCheckIcon className="w-6 h-6" />,
  },
  {
    id: 5,
    title: 'Надежная логистика',
    description: 'Застрахованная перевозка до Москвы. Отслеживание на каждом этапе.',
    icon: <TruckIcon className="w-6 h-6" />,
  },
  {
    id: 6,
    title: 'Вручение вам',
    description: 'Финальная проверка. Выдача со склада или доставка до вашей двери.',
    icon: <CheckCircle2 className="w-6 h-6" />,
  },
];

const HowItWorksSection: React.FC = () => {
  return (
    <section id="how-it-works" className="w-full py-20 px-4 bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] left-[5%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
            Прозрачно и под контролем
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Мы не просто "доставляем". Мы берем на себя все риски, бюрократию и переговоры. Вы получаете велосипед, а не проблемы.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <Card 
              key={step.id}
              className="relative border-none bg-muted/30 hover:bg-muted/50 transition-colors duration-300 overflow-hidden group"
            >
              <CardContent className="p-8">
                <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-8xl text-foreground select-none pointer-events-none group-hover:opacity-20 transition-opacity">
                  {step.id}
                </div>
                
                <div className="mb-6 inline-flex p-4 rounded-2xl bg-background shadow-sm text-primary group-hover:scale-110 transition-transform duration-300">
                  {step.icon}
                </div>
                
                <h3 className="text-2xl font-bold mb-3 relative z-10">
                  {step.title}
                </h3>
                
                <p className="text-muted-foreground leading-relaxed relative z-10">
                  {step.description}
                </p>
              </CardContent>
              
              {/* Progress Line Connector (Desktop) */}
              {index !== steps.length - 1 && (index + 1) % 3 !== 0 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-border -z-10" />
              )}
            </Card>
          ))}
        </div>

        {/* Trust Indicator */}
        <div className="mt-12 p-6 rounded-3xl bg-primary/5 border border-primary/10 text-center max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-foreground/80">
             <ShieldCheckIcon className="w-8 h-8 text-primary shrink-0" />
             <p className="text-lg font-medium">
               Каждый этап фиксируется в договоре. Никаких скрытых платежей или "внезапных" задержек без компенсации.
             </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
