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
    <div className="relative w-full overflow-hidden rounded-[24px] border border-zinc-200 bg-white px-5 py-12 text-center shadow-sm">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#a3e635]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-zinc-900/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />

      <div className="relative mx-auto mb-8 grid h-20 w-20 place-items-center rounded-[22px] border border-zinc-200 bg-white shadow-[0_12px_40px_rgba(24,24,27,0.12)]">
        <div className="absolute inset-0 rounded-[22px] bg-[#a3e635]/20 blur-xl" />
        <Search className="relative h-10 w-10 text-zinc-900" />
      </div>

      <h3 className="relative text-2xl md:text-4xl font-extrabold tracking-tight">
        Такого байка мы еще не добавили, но это не значит что его нет!
      </h3>

      <p className="relative mx-auto mt-4 max-w-2xl text-base md:text-lg leading-relaxed text-zinc-600">
        Оставьте бесплатную заявку: наш менеджер проверит наличие на всех европейских площадках и выберет лучшие предложения.
      </p>

      <div className="relative mx-auto mt-9 flex w-full max-w-md flex-col gap-3">
        <Button
          size="lg"
          className="h-14 w-full rounded-full bg-[#a3e635] text-black text-base md:text-lg font-extrabold shadow-[0_18px_60px_rgba(163,230,53,0.35)] hover:bg-[#84cc16] transition-all duration-300"
          onClick={handleOpenLead}
        >
          Оставить бесплатную заявку
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="h-14 w-full rounded-full border-zinc-200 bg-white text-base md:text-lg font-semibold hover:bg-zinc-50"
          onClick={() => (window.location.href = "/calculator")}
        >
          <Calculator className="mr-2 h-5 w-5" />
          Посчитать стоимость
        </Button>
      </div>
    </div>
  );
}
