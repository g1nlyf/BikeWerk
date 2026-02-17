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
    <div className="relative w-full overflow-hidden rounded-[24px] bg-white px-8 py-16 text-center">
      {/* Monochrome line icon */}
      <div className="relative mx-auto mb-8 grid h-24 w-24 place-items-center">
        <Search className="h-16 w-16 text-black" strokeWidth={2} />
      </div>

      {/* Fielmann-style heading: uppercase, bold, letter-spacing */}
      <h3 className="heading-fielmann relative mx-auto max-w-2xl text-2xl md:text-3xl text-black">
        Такого байка мы еще не добавили
      </h3>

      {/* Body text */}
      <p className="text-fielmann relative mx-auto mt-4 max-w-2xl">
        Оставьте бесплатную заявку: наш менеджер проверит наличие на всех европейских площадках и выберет лучшие предложения.
      </p>

      {/* Pill buttons */}
      <div className="relative mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="btn-pill-primary flex-1"
          onClick={handleOpenLead}
        >
          Оставить заявку
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="btn-pill-secondary flex-1"
          onClick={() => (window.location.href = "/calculator")}
        >
          <Calculator className="mr-2 h-5 w-5" />
          Калькулятор
        </Button>
      </div>
    </div>
  );
}
