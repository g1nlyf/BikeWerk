import { Link } from 'react-router-dom';
import { BikeflipHeaderPX } from '@/components/layout/BikeflipHeaderPX';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, FileCheck, HeadphonesIcon, TruckIcon, ArrowRight, AlertTriangle, X, Lock } from 'lucide-react';

export default function GuaranteesPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <BikeflipHeaderPX />

            <main className="flex-1">
                {/* Hero Section */}
                <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 md:py-24">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                            Гарантии и безопасность
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground">
                            Полная защита на каждом этапе — от выбора до получения велосипеда
                        </p>
                    </div>
                </section>

                {/* Main Guarantees */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-10">Наши гарантии</h2>
                        <div className="grid gap-6">
                            {[
                                {
                                    icon: Shield,
                                    title: 'Проверенное качество',
                                    description: 'Каждый велосипед проходит тщательную техническую проверку нашими экспертами в Европе. Мы предоставляем детальный отчет с фото и видео о состоянии байка.'
                                },
                                {
                                    icon: Lock,
                                    title: 'Безопасная оплата',
                                    description: 'Оплата принимается только через защищенные каналы. Ваши деньги в безопасности, а финальная цена фиксирована — никаких скрытых доплат.'
                                },
                                {
                                    icon: FileCheck,
                                    title: 'Полный пакет документов',
                                    description: 'Оформляем все необходимые документы для таможни и владения. Вы получаете велосипед с полным юридическим сопровождением.'
                                },
                                {
                                    icon: TruckIcon,
                                    title: 'Застрахованная доставка',
                                    description: 'Весь груз застрахован на всех этапах доставки. В случае повреждения — полная компенсация или замена.'
                                },
                                {
                                    icon: HeadphonesIcon,
                                    title: 'Поддержка 24/7',
                                    description: 'Личный менеджер всегда на связи. Отвечаем на вопросы и решаем любые проблемы оперативно.'
                                },
                                {
                                    icon: CheckCircle,
                                    title: 'Гарантия возврата',
                                    description: 'Если велосипед не соответствует описанию или техническим характеристикам — полный возврат средств без вопросов.'
                                }
                            ].map((guarantee, idx) => {
                                const Icon = guarantee.icon;
                                return (
                                    <div key={idx} className="p-6 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <Icon className="w-6 h-6 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-xl font-bold mb-2">{guarantee.title}</h3>
                                                <p className="text-muted-foreground leading-relaxed">{guarantee.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Payment Security */}
                <section className="py-12 md:py-16 bg-muted/30">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Безопасность оплаты</h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="p-6 rounded-lg border bg-card">
                                <h3 className="font-semibold text-lg mb-3">Фиксированная цена</h3>
                                <p className="text-muted-foreground">
                                    Цена, которую вы видите на сайте — финальная. Никаких скрытых платежей, доплат за таможню или комиссий.
                                </p>
                            </div>
                            <div className="p-6 rounded-lg border bg-card">
                                <h3 className="font-semibold text-lg mb-3">Защищенные платежи</h3>
                                <p className="text-muted-foreground">
                                    Принимаем оплату только через проверенные и безопасные платежные системы с полной защитой покупателей.
                                </p>
                            </div>
                            <div className="p-6 rounded-lg border bg-card">
                                <h3 className="font-semibold text-lg mb-3">Возможна рассрочка</h3>
                                <p className="text-muted-foreground">
                                    Оформляем покупку в рассрочку для вашего удобства. Без переплат и скрытых процентов.
                                </p>
                            </div>
                            <div className="p-6 rounded-lg border bg-card">
                                <h3 className="font-semibold text-lg mb-3">Юридическая прозрачность</h3>
                                <p className="text-muted-foreground">
                                    Официальный договор, чек об оплате, полная отчетность. Работаем абсолютно легально.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Quality Control */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Процесс проверки качества</h2>
                        <div className="space-y-6">
                            {[
                                {
                                    step: '1',
                                    title: 'Предварительный осмотр',
                                    description: 'Запрашиваем у продавца детальные фото и видео, проверяем историю велосипеда и техническое состояние.'
                                },
                                {
                                    step: '2',
                                    title: 'Экспертная оценка',
                                    description: 'Наши механики в Европе проводят полную техническую диагностику: проверка рамы, трансмиссии, тормозов, амортизаторов.'
                                },
                                {
                                    step: '3',
                                    title: 'Финальная проверка',
                                    description: 'Перед отправкой делаем контрольный осмотр, чистку и регулировку всех узлов.'
                                },
                                {
                                    step: '4',
                                    title: 'Документация',
                                    description: 'Предоставляем вам полный фото и видео отчет о состоянии велосипеда на всех этапах.'
                                }
                            ].map((item, idx) => (
                                <div key={idx} className="flex gap-4 p-4 rounded-lg border bg-card">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                        {item.step}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-2">{item.title}</h3>
                                        <p className="text-muted-foreground text-sm">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Manufacturer Warranty */}
                <section className="py-12 md:py-16 bg-muted/30">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Официальная гарантия производителя</h2>
                        <div className="p-6 rounded-lg border bg-card">
                            <p className="mb-4">
                                На большинство велосипедов действует официальная гарантия производителя, которая сохраняется при покупке через нас.
                            </p>
                            <ul className="space-y-2">
                                {[
                                    'Гарантия на раму и вилку от производителя',
                                    'Техническая поддержка официальных сервисных центров',
                                    'Все необходимые документы для гарантийного обслуживания',
                                    'Помощь в решении гарантийных вопросов'
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-center gap-2">
                                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Частые вопросы о гарантиях</h2>
                        <div className="space-y-6">
                            {[
                                {
                                    q: 'Что делать, если велосипед придет поврежденным?',
                                    a: 'Весь груз застрахован. Если при доставке обнаружены повреждения — полная компенсация или замена за наш счет.'
                                },
                                {
                                    q: 'Можно ли вернуть велосипед?',
                                    a: 'Да, можно. Если велосипед не соответствует описанию или техническим характеристикам — мы примем возврат и вернем деньги в полном объеме.'
                                },
                                {
                                    q: 'Действует ли гарантия производителя в России?',
                                    a: 'Да, официальная гарантия производителя действует международно. Мы предоставляем все необходимые документы для гарантийного обслуживания.'
                                },
                                {
                                    q: 'Как узнать, что велосипед проверен?',
                                    a: 'Вы получаете детальный фото и видео отчет от нашего эксперта с описанием технического состояния каждого узла.'
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
                            Покупайте с уверенностью
                        </h2>
                        <p className="text-xl text-muted-foreground mb-8">
                            Каждый заказ защищен полным пакетом гарантий
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
                                    Заказать подбор
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
