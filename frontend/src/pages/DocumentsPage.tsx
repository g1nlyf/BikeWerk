import { Link } from 'react-router-dom';
import { BikeflipHeaderPX } from '@/components/layout/BikeflipHeaderPX';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, Shield, Package, Stamp, ArrowRight } from 'lucide-react';

export default function DocumentsPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <BikeflipHeaderPX />

            <main className="flex-1">
                {/* Hero Section */}
                <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 md:py-24">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                            Документы и таможня
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground">
                            Полный пакет документов и легальное оформление
                        </p>
                    </div>
                </section>

                {/* Quick Summary */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Коротко о сути</h2>
                        <div className="grid gap-4">
                            {[
                                'Оформляем все документы для легального ввоза велосипеда в Россию',
                                'Берем на себя таможенное оформление и декларирование',
                                'Предоставляем полный пакет документов для регистрации и гарантии',
                                'Все пошлины уже включены в стоимость — никаких сюрпризов',
                                'Юридическая чистота сделки — можете спокойно продать байк в будущем',
                                'Помощь с оформлением, если потребуются дополнительные справки'
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                                    <FileText className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                                    <p className="text-lg">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Documents You'll Receive */}
                <section className="py-12 md:py-16 bg-muted/30">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-10">Какие документы вы получите</h2>
                        <div className="grid gap-6">
                            {[
                                {
                                    icon: FileText,
                                    title: 'Договор купли-продажи',
                                    description: 'Официальный договор между вами и нашей компанией. Подтверждает легальность сделки, содержит все условия и стоимость.',
                                    why: 'Необходим для регистрации и перепродажи велосипеда'
                                },
                                {
                                    icon: Stamp,
                                    title: 'Таможенная декларация',
                                    description: 'Документ о прохождении таможенного контроля и уплате всех пошлин. Подтверждает легальный ввоз товара в Россию.',
                                    why: 'Подтверждает легальность ввоза'
                                },
                                {
                                    icon: Shield,
                                    title: 'Сертификат соответствия',
                                    description: 'Документ о том, что велосипед соответствует российским стандартам безопасности (если требуется для конкретной модели).',
                                    why: 'Для некоторых категорий обязателен'
                                },
                                {
                                    icon: Package,
                                    title: 'Оригинальные документы производителя',
                                    description: 'Гарантийный талон, инструкция, сертификат подлинности от бренда (если есть). Всё на языке оригинала.',
                                    why: 'Для гарантийного обслуживания'
                                },
                                {
                                    icon: FileText,
                                    title: 'Инвойс (счет-фактура)',
                                    description: 'Документ с детализацией стоимости, подтверждающий сумму сделки. Для юридических лиц — счет-фактура по российским стандартам.',
                                    why: 'Для бухгалтерии (юрлица)'
                                },
                                {
                                    icon: CheckCircle,
                                    title: 'Акт приема-передачи',
                                    description: 'Документ о передаче велосипеда вам. Фиксирует состояние и комплектацию на момент получения.',
                                    why: 'Защита от претензий'
                                }
                            ].map((doc, idx) => {
                                const Icon = doc.icon;
                                return (
                                    <div key={idx} className="p-6 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <Icon className="w-6 h-6 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-xl font-bold mb-2">{doc.title}</h3>
                                                <p className="text-muted-foreground leading-relaxed mb-2">{doc.description}</p>
                                                <span className="text-sm text-primary font-medium">→ {doc.why}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Customs Process */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Как проходит таможня</h2>
                        <div className="space-y-6">
                            <div className="p-6 rounded-lg border bg-card">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-bold text-primary">1</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Подготовка документов</h3>
                                        <p className="text-muted-foreground">Еще в Германии готовим экспортные документы: инвойс, сертификат происхождения, упаковочный лист.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-lg border bg-card">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-bold text-primary">2</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Прибытие на таможню</h3>
                                        <p className="text-muted-foreground">Груз прибывает на российскую таможню. Мы подаем декларацию и все необходимые документы.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-lg border bg-card">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-bold text-primary">3</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Проверка и оплата пошлин</h3>
                                        <p className="text-muted-foreground">Таможня проверяет груз и документы. Оплачиваем все сборы и пошлины (уже включено в вашу цену).</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-lg border bg-card">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-bold text-primary">4</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Выпуск груза</h3>
                                        <p className="text-muted-foreground">Получаем разрешение на ввоз, груз выпускается с таможни и отправляется к вам.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-lg border bg-card">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-bold text-primary">5</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Передача документов</h3>
                                        <p className="text-muted-foreground">Вместе с велосипедом вы получаете все оригиналы документов, включая таможенную декларацию.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* What We Handle */}
                <section className="py-12 md:py-16 bg-muted/30">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Что мы берём на себя</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                'Подготовка экспортных документов',
                                'Подача таможенной декларации',
                                'Оплата всех пошлин и сборов',
                                'Взаимодействие с таможней',
                                'Получение сертификатов (если нужны)',
                                'Оформление договора купли-продажи',
                                'Страхование на этапе таможни',
                                'Передача оригиналов документов'
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Client Responsibility */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Что требуется от вас</h2>
                        <div className="space-y-4">
                            {[
                                {
                                    title: 'Предоставить паспортные данные',
                                    desc: 'ФИО, паспортные данные для оформления договора и декларации'
                                },
                                {
                                    title: 'Подписать договор',
                                    desc: 'Подписать договор купли-продажи (можно электронной подписью)'
                                },
                                {
                                    title: 'Сохранить документы',
                                    desc: 'Бережно хранить все оригиналы (особенно таможенную декларацию)'
                                },
                                {
                                    title: 'Предъявить при необходимости',
                                    desc: 'Если потребуется (например, при продаже) — предоставить документы новому владельцу'
                                }
                            ].map((item, idx) => (
                                <div key={idx} className="p-4 rounded-lg border bg-card">
                                    <h3 className="font-semibold mb-2">{item.title}</h3>
                                    <p className="text-muted-foreground">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="py-12 md:py-16 bg-muted/30">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Частые вопросы</h2>
                        <div className="space-y-6">
                            {[
                                {
                                    q: 'Все ли пошлины включены в цену?',
                                    a: 'Да, абсолютно все. Таможенные пошлины, сборы за оформление, НДС — всё уже учтено. Никаких доплат не будет.'
                                },
                                {
                                    q: 'Могут ли возникнуть проблемы на таможне?',
                                    a: 'Мы делаем это ежедневно и знаем все нюансы. Вероятность проблем минимальна. Если что-то пойдет не так — мы решаем за свой счет.'
                                },
                                {
                                    q: 'Нужно ли мне лично присутствовать на таможне?',
                                    a: 'Нет, мы действуем по доверенности. Вам не нужно никуда ехать — всё делаем сами.'
                                },
                                {
                                    q: 'Можно ли будет продать велосипед в будущем?',
                                    a: 'Да, без проблем. У вас будет полный пакет документов, подтверждающих легальность покупки и ввоза.'
                                },
                                {
                                    q: 'Что делать, если документы потеряются?',
                                    a: 'Мы храним электронные копии всех документов. В любой момент можем выслать дубликаты или помочь с восстановлением оригиналов.'
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
                            Готовы начать?
                        </h2>
                        <p className="text-xl text-muted-foreground mb-8">
                            Мы позаботимся обо всех документах и легальности
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
