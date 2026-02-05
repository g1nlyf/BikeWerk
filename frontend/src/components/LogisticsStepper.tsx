import React from 'react';
import { Check, Truck, Package, Search, Home, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export interface LogisticsStep {
  id: string;
  label: string;
  description?: string;
  date?: string;
  status: 'completed' | 'current' | 'pending';
  icon?: React.ReactNode;
}

interface LogisticsStepperProps {
  steps: LogisticsStep[];
  estimatedDelivery?: string;
}

export const LogisticsStepper: React.FC<LogisticsStepperProps> = ({ steps, estimatedDelivery }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Статус доставки</CardTitle>
        {estimatedDelivery && (
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <Clock className="w-4 h-4" />
            Ожидаемая дата: <span className="font-medium text-foreground">{estimatedDelivery}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative space-y-8 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-800">
          {steps.map((step, index) => {
            const isCompleted = step.status === 'completed';
            const isCurrent = step.status === 'current';
            
            return (
              <div key={step.id} className="relative flex gap-6 items-start group">
                <div className={cn(
                  "absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-colors",
                  isCompleted ? "bg-green-500 border-green-500 text-white" : 
                  isCurrent ? "bg-white border-blue-500 text-blue-500 dark:bg-gray-900" : 
                  "bg-white border-gray-300 text-gray-300 dark:bg-gray-900 dark:border-gray-700"
                )}>
                  {isCompleted ? <Check className="w-4 h-4" /> : 
                   step.icon ? step.icon : <div className="w-2 h-2 rounded-full bg-current" />}
                </div>
                
                <div className="pl-10 pt-1 w-full">
                  <div className="flex justify-between items-start">
                    <h4 className={cn(
                      "font-medium text-sm md:text-base",
                      isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </h4>
                    {step.date && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {step.date}
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export const MOCK_STEPS: LogisticsStep[] = [
  {
    id: '1',
    label: 'Заказ оформлен',
    description: 'Мы получили ваш заказ и связались с продавцом',
    date: '10 окт',
    status: 'completed',
    icon: <Package className="w-4 h-4" />
  },
  {
    id: '2',
    label: 'Байк на складе',
    description: 'Велосипед прибыл в наш хаб в Берлине',
    date: '12 окт',
    status: 'completed',
    icon: <Home className="w-4 h-4" />
  },
  {
    id: '3',
    label: 'Техническая проверка',
    description: 'Инженеры проверяют состояние рамы и компонентов',
    status: 'current',
    icon: <Search className="w-4 h-4" />
  },
  {
    id: '4',
    label: 'В пути к вам',
    description: 'Передан в службу доставки',
    status: 'pending',
    icon: <Truck className="w-4 h-4" />
  },
  {
    id: '5',
    label: 'Доставлен',
    description: 'Курьер свяжется за час до прибытия',
    status: 'pending',
    icon: <Check className="w-4 h-4" />
  }
];
