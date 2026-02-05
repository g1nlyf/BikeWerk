import * as React from "react";
import { Button } from "@/components/ui/button";

export const CalculatorCTASection: React.FC = () => {
  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl md:text-3xl font-semibold">Узнайте точную стоимость за 30 секунд</h2>
      <div className="mt-6">
        <Button asChild>
          <a href="/calculator">Перейти к калькулятору</a>
        </Button>
      </div>
    </section>
  );
};