import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Search, CheckCircle, ShieldCheck, MapPin, Package, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Product {
    id: number;
    name: string;
    price: number;
    image: string;
    brand?: string;
    model?: string;
    category?: string;
}

interface ConciergeCheckoutProps {
    product: Product;
    onClose: () => void;
}

export const ConciergeCheckout: React.FC<ConciergeCheckoutProps> = ({ product, onClose }) => {
    const [step, setStep] = useState<'offer' | 'contact' | 'success'>('offer');
    const [loading, setLoading] = useState(false);

    const handleStart = () => {
        setStep('contact');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            setStep('success');
        }, 1500);
    };

    if (step === 'success') {
        return (
            <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Охотник принял заявку!</h3>
                <p className="text-muted-foreground mb-6">Мы свяжемся с продавцом и сообщим вам результат в течение 2 часов.</p>
                <Button onClick={() => window.location.href = '/'} className="w-full">Отлично</Button>
            </div>
        );
    }

    if (step === 'contact') {
        return (
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Ваш контакт</h3>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Как к вам обращаться?</label>
                        <input required className="w-full p-3 rounded-xl border bg-slate-50" placeholder="Иван" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Телефон или Telegram</label>
                        <input required className="w-full p-3 rounded-xl border bg-slate-50" placeholder="@username или +7..." />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full h-12 text-lg bg-amber-500 hover:bg-amber-600 text-white">
                        {loading ? 'Отправка...' : 'Начать переговоры (0 ₽)'}
                    </Button>
                </form>
            </div>
        );
    }

    return (
        <div className="p-0">
             <div className="relative h-48 bg-slate-900 overflow-hidden">
                <img src={product.image} className="w-full h-full object-cover opacity-60" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">PICKUP ONLY</span>
                        <span className="text-amber-300 text-xs font-medium">Сложный выкуп</span>
                    </div>
                    <h3 className="font-bold text-lg leading-tight">{product.name}</h3>
                    <p className="text-slate-300 text-sm">{product.price} €</p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-2 right-2 text-white hover:bg-white/20"><X className="w-5 h-5" /></Button>
             </div>

             <div className="p-5 space-y-4">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                        <Search className="w-4 h-4" /> Снайпер на связи
                    </h4>
                    <p className="text-sm text-amber-800 mb-3">
                        Этот лот доступен только самовывозом в Германии. Наш агент лично выедет к продавцу.
                    </p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-amber-900/80">
                            <UserCheck className="w-4 h-4 text-amber-600" /> Личный осмотр механиком
                        </div>
                        <div className="flex items-center gap-2 text-sm text-amber-900/80">
                            <Package className="w-4 h-4 text-amber-600" /> Профессиональная упаковка
                        </div>
                        <div className="flex items-center gap-2 text-sm text-amber-900/80">
                            <ShieldCheck className="w-4 h-4 text-amber-600" /> Гарантия сделки
                        </div>
                    </div>
                </div>

                <div className="border rounded-xl p-4 bg-slate-50">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-500">Тариф доставки</span>
                        <span className="text-sm font-bold text-slate-900">Priority Cargo</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">Стандартная доставка недоступна</span>
                        <span className="font-bold text-slate-900">600 €</span>
                    </div>
                </div>

                <Button onClick={handleStart} className="w-full h-12 text-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/20">
                    Начать переговоры за 0 ₽
                </Button>
                <p className="text-center text-xs text-slate-400">Оплата только после подтверждения выкупа</p>
             </div>
        </div>
    );
};
