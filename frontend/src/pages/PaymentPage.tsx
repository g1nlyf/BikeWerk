import { Link } from 'react-router-dom';
import { BikeflipHeaderPX } from '@/components/layout/BikeflipHeaderPX';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { CreditCard, DollarSign, Lock, CheckCircle, Shield, Clock, ArrowRight } from 'lucide-react';

export default function PaymentPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <BikeflipHeaderPX />

            <main className="flex-1">
                {/* Hero Section */}
                <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 md:py-24">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                            Оплата
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground">
                            Безопасные способы оплаты и прозрачные условия
                        </p>
                    </div>
                </section>

                {/* Quick Summary */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Коротко о сути</h2>
                        <div className="grid gap-4">
                            {[
                                'Оплата только после финальной проверки велосипеда перед отправкой',
                                'Принимаем банковские переводы, карты и криптовалюту',
                                'Цена фиксируется в договоре и не может измениться',
                                'Возможна рассрочка на стандартных условиях банков-партнеров',
                                'Все платежи защищены и проходят через безопасные каналы',
                                'Полный пакет документов для юридической чистоты сделки'
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                                    <Lock className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                                    <p className="text-lg">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Payment Methods */}
                <section className="py-12 md:py-16 bg-muted/30">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-10">Способы оплаты</h2>
                        <div className="grid gap-6">
                            {[
                                {
                                    icon: CreditCard,
                                    title: 'Банковская карта',
                                    description: 'Visa, Mastercard, МИР — оплата через защищенный шлюз. Деньги поступают на счет эскроу и держатся до подтверждения отправки.',
                                    note: 'Без комиссии для клиента'
                                },
                                {
                                    icon: DollarSign,
                                    title: 'Банковский перевод',
                                    description: 'Прямой перевод на расчетный счет компании. Подходит для крупных сумм. Предоставляем все реквизиты после согласования заказа.',
                                    note: 'Комиссия банка — по тарифам вашего банка'
                                },
                                {
                                    icon: Shield,
                                    title: 'Криптовалюта',
                                    description: 'USDT, BTC, ETH — для тех, кто предпочитает крипту. Курс фиксируется на момент платежа, никаких скрытых конвертаций.',
                                    note: 'Комиссия сети — по факту транзакции'
                                },
                                {
                                    icon: Clock,
                                    title: 'Рассрочка',
                                    description: 'Партнерство с банками позволяет оформить рассрочку на 6-12 месяцев. Одобрение онлайн за несколько минут.',
                                    note: 'Без переплаты, первый взнос 30%'
                                }
                            ].map((method, idx) => {
                                const Icon = method.icon;
                                return (
                                    <div key={idx} className="p-6 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <Icon className="w-6 h-6 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-xl font-bold mb-2">{method.title}</h3>
                                                <p className="text-muted-foreground leading-relaxed mb-2">{method.description}</p>
                                                <span className="text-sm text-primary font-medium">{method.note}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Payment Process */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Как проходит оплата</h2>
                        <div className="space-y-6">
                            <div className="p-6 rounded-lg border bg-card">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-bold text-primary">1</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Согласование цены</h3>
                                        <p className="text-muted-foreground">После подбора велосипеда менеджер называет финальную цену — она фиксируется в договоре и больше не меняется.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-lg border bg-card">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-bold text-primary">2</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Подписание договора</h3>
                                        <p className="text-muted-foreground">Высылаем договор на подпись (можно электронно). В нём прописаны все условия, цена и ответственность сторон.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-lg border bg-card">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-bold text-primary">3</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Финальная проверка</h3>
                                        <p className="text-muted-foreground">Мы проверяем велосипед перед выкупом, высылаем вам фото/видео. Только после вашего "ОК" переходим к оплате.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-lg border bg-card">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-bold text-primary">4</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Внесение оплаты</h3>
                                        <p className="text-muted-foreground">Вы вносите оплату удобным способом. Деньги защищены — мы выкупаем байк и отправляем его вам.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-lg border bg-card">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-bold text-primary">5</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Получение документов</h3>
                                        <p className="text-muted-foreground">После оплаты вы получаете все финансовые документы: чек, договор, счет-фактуру (для юрлиц).</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* What We Cover */}
                <section className="py-12 md:py-16 bg-muted/30">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-8">Что включено в стоимость</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                'Стоимость велосипеда',
                                'Комиссия за подбор и проверку',
                                'Логистика из Германии',
                                'Таможенные пошлины',
                                'Страхование груза',
                                'Упаковка и подготовка',
                                'Доставка до вашего города',
                                'Все документы и сертификаты'
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                                    <span>{item}</span>
                                </div>
                            ))}
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
                                    q: 'Можно ли внести предоплату, чтобы зафиксировать цену?',
                                    a: 'Нет необходимости. Цена фиксируется в договоре сразу после подбора велосипеда. Даже если курс изменится, цена не вырастет.'
                                },
                                {
                                    q: 'Безопасно ли платить онлайн?',
                                    a: 'Да. Мы используем защищенные платежные шлюзы с 3D Secure. Все данные карты шифруются, мы их не видим и не храним.'
                                },
                                {
                                    q: 'Можно ли вернуть деньги, если передумаю?',
                                    a: 'До момента выкупа — полный возврат. После выкупа возможен возврат 90% (10% уходит на издержки). Детали в договоре.'
                                },
                                {
                                    q: 'Принимаете ли оплату от юридических лиц?',
                                    a: 'Да, работаем с юрлицами. Предоставляем все необходимые документы для бухгалтерии: договор, счет, акт, счет-фактуру.'
                                },
                                {
                                    q: 'Какие документы я получу после оплаты?',
                                    a: 'Договор, платежное поручение (или чек), счет-фактуру (для юрлиц), акт выполненных работ. Все в электронном виде и на почту.'
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
                            Готовы сделать заказ?
                        </h2>
                        <p className="text-xl text-muted-foreground mb-8">
                            Выберите велосипед — обсудим удобный способ оплаты
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
