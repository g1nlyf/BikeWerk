import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/input"; // Assuming Label exists or use standard label
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Target, Search, CheckCircle } from 'lucide-react';
import { apiPost } from '@/api'; // Assuming api wrapper exists

export function SniperBountyForm() {
  const [formData, setFormData] = useState({
    category: '',
    brand: '',
    max_price: '',
    min_grade: 'B',
    size: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Mock API call - in real app this goes to /api/bounties
      // await apiPost('/bounties', formData);
      await new Promise(r => setTimeout(r, 1000)); // Sim delay
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="w-full max-w-md mx-auto border-2 border-green-500 bg-green-50/50">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-green-800">Заказ принят Снайпером!</h3>
          <p className="text-muted-foreground">
            Охотник начал поиск <strong>{formData.brand} {formData.category}</strong>.
            <br/>Вы получите уведомление, как только мы найдем идеальный вариант.
          </p>
          <Button variant="outline" onClick={() => setSubmitted(false)}>Создать еще один</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto border-2 border-primary/20 shadow-lg">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Target className="h-6 w-6 text-primary" />
          Заказать Снайперу
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Не нашли то, что искали? Поручите поиск нашему ИИ-охотнику.
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Категория</label>
            <Select onValueChange={(v) => setFormData({...formData, category: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Road">Шоссейный</SelectItem>
                <SelectItem value="MTB">Горный (MTB)</SelectItem>
                <SelectItem value="Gravel">Гравийный</SelectItem>
                <SelectItem value="E-Bike">Электровелосипед</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Бренд (опц.)</label>
              <Input 
                placeholder="Canyon, Trek..." 
                value={formData.brand}
                onChange={e => setFormData({...formData, brand: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Размер</label>
              <Input 
                placeholder="M, L, 56..." 
                value={formData.size}
                onChange={e => setFormData({...formData, size: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Бюджет до (€)</label>
              <Input 
                type="number" 
                placeholder="2500" 
                value={formData.max_price}
                onChange={e => setFormData({...formData, max_price: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Состояние</label>
              <Select defaultValue="B" onValueChange={(v) => setFormData({...formData, min_grade: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Только Grade A (Идеал)</SelectItem>
                  <SelectItem value="B">Grade B и выше</SelectItem>
                  <SelectItem value="C">Любое (под ремонт)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full gap-2 font-bold" disabled={loading}>
            {loading ? 'Отправка...' : <><Search className="h-4 w-4" /> Запустить Охоту</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
