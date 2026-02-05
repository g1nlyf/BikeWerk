"use client";

import { ArrowUpRight, Calculator, Sparkles } from "lucide-react";
import { useCheckoutUI } from "@/lib/checkout-ui";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export default function CalculatorBringYourOwnSection({ className }: Props) {
  const { openSelection } = useCheckoutUI();

  return (
    <section className={cn("py-10 md:py-24", className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-2 gap-4 md:flex md:flex-row md:items-center md:justify-center md:gap-12">
          
          {/* Calculator Button (Image) */}
          <button
            type="button"
            onClick={() => (window.location.href = "/calculator")}
            className="w-full max-w-[450px] aspect-square rounded-[2.5rem] overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-transform duration-300 shadow-xl"
          >
            <img 
              src="/ext photos/CalcButtn.png" 
              alt="Калькулятор" 
              className="w-full h-full object-cover"
            />
          </button>

          {/* Selection Button (Image) */}
          <button
            type="button"
            onClick={openSelection}
            className="w-full max-w-[450px] aspect-square rounded-[2.5rem] overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-transform duration-300 shadow-xl"
          >
            <img 
              src="/ext photos/PodborBttn.png" 
              alt="Подбор" 
              className="w-full h-full object-cover"
            />
          </button>

        </div>
      </div>
    </section>
  );
}
