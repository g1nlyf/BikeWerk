import { Link } from 'react-router-dom';
import { BikeflipHeaderPX } from '@/components/layout/BikeflipHeaderPX';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Truck, Package, MapPin, Clock, Shield, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react';

export default function DeliveryPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <BikeflipHeaderPX />

            <main className="flex-1">
                {/* Hero Section */}
                <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 md:py-24">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                            Доставка
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground mb-6">
                            Прозрачная логистика, полный контроль
                        </p>
                        <p className="text-lg text-muted-foreground">
                            Весь процесс отслеживается в реальном времени. Груз застрахован на каждом этапе.
                        </p>
                    </div>
                </section>

                {/* Route Visual */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-10">Маршрут доставки</h2>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-6 rounded-xl bg-card border">
                            {[
                                { label: 'Продавец (Германия)', icon: MapPin },
                                { label: 'Склад BikeWerk', icon: Package },
                                { label: 'Переупаковка', icon: Package },
                                { label: 'Отправка в РФ', icon: Truck },
                                { label: 'Ваш город', icon: MapPin }
                            ].map((step, idx) => {
                                const Icon = step.icon;
                                return (
                                    <div key={idx} className="flex items-center gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Icon className="w-6 h-6 text-primary" />
                                            </div>
                                            <span className="text-sm text-center mt-2">{step.label}</span>
                                        </div>
                                        {idx < 4 && (
                                            <div className="hidden md:block w-8 h-0.5 bg-border" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Detailed Timeline */}
                <section className="py-12 md:py-16 bg-muted/30">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Детальный тайминг</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                { label: 'Продавец → склад', time: '3-7 дней' },
                                { label: 'Экспертная проверка (опция)', time: '2-5 дней' },
                                { label: 'Упаковка + отправка', time: '2-3 дня' },
                                { label: 'Доставка в РФ', time: '2-4 недели' },
                                { label: 'ИТОГО под ключ', time: '3-5 недель', highlight: true }
                            ].map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-lg border ${item.highlight ? 'bg-primary/10 border-primary font-semibold' : 'bg-card'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span>{item.label}</span>
                                        <span className="text-primary">{item.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Delivery Methods */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Способы доставки</h2>
                        <div className="grid md:grid-cols-3 gap-6">
                            {[
                                {
                                    title: 'EMS',
                                    features: ['До двери', 'Трек-номер', 'Страховка до 400-500€'],
                                    recommended: 'Для большинства байков'
                                },
                                {
                                    title: 'Сборный груз',
                                    features: ['До ПВЗ', 'Дешевле EMS', 'Страховка до 400-500€'],
                                    recommended: 'Эконом вариант'
                                },
                                {
                                    title: 'Автотранспорт',
                                    features: ['Страховка по полной стоимости', '8% от цены байка', 'Для дорогих велосипедов'],
                                    recommended: 'Для байков >1000€',
                                    highlight: true
                                }
                            ].map((method, idx) => (
                                <div
                                    key={idx}
                                    className={`p-6 rounded-xl border ${method.highlight ? 'border-primary bg-primary/5' : 'bg-card'}`}
                                >
                                    <h3 className="text-xl font-bold mb-3">{method.title}</h3>
                                    <ul className="space-y-2 mb-4">
                                        {method.features.map((feature, fidx) => (
                                            <li key={fidx} className="flex items-center gap-2 text-sm">
                                                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="text-sm text-muted-foreground italic">{method.recommended}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Insurance Reality */}
                <section className="py-12 md:py-16 bg-amber-50 dark:bg-amber-950/10">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <div className="flex items-start gap-4">
                            <AlertTriangle className="h-8 w-8 text-amber-500 flex-shrink-0 mt-1" />
                            <div>
                                <h2 className="text-2xl font-bold mb-4">⚠️ Важно про страховку</h2>
                                <div className="space-y-3 text-muted-foreground">
                                    <p><strong>Почтовый лимит:</strong> Для прохождения таможни и почтовых лимитов байки декларируются на сумму 400-500€.</p>
                                    <p>Это значит: <strong>максимальная страховая компенсация от почты = 400-500€</strong>.</p>
                                    <p><strong>Для байков дороже 1000€</strong> рекомендуем автотранспорт:</p>
                                    <ul className="list-disc list-inside space-y-1 ml-4">
                                        <li>Страховка по полной стоимости байка</li>
                                        <li>Стоимость: 8% от цены велосипеда</li>
                                        <li>Полная защита при повреждении или утере</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Tracking */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Отслеживание посылки</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                { icon: Package, title: 'Личный кабинет', desc: 'Статус в реальном времени на сайте' },
                                { icon: CheckCircle, title: 'Telegram уведомления', desc: 'Моментальные оповещения о ключевых этапах' },
                                { icon: Shield, title: 'Email-рассылка', desc: 'Подробные отчеты о продвижении заказа' },
                                { icon: Truck, title: 'Трек-номер', desc: 'Отслеживание на сайте перевозчика' }
                            ].map((item, idx) => {
                                const Icon = item.icon;
                                return (
                                    <div key={idx} className="flex items-start gap-4 p-4 rounded-lg border bg-card">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold mb-1">{item.title}</h3>
                                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Customs */}
                <section className="py-12 md:py-16 bg-muted/30">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Таможня</h2>
                        <div className="p-6 rounded-xl border bg-card">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">BikeWerk полностью берёт на себя таможенное оформление</p>
                                        <p className="text-sm text-muted-foreground mt-1">Вам не нужно ничего делать — всё включено в стоимость</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Все пошлины и сборы уже учтены в цене</p>
                                        <p className="text-sm text-muted-foreground mt-1">Доплат не будет — финальная цена на сайте</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Декларация как личная посылка</p>
                                        <p className="text-sm text-muted-foreground mt-1">Минимум бюрократии, максимум скорости</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Частые вопросы</h2>
                        <div className="space-y-6">
                            {[
                                {
                                    q: 'Можно ли ускорить доставку?',
                                    a: 'Сроки зависят от продавца (отправка на склад) и таможни РФ. Express-доставка не предусмотрена, но мы всегда стараемся минимизировать время.'
                                },
                                {
                                    q: 'Что включено в стоимость доставки?',
                                    a: 'Всё: упаковка, страховка, доставка до вашего города, таможенные сборы. Никаких скрытых доплат.'
                                },
                                {
                                    q: 'Можно забрать байк самовывозом?',
                                    a: 'Да, после прохождения таможни можно забрать со склада в вашем городе.'
                                },
                                {
                                    q: 'Что делать, если упаковка повреждена?',
                                    a: 'Сфотографировать при курьере, сообщить нам — компенсируем сразу, не дожидаясь страховой.'
                                },
                                {
                                    q: 'Почему страховка только 400-500€?',
                                    a: 'Почтовые лимиты РФ. Для байков >1000€ используйте автотранспорт (8%) с полной страховкой.'
                                }
                            ].map((faq, idx) => (
                                <div key={idx} className="p-6 rounded-lg border bg-card">
                                    <h3 className="font-semibold text-lg mb-3">{faq.q}</h3>
                                    <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 to-background">
                    <div className="container mx-auto px-4 max-w-4xl text-center">
                        <h2 className="text-3xl md:text-4xl font-bold mb-6">
                            Начните заказ
                        </h2>
                        <p className="text-xl text-muted-foreground mb-8">
                            Прозрачная логистика от двери до двери
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button asChild size="lg" className="text-lg px-8 py-6">
                                <Link to="/catalog">
                                    Перейти в каталог
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
                                <Link to="/sniper">
                                    Подобрать велосипед
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
