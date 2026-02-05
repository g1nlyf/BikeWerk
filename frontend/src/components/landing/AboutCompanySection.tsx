import * as React from "react";
import { Button } from "@/components/ui/button";

export const AboutCompanySection: React.FC = () => {
  return (
    <section id="about" className="container mx-auto px-4 py-12">
      <h2 className="text-2xl md:text-3xl font-semibold">О нашей компании</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-muted-foreground">
            Команда из 8 специалистов по поиску, закупке, логистике и юридическому сопровождению. Работаем напрямую с немецкими магазинами и производителями.
          </p>
          <div className="mt-6">
            <Button variant="outline" asChild>
              <a href="index.html#contacts">Связаться с нами</a>
            </Button>
          </div>
        </div>
        <div>
          {/* Фото команды: плейсхолдер */}
          <div className="flex h-48 items-center justify-center rounded-md border bg-muted">
            <span className="text-sm text-muted-foreground">Фото команды (placeholder)</span>
          </div>
        </div>
      </div>
    </section>
  );
};