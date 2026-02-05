"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calculator, Search } from "lucide-react";
import { useLeadSystem } from "@/context/LeadSystemContext";

export function EmptyCatalogState() {
  const { openLeadModal } = useLeadSystem();

  const handleOpenLead = () => {
    // Pass a placeholder product for general inquiry
    openLeadModal({
      id: 0,
      name: "Индивидуальный подбор",
      price: 0,
      image: "/placeholder-bike.svg"
    });
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-16 px-4 text-center min-h-[400px]">
      {/* Icon / Illustration Placeholder */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-[#a3e635]/20 blur-2xl rounded-full" />
        <div className="relative bg-card border rounded-full p-6 shadow-lg">
          <Search className="w-12 h-12 text-[#a3e635]" />
        </div>
      </div>

      <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-4">
        Пока пусто, но это поправимо!
      </h3>
      
      <p className="text-muted-foreground max-w-xl text-lg mb-8 leading-relaxed">
        Пока таких байков мы не добавили, но это не значит, что их нет! 
        Менеджер может в частном порядке найти его для вас — скорее всего, 
        он действительно где-то существует.
      </p>

      <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full max-w-sm">
        <Button 
          size="lg" 
          className="w-full rounded-full bg-[#a3e635] hover:bg-[#84cc16] text-black font-bold text-lg h-14 shadow-[0_0_20px_rgba(163,230,53,0.3)] hover:shadow-[0_0_30px_rgba(163,230,53,0.5)] transition-all duration-300"
          onClick={handleOpenLead}
        >
          Хочу бесплатный подбор!
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        
        <Button 
          size="lg" 
          variant="outline" 
          className="w-full rounded-full border-2 h-14 text-lg font-medium hover:bg-secondary/50"
          onClick={() => window.location.href = "/calculator"}
        >
          <Calculator className="mr-2 h-5 w-5" />
          В калькулятор
        </Button>
      </div>
    </div>
  );
}
