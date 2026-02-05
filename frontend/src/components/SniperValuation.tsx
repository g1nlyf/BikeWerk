import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crosshair, ArrowRight, CheckCircle2 } from 'lucide-react';
import { apiPost } from '@/api';
import { motion, AnimatePresence } from 'framer-motion';

interface ValuationResult {
    fmv: number;
    finalPrice: number;
    confidence: string;
    sampleSize: number;
    min: number;
    max: number;
}

interface UpsellBike {
    id: number;
    title: string;
    price: number;
    image_url: string;
    year: number;
    benefit: number;
}

export const SniperValuation = () => {
    const [formData, setFormData] = useState({
        brand: '',
        model: '',
        year: ''
    });
    const [result, setResult] = useState<ValuationResult | null>(null);
    const [upsell, setUpsell] = useState<UpsellBike[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationError, setValidationError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.id]: e.target.value
        });
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError('');
        
        if (!formData.brand || !formData.model) {
            setValidationError('Бренд и модель обязательны');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);
        try {
            const res = await apiPost('/valuation/calculate', formData);
            if (res.success) {
                setResult(res.valuation);
                setUpsell(res.upsell || []);
            } else {
                setError(res.message || 'Не удалось оценить байк. Проверьте данные или попробуйте позже.');
            }
        } catch (e) {
            setError('Ошибка соединения с сервером.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden relative">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 p-32 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

            <CardHeader className="relative z-10">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Crosshair className="w-5 h-5 animate-[spin_3s_linear_infinite]" />
                    <span className="text-xs font-bold uppercase tracking-widest">Sniper Valuation Tool</span>
                </div>
                <CardTitle className="text-2xl font-bold">Узнать рыночную цену</CardTitle>
                <CardDescription className="text-slate-400">
                    Наш AI проанализировал 12,000+ сделок. Узнайте честную цену за 2 секунды.
                </CardDescription>
            </CardHeader>

            <CardContent className="relative z-10">
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="brand" className="text-slate-300">Бренд</Label>
                            <Input 
                                id="brand" 
                                value={formData.brand}
                                onChange={handleChange}
                                placeholder="Canyon" 
                                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="model" className="text-slate-300">Модель</Label>
                            <Input 
                                id="model" 
                                value={formData.model}
                                onChange={handleChange}
                                placeholder="Aeroad CF SLX" 
                                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="year" className="text-slate-300">Год (опц.)</Label>
                            <Input 
                                id="year" 
                                type="number"
                                value={formData.year}
                                onChange={handleChange}
                                placeholder="2022" 
                                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button 
                                type="submit" 
                                disabled={loading}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all shadow-lg shadow-emerald-500/20"
                            >
                                {loading ? 'Скан...' : 'Оценить'}
                            </Button>
                        </div>
                    </div>
                    {validationError && <div className="text-xs text-rose-400">{validationError}</div>}
                </form>

                {error && (
                    <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-sm">
                        {error}
                    </div>
                )}

                <AnimatePresence>
                    {result && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="mt-8 space-y-6"
                        >
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent pointer-events-none" />
                                <div className="relative z-10 text-center">
                                    <div className="text-sm text-slate-400 mb-1">Средняя рыночная цена (FMV)</div>
                                    <div className="text-4xl font-black text-emerald-400 tracking-tight">
                                        {result.finalPrice.toLocaleString()} €
                                    </div>
                                    <div className="text-xs text-slate-500 mt-2">
                                        Диапазон: {result.min} - {result.max} € • Точность: {result.confidence === 'high' ? 'Высокая' : 'Средняя'} ({result.sampleSize} лотов)
                                    </div>
                                </div>
                            </div>

                            {upsell.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                                        <CheckCircle2 className="w-4 h-4" />
                                        А Снайпер нашел эти варианты дешевле:
                                    </div>
                                    <div className="grid gap-3">
                                        {upsell.map(bike => (
                                            <a key={bike.id} href={`/bike/${bike.id}`} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 transition-all group">
                                                <img 
                                                    src={bike.image_url || '/placeholder.jpg'} 
                                                    alt={bike.title} 
                                                    className="w-12 h-12 rounded-lg object-cover bg-slate-800"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-white truncate group-hover:text-emerald-300 transition-colors">{bike.title}</div>
                                                    <div className="text-xs text-slate-400">{bike.year}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-emerald-400">{bike.price} €</div>
                                                    <div className="text-[10px] text-emerald-500/70">Выгода {bike.benefit}€</div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                                            </a>
                                        ))}
                                    </div>
                                    <Button variant="ghost" className="w-full text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-xs">
                                        Смотреть все подходящие предложения
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
};
