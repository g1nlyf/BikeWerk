import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Check, MapPin, Truck, CreditCard, Phone, User, Bike, Heart, LogIn, Info, Search } from 'lucide-react';
import { useLeadSystem } from '../../context/LeadSystemContext';
import { api } from '../../lib/api-client';
import { ConciergeCheckout } from './ConciergeCheckout';

export const LeadCaptureModal: React.FC = () => {
    const { isModalOpen, activeProduct, closeLeadModal, mode } = useLeadSystem();
    const [step, setStep] = useState<'intro' | 'contact' | 'delivery' | 'success'>('intro');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Form State
    const [formData, setFormData] = useState({
        name: '',
        contact: '',
        address: '',
        city: '',
        paymentMethod: 'card', // card, cash
        deliveryMethod: 'courier', // courier, pickup
        serviceLevel: 'manager' // manager, fast
    });

    const [applicationId, setApplicationId] = useState<string | null>(null);
    const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
    const [orderNumber, setOrderNumber] = useState<string | null>(null);

    // Reset state on open
    useEffect(() => {
        if (isModalOpen) {
            setStep('intro');
            setError(null);
            setLoading(false);
            setApplicationId(null);
            setApplicationNumber(null);
            setOrderNumber(null);
        }
    }, [isModalOpen]);

    const handleStartOrder = () => {
        setStep('contact');
    };

    const handleAddToFavorites = () => {
        closeLeadModal();
    };

    const handleLogin = () => {
        window.location.href = '/login?return=' + encodeURIComponent(window.location.pathname);
    };

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.contact) {
            setError('Пожалуйста, заполните все поля');
            return;
        }
        
        setLoading(true);
        setError(null);

        try {
            // Send initial lead to CRM
            const res = await api.createLead({
                name: formData.name,
                contact_method: formData.contact.includes('@') ? 'email' : 'phone',
                contact_value: formData.contact,
                bike_interest: activeProduct?.name,
                notes: `Интересуется ${activeProduct?.name} (${activeProduct?.price} EUR)`
            });

            if (res.success) {
                setApplicationId(res.application_id);
                setApplicationNumber(res.application_number);
                setStep('delivery');
            } else {
                setError('Что-то пошло не так. Пожалуйста, попробуйте снова.');
            }
        } catch (err) {
            console.error(err);
            setError('Не удалось подключиться. Пожалуйста, попробуйте снова.');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Create full order
            const cartItem = {
                bike_id: activeProduct?.id,
                brand: activeProduct?.brand || 'Неизвестно',
                model: activeProduct?.model || activeProduct?.name,
                price: activeProduct?.price,
                quantity: 1,
                category: activeProduct?.category
            };

            const res = await api.checkout({
                cartItems: [cartItem],
                name: formData.name,
                phone: formData.contact, 
                email: formData.contact.includes('@') ? formData.contact : undefined,
                address: formData.address || 'Не указан (уточнить у менеджера)',
                city: formData.city || 'Не указан',
                payment_method: formData.paymentMethod,
                delivery_method: formData.deliveryMethod,
                needs_manager: formData.serviceLevel === 'manager'
            });

            if (res.success) {
                const id = String(res.application_id || res.order_id || "");
                const num = String(res.order_number || res.application_number || "");
                const track = String(res.tracking_url || res.magic_link_url || "");
                
                // Redirect to home
                window.location.href = '/';
            } else {
                setError('Не удалось оформить заказ. Пожалуйста, попробуйте снова.');
            }
        } catch (err) {
            console.error(err);
            setError('Ошибка при оформлении заказа. Пожалуйста, попробуйте снова.');
        } finally {
            setLoading(false);
        }
    };

    if (!isModalOpen) return null;

    if (mode === 'concierge' && activeProduct) {
        return (
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeLeadModal}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-2xl ring-1 ring-zinc-200"
                        >
                             <ConciergeCheckout product={activeProduct} onClose={closeLeadModal} />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeLeadModal}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-2xl ring-1 ring-zinc-200"
                    >
                        {/* Progress Bar */}
                        {step !== 'intro' && step !== 'success' && (
                            <div className="absolute top-0 left-0 h-1 bg-zinc-100 w-full">
                                <motion.div 
                                    className="h-full bg-zinc-900"
                                    initial={{ width: '0%' }}
                                    animate={{ 
                                        width: step === 'contact' ? '50%' : step === 'delivery' ? '80%' : '100%' 
                                    }}
                                />
                            </div>
                        )}

                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-zinc-100 rounded-lg text-zinc-900">
                                    <Bike size={20} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-zinc-900 text-sm line-clamp-1 max-w-[200px]">
                                        {activeProduct?.name || 'Ваш выбор'}
                                    </h3>
                                    <p className="text-xs text-zinc-500">
                                        {activeProduct?.price ? `€${activeProduct.price.toLocaleString()}` : 'Цена по запросу'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={closeLeadModal}
                                className="p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <AnimatePresence mode="wait">
                                {step === 'intro' && (
                                    <motion.div
                                        key="intro"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <div className="text-center">
                                            <h2 className="text-xl font-bold text-zinc-900 mb-2">
                                                Отличный выбор!
                                            </h2>
                                            <p className="text-sm text-zinc-500">
                                                Этот велосипед может стать вашим. Как вы хотите продолжить?
                                            </p>
                                        </div>

                                        <div className="grid gap-3">
                                            <button
                                                onClick={handleStartOrder}
                                                className="w-full py-4 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-xl flex items-center justify-between group transition-all"
                                            >
                                                <span className="flex items-center gap-3">
                                                    <CreditCard className="w-5 h-5" />
                                                    <span className="text-left">
                                                        <span className="block text-sm font-bold">Оформить заказ</span>
                                                        <span className="block text-xs opacity-80 font-normal">Без регистрации, за 1 минуту</span>
                                                    </span>
                                                </span>
                                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                            </button>

                                            <button
                                                onClick={handleLogin}
                                                className="w-full py-3 px-4 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-900 font-medium rounded-xl flex items-center justify-between transition-all"
                                            >
                                                <span className="flex items-center gap-3">
                                                    <LogIn className="w-5 h-5 text-zinc-500" />
                                                    <span className="text-left">
                                                        <span className="block text-sm">Войти в аккаунт</span>
                                                        <span className="block text-xs text-zinc-500 font-normal">Для истории заказов и бонусов</span>
                                                    </span>
                                                </span>
                                            </button>

                                            <button
                                                onClick={handleAddToFavorites}
                                                className="w-full py-3 px-4 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-900 font-medium rounded-xl flex items-center justify-between transition-all"
                                            >
                                                <span className="flex items-center gap-3">
                                                    <Heart className="w-5 h-5 text-zinc-500" />
                                                    <span className="text-left">
                                                        <span className="block text-sm">Добавить в избранное</span>
                                                        <span className="block text-xs text-zinc-500 font-normal">Подумаю и вернусь позже</span>
                                                    </span>
                                                </span>
                                            </button>
                                        </div>

                                        <div className="bg-zinc-50 rounded-xl p-4 flex gap-3 items-start">
                                            <Info className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                                            <p className="text-xs text-zinc-500 leading-relaxed">
                                                Мы работаем прозрачно: все велосипеды проверяются перед отправкой. Деньги замораживаются на безопасном счете до получения вами товара.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 'contact' && (
                                    <motion.form
                                        key="contact"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        onSubmit={handleContactSubmit}
                                        className="space-y-4"
                                    >
                                        <div className="text-center mb-6">
                                            <h2 className="text-xl font-bold text-zinc-900 mb-2">
                                                Давайте знакомиться
                                            </h2>
                                            <p className="text-sm text-zinc-500">
                                                Куда отправить детали заказа?
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="Ваше имя"
                                                    required
                                                    autoFocus
                                                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all"
                                                    value={formData.name}
                                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                                />
                                            </div>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="Телефон или Telegram (@username)"
                                                    required
                                                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all"
                                                    value={formData.contact}
                                                    onChange={e => setFormData({...formData, contact: e.target.value})}
                                                />
                                            </div>
                                        </div>

                                        {error && (
                                            <p className="text-red-500 text-sm text-center">{error}</p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                        >
                                            {loading ? 'Сохраняем...' : 'Продолжить'}
                                            {!loading && <ArrowRight size={18} />}
                                        </button>
                                    </motion.form>
                                )}

                                {step === 'delivery' && (
                                    <motion.form
                                        key="delivery"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        onSubmit={handleFinalSubmit}
                                        className="space-y-4"
                                    >
                                        <div className="text-center mb-4">
                                            <h2 className="text-xl font-bold text-zinc-900 mb-2">
                                                Детали заказа
                                            </h2>
                                            <p className="text-sm text-zinc-500">
                                                Как вам удобнее получить велосипед?
                                            </p>
                                        </div>

                                        {/* Service Level Selection */}
                                        <div className="grid gap-3 mb-4">
                                            <div 
                                                onClick={() => setFormData({...formData, serviceLevel: 'manager'})}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                                    formData.serviceLevel === 'manager' 
                                                    ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900' 
                                                    : 'border-zinc-200 hover:border-zinc-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium text-sm">Помощь менеджера</span>
                                                    {formData.serviceLevel === 'manager' && <Check size={16} className="text-zinc-900" />}
                                                </div>
                                                <p className="text-xs text-zinc-500">
                                                    Мы свяжемся, уточним детали у продавца, проверим байк и организуем доставку. Адрес можно не заполнять сейчас.
                                                </p>
                                            </div>
                                            
                                            <div 
                                                onClick={() => setFormData({...formData, serviceLevel: 'fast'})}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                                    formData.serviceLevel === 'fast' 
                                                    ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900' 
                                                    : 'border-zinc-200 hover:border-zinc-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium text-sm">Быстрый выкуп</span>
                                                    {formData.serviceLevel === 'fast' && <Check size={16} className="text-zinc-900" />}
                                                </div>
                                                <p className="text-xs text-zinc-500">
                                                    Я уверен в выборе, просто доставьте мне его. Потребуется заполнить адрес.
                                                </p>
                                            </div>
                                        </div>

                                        {formData.serviceLevel === 'fast' && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                className="space-y-3 overflow-hidden"
                                            >
                                                <input
                                                    type="text"
                                                    placeholder="Город"
                                                    required={formData.serviceLevel === 'fast'}
                                                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                                                    value={formData.city}
                                                    onChange={e => setFormData({...formData, city: e.target.value})}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Адрес доставки"
                                                    required={formData.serviceLevel === 'fast'}
                                                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                                                    value={formData.address}
                                                    onChange={e => setFormData({...formData, address: e.target.value})}
                                                />
                                            </motion.div>
                                        )}

                                        {error && (
                                            <p className="text-red-500 text-sm text-center">{error}</p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-green-600/20"
                                        >
                                            {loading ? 'Оформляем...' : 'Подтвердить заказ'}
                                            {!loading && <Check size={18} />}
                                        </button>
                                    </motion.form>
                                )}

                                {step === 'success' && (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="space-y-6"
                                    >
                                        <div className="text-center pt-2">
                                            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-zinc-50">
                                                <Check size={32} className="text-zinc-900" strokeWidth={3} />
                                            </div>
                                            <h2 className="text-xl font-bold text-zinc-900 mb-2">
                                                Заказ принят!
                                            </h2>
                                            <p className="text-sm text-zinc-500 max-w-[280px] mx-auto leading-relaxed">
                                                Спасибо, {formData.name}. Мы уже получили вашу заявку и свяжемся с вами в ближайшее время.
                                            </p>
                                        </div>

                                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 text-center relative overflow-hidden">
                                             <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '8px 8px' }}></div>
                                             <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium mb-1 relative z-10">Номер заказа</p>
                                             <p className="text-xl font-mono font-bold text-zinc-900 relative z-10">
                                                {orderNumber || applicationNumber || '...'}
                                             </p>
                                        </div>

                                        <div className="grid gap-3">
                                            {(orderNumber || applicationNumber) && (
                                                <a 
                                                    href={`/order-tracking/${orderNumber || applicationNumber}`}
                                                    className="w-full py-4 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-xl flex items-center justify-between group transition-all shadow-lg shadow-zinc-900/10"
                                                >
                                                    <span className="flex items-center gap-3">
                                                        <Search className="w-5 h-5" />
                                                        <span className="text-left">
                                                            <span className="block text-sm font-bold">Отследить статус</span>
                                                            <span className="block text-xs opacity-80 font-normal">Узнайте, где ваш велосипед</span>
                                                        </span>
                                                    </span>
                                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                                </a>
                                            )}
                                            
                                            <button
                                                onClick={closeLeadModal}
                                                className="w-full py-3 px-4 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-900 font-medium rounded-xl flex items-center justify-center transition-all"
                                            >
                                                Вернуться в магазин
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
