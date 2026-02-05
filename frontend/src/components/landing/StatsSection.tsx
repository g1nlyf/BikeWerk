import * as React from "react";
import { Badge } from "@/components/ui/badge";

export default function StatsSection() {
  return (
    <section id="stats" className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="text-2xl md:text-3xl font-semibold">Статистика</h2>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Badge variant="outline" className="justify-center py-3 text-base">147 велосипедов доставлено</Badge>
        <Badge variant="outline" className="justify-center py-3 text-base">Средняя экономия: 32 000 руб</Badge>
        <Badge variant="outline" className="justify-center py-3 text-base">Год основания: 2021</Badge>
      </div>
    </section>
  );
}