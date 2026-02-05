import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { MapPin, PackageCheck } from "lucide-react";
import { apiGet, resolveImageUrl } from "@/api";

type Delivery = {
  id: number;
  bike_id?: number | null;
  model: string;
  city: string;
  price: number;
  priceBreakdown: string;
  status: string;
  image?: string | null;
};

export const RecentDeliveriesSection: React.FC = () => {
  const [items, setItems] = React.useState<Delivery[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const resp = await apiGet('/recent-deliveries');
        const list: Delivery[] = Array.isArray(resp?.deliveries) ? resp.deliveries : [];
        if (!cancelled) setItems(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const bikes = items;

  return (
    <section className="container mx-auto px-4 py-16">
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-12 text-center">Последние доставки</h2>
      <div className="relative">
        <Carousel className="w-full" opts={{ align: "start", loop: true }}>
          <CarouselContent className="-ml-4">
            {(bikes.length ? bikes : []).map((b, i) => (
              <CarouselItem key={b.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <Card className="h-full border-border/50 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden rounded-2xl">
                  <div className={`relative aspect-[4/3] overflow-hidden bg-muted/20`}>
                    {b.image && (
                      <img src={resolveImageUrl(b.image) || ''} alt={b.model} className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                    <div className="absolute top-4 right-4 z-20">
                      <Badge 
                        variant={b.status === "Доставлен" ? "default" : "secondary"}
                        className={`text-sm px-3 py-1 shadow-sm backdrop-blur-md ${
                          b.status === "Доставлен" 
                            ? "bg-green-500/90 hover:bg-green-500 text-white border-none" 
                            : "bg-amber-500/90 hover:bg-amber-500 text-white border-none"
                        }`}
                      >
                        {b.status}
                      </Badge>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent text-white pt-12">
                      <div className="flex items-center gap-2 text-sm font-medium mb-1 opacity-90">
                        <MapPin className="w-4 h-4" />
                        {b.city}
                      </div>
                      <h3 className="text-xl font-bold leading-tight">{b.model}</h3>
                    </div>
                  </div>
                  
                  <CardContent className="p-5 bg-card">
                    <div className="flex items-start gap-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/50">
                      <PackageCheck className="w-5 h-5 shrink-0 text-primary mt-0.5" />
                      <div>
                        <span className="block font-medium text-foreground mb-1">Расчет стоимости:</span>
                        {b.priceBreakdown}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-12 h-12 w-12 border-2" />
          <CarouselNext className="hidden md:flex -right-12 h-12 w-12 border-2" />
        </Carousel>
      </div>
    </section>
  );
};
