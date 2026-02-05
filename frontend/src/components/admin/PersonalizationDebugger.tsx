import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { apiGet } from '@/api';
import { BikeCard } from '@/components/catalog/BikeCard';
import { tracker } from '@/lib/analytics';
import type { UserInterestProfile } from '@/lib/analytics';
import { RefreshCw, Database, TrendingUp } from 'lucide-react';
import { calculateMarketingBreakdown } from "@/lib/pricing";
import { Badge } from '@/components/ui/badge';

const num = (obj: Record<string, unknown>, key: string) => {
    const v = obj[key];
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
};
const str = (obj: Record<string, unknown>, key: string) => String(obj[key] ?? '');

const mapBike = (b: Record<string, unknown>): any => ({
    id: str(b, 'id'),
    name: str(b, 'name'),
    brand: str(b, 'brand'),
    model: str(b, 'model') || str(b, 'name'),
    year: num(b, 'year'),
    type: str(b, 'category') || 'other',
    status: Boolean(b['is_new']) ? 'new' : 'available',
    priceEU: Math.round(num(b, 'price')),
    priceWithDelivery: Math.round(calculateMarketingBreakdown(num(b, 'price')).totalEur),
    priceRUB: Math.round(calculateMarketingBreakdown(num(b, 'price')).totalRub),
    savings: Math.max(0, num(b, 'original_price') - num(b, 'price')),
    image: ((): string => {
      const main = b['main_image'];
      if (typeof main === 'string' && main) return main;
      const imgs = b['images'];
      if (Array.isArray(imgs)) {
        const first = imgs[0] as unknown;
        if (typeof first === 'string') return first;
      }
      return '';
    })(),
    description: str(b, 'description'),
    tags: [],
    ranking_score: num(b, 'ranking_score')
});

export function PersonalizationDebugger() {
  const [profile, setProfile] = React.useState<UserInterestProfile | null>(null);
  const [recommendedBikes, setRecommendedBikes] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
        // 1. Load Profile from Storage (simulating "My" profile)
        const stored = localStorage.getItem('eubike_user_dna');
        const p = stored ? JSON.parse(stored) : tracker.getProfile();
        setProfile(p);

        // 2. Fetch Recommendations based on this profile
        const params = new URLSearchParams();
        params.set('limit', '4'); // Small preview
        
        if (p.disciplines) {
            const topDisciplines = Object.entries(p.disciplines)
                .sort(([, a], [, b]) => Number(b) - Number(a))
                .slice(0, 3)
                .map(([d]) => d);
            if (topDisciplines.length) params.set('profile_disciplines', topDisciplines.join(','));
        }
        if (p.brands) {
            const topBrands = Object.entries(p.brands)
                .sort(([, a], [, b]) => Number(b) - Number(a))
                .slice(0, 3)
                .map(([b]) => b);
            if (topBrands.length) params.set('profile_brands', topBrands.join(','));
        }
        
        // Use /bikes endpoint instead of /catalog/bikes
      const data = await apiGet(`/bikes?${params.toString()}`);
        if (data && Array.isArray(data.bikes)) {
            setRecommendedBikes(data.bikes.map((b: any) => mapBike(b)));
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (!profile) return null;

  const maxWeight = Math.max(
    ...Object.values(profile.disciplines), 
    ...Object.values(profile.brands), 
    1
  );

  return (
    <Card className="w-full border-2 border-blue-100 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50">
        <CardTitle className="text-xl flex items-center gap-2 text-blue-700">
            <TrendingUp className="w-6 h-6" />
            Модуль Персонализации: Мой Профиль
        </CardTitle>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
        </Button>
      </CardHeader>
      <CardContent className="space-y-8 pt-6">
        
        <div className="grid md:grid-cols-3 gap-8">
            {/* Disciplines */}
            <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2 border-b pb-2">
                    <Database className="w-4 h-4" /> Топ категорий
                </h4>
                {Object.entries(profile.disciplines).length === 0 && <div className="text-sm text-gray-400 italic">Нет данных активности</div>}
                {Object.entries(profile.disciplines)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([key, val]) => (
                    <div key={key} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                            <span>{key}</span>
                            <span className="text-muted-foreground">{val.toFixed(1)}</span>
                        </div>
                        <Progress value={(val / maxWeight) * 100} className="h-2" />
                    </div>
                ))}
            </div>

            {/* Brands */}
            <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2 border-b pb-2">
                    <Database className="w-4 h-4" /> Топ брендов
                </h4>
                {Object.entries(profile.brands).length === 0 && <div className="text-sm text-gray-400 italic">Нет данных активности</div>}
                {Object.entries(profile.brands)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([key, val]) => (
                    <div key={key} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                            <span>{key}</span>
                            <span className="text-muted-foreground">{val.toFixed(1)}</span>
                        </div>
                        <Progress value={(val / maxWeight) * 100} className="h-2 bg-secondary" />
                    </div>
                ))}
            </div>

            {/* Price Sensitivity */}
            <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2 border-b pb-2">
                    <Database className="w-4 h-4" /> Ценовой профиль
                </h4>
                <div className="flex flex-col items-center justify-center h-[120px] bg-secondary/10 rounded-lg border border-dashed border-secondary">
                    <div className="text-3xl font-bold text-primary">
                        {profile.priceSensitivity.count > 0 
                            ? `~${Math.round(profile.priceSensitivity.weightedAverage).toLocaleString()} €`
                            : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                        Средний чек интереса
                    </div>
                    <Badge variant="outline" className="mt-2 text-[10px]">
                        {profile.priceSensitivity.count} сигналов
                    </Badge>
                </div>
            </div>
        </div>

        {/* Recommendations Preview */}
        <div className="pt-2">
            <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <span>Превью рекомендаций</span>
                <Badge variant="secondary" className="text-xs font-normal">Based on your behavior</Badge>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recommendedBikes.length === 0 && (
                    <div className="col-span-4 text-center text-muted-foreground py-12 bg-muted/20 rounded-lg">
                        Нет рекомендаций. Попробуйте просмотреть несколько велосипедов.
                    </div>
                )}
                {recommendedBikes.map(bike => (
                    <BikeCard key={bike.id} bike={bike} variant="compact" />
                ))}
            </div>
        </div>

      </CardContent>
    </Card>
  );
}
