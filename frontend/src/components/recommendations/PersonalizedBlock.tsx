import React, { useEffect, useState } from 'react';
import { apiPost } from '@/api';
import { tracker } from '@/lib/analytics';
import { BikeCard, type BikeData } from '@/components/catalog/BikeCard';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Sparkles } from 'lucide-react';

export const PersonalizedBlock: React.FC<{ className?: string }> = ({ className }) => {
  const [bikes, setBikes] = useState<BikeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecs = async () => {
      try {
        const profile = tracker.getProfile();
        // Only fetch if user has some activity
        if (Object.keys(profile.disciplines).length === 0 && Object.keys(profile.brands).length === 0) {
            // Fallback to generic recommendations if profile is empty? 
            // Actually the backend handles empty profile by returning top ranked items.
        }
        
        const res = await apiPost('/recommendations/personalized', { profile });
        if (res.success && Array.isArray(res.bikes)) {
          setBikes(res.bikes);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchRecs();
  }, []);

  if (loading || bikes.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-primary/10 rounded-full">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Подобрали для вас</h2>
      </div>
      
      <Carousel className="w-full">
        <CarouselContent className="-ml-4">
          {bikes.map((bike) => (
            <CarouselItem key={bike.id} className="pl-4 basis-[85%] md:basis-1/2 lg:basis-1/4">
              <BikeCard bike={bike} variant="compact" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
    </div>
  );
};
