import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { apiGet } from '@/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BikeCard from '@/components/catalog/BikeCard';
import { TrendingUp, Euro, ShieldCheck } from 'lucide-react';

interface BrandData {
  brand: string;
  stats: {
    totalBikes: number;
    avgPriceEu: number;
    minPrice: number;
    maxPrice: number;
  };
  topDeals: any[];
  bikes: any[];
  seo: {
    title: string;
    description: string;
  };
}

export default function BrandPage() {
  const { brandName } = useParams<{ brandName: string }>();
  const [data, setData] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrand = async () => {
      setLoading(true);
      try {
        const res = await apiGet(`/brands/${brandName}`);
        if (res && res.brand) {
          setData(res);
        } else {
          setError('Бренд не найден');
        }
      } catch (e) {
        setError('Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };

    if (brandName) fetchBrand();
  }, [brandName]);

  if (loading) return <div className="p-10 text-center">Загрузка бренда...</div>;
  if (error || !data) return <div className="p-10 text-center text-red-500">{error || 'Не найдено'}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Helmet>
        <title>{data.seo.title}</title>
        <meta name="description" content={data.seo.description} />
      </Helmet>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2 capitalize">{data.brand}</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Лучшие предложения {data.brand} с европейских площадок. Проверено AI, доставлено с гарантией.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <Euro className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground font-medium">Средняя цена в Европе</div>
              <div className="text-2xl font-bold text-blue-900">{data.stats.avgPriceEu}€</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50/50 border-green-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground font-medium">Доступно байков</div>
              <div className="text-2xl font-bold text-green-900">{data.stats.totalBikes}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50/50 border-purple-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-full text-purple-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground font-medium">Проверка качества</div>
              <div className="text-2xl font-bold text-purple-900">AI + Эксперт</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Deals */}
      {data.topDeals.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold">🔥 Топ выгодных предложений</h2>
            <Badge className="bg-red-100 text-red-600 hover:bg-red-100">Hot Deals</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.topDeals.map((bike) => (
              <BikeCard key={bike.id} bike={bike} />
            ))}
          </div>
        </div>
      )}

      {/* All Bikes Grid */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Все велосипеды {data.brand}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.bikes.map((bike) => (
            <BikeCard key={bike.id} bike={bike} />
          ))}
        </div>
      </div>
    </div>
  );
}
