import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function DreamBikeSection() {
  return (
    <section id="dream-bike" className="container mx-auto px-4 py-12">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Байк мечты? Начните с каталога!
          </CardTitle>
          <CardDescription className="text-base md:text-lg">
            Подбор по брендам, категориям и бюджету. Официальные магазины и проверенные площадки ЕС.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <a href="/catalog">Открыть каталог</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#how-it-works">Как мы работаем</a>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}