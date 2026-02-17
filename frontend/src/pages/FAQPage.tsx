import { Link } from 'react-router-dom';
import { BikeflipHeaderPX } from '@/components/layout/BikeflipHeaderPX';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { HelpCircle, ArrowRight, MessageCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function FAQPage() {
    const faqs = [
        {
            category: 'Общие вопросы',
            questions: [
                {
                    q: 'Сколько времени занимает доставка?',
                    a: 'В среднем 2-4 недели от момента оплаты до получения велосипеда. Это включает поиск, покупку, логистику и таможенное оформление.'
                },
                {
                    q: 'Какие документы я получу?',
                    a: 'Вы получите полный пакет: договор купли-продажи, таможенную декларацию, сертификат соответствия и все оригинальные документы от производителя.'
                },
                {
                    q: 'Какова экономия по сравнению с покупкой в РФ?',
                    a: 'В среднем 150-250 тысяч рублей на премиальных моделях. Чем дороже велосипед, тем больше экономия.'
                }
            ]
        },
        {
            category: 'Оплата и цены',
            questions: [
                {
                    q: 'Когда нужно вносить оплату?',
                    a: 'Только после того, как мы найдем велосипед, проверим его и согласуем с вами финальную цену. Никаких предоплат за консультации.'
                },
                {
                    q: 'Что входит в стоимость доставки?',
                    a: 'Логистика из Германии, таможенное оформление, пошлины, доставка до вашего города и страховка груза.'
                },
                {
                    q: 'Можно ли отменить заказ?',
                    a: 'До момента выкупа велосипеда — да, без каких-либо штрафов. После выкупа возможны особые условия в зависимости от ситуации.'
                },
                {
                    q: 'Что если я передумаю после оплаты?',
                    a: 'До момента отправки можно отменить заказ с возвратом 90% суммы (10% — издержки на проверку и оформление). После отправки возврат возможен только по согласованию.'
                }
            ]
        },
        {
            category: 'Гарантии и безопасность',
            questions: [
                {
                    q: 'Есть ли гарантия на велосипед?',
                    a: 'Да, действует официальная гарантия производителя. Мы также предоставляем гарантию на наши услуги по доставке и оформлению.'
                },
                {
                    q: 'Что будет, если велосипед повредится при доставке?',
                    a: 'Груз застрахован на полную стоимость. В случае повреждения мы получаем компенсацию от страховой и либо возвращаем вам деньги, либо находим замену.'
                },
                {
                    q: 'Можете ли вы гарантировать подлинность велосипеда?',
                    a: 'Да. Мы покупаем только у проверенных продавцов, проверяем серийные номера и документы. Каждый байк проходит техническую инспекцию.'
                },
                {
                    q: 'Действует ли гарантия производителя в России?',
                    a: 'Да, официальная гарантия производителя действует. Мы предоставляем все необходимые документы для гарантийного обслуживания.'
                }
            ]
        },
        {
            category: 'Велосипеды и подбор',
            questions: [
                {
                    q: 'Можно ли заказать б/у велосипед?',
                    a: 'Да, мы работаем как с новыми, так и с б/у велосипедами. Все б/у байки проходят тщательную проверку перед покупкой.'
                },
                {
                    q: 'Что если велосипед придет не в том состоянии?',
                    a: 'Мы проверяем каждый байк перед отправкой и высылаем фото/видео. Груз застрахован на всех этапах. В случае повреждения при доставке — полная компенсация.'
                },
                {
                    q: 'Помогаете ли вы с подбором размера?',
                    a: 'Да, обязательно! Наши менеджеры помогут подобрать правильный размер рамы на основе вашего роста и предпочтений по посадке.'
                }
            ]
        },
        {
            category: 'Процесс и коммуникация',
            questions: [
                {
                    q: 'Как я буду знать, что происходит с моим заказом?',
                    a: 'Личный менеджер держит вас в курсе на каждом этапе. Плюс вы всегда можете отследить статус заказа в личном кабинете.'
                },
                {
                    q: 'Можно ли приехать и посмотреть велосипед перед покупкой?',
                    a: 'Велосипеды находятся в Европе, поэтому личный осмотр до покупки невозможен. Но мы предоставляем детальные фото и видео, а также полный техотчет.'
                },
                {
                    q: 'Как связаться с менеджером?',
                    a: 'По телефону, WhatsApp, Telegram или email. Мы на связи 24/7 на всех этапах заказа.'
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <BikeflipHeaderPX />

            <main className="flex-1">
                {/* Hero Section */}
                <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 md:py-24">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <div className="flex items-center gap-3 mb-6">
                            <HelpCircle className="h-12 w-12 text-primary" />
                            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                                Частые вопросы
                            </h1>
                        </div>
                        <p className="text-xl md:text-2xl text-muted-foreground">
                            Ответы на самые популярные вопросы о покупке и доставке велосипедов из Европы
                        </p>
                    </div>
                </section>

                {/* FAQ Sections */}
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <div className="space-y-12">
                            {faqs.map((section, idx) => (
                                <div key={idx}>
                                    <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
                                        <span className="w-2 h-8 bg-primary rounded-full"></span>
                                        {section.category}
                                    </h2>
                                    <Accordion type="single" collapsible className="space-y-3">
                                        {section.questions.map((faq, qIdx) => (
                                            <AccordionItem
                                                key={qIdx}
                                                value={`${idx}-${qIdx}`}
                                                className="border rounded-lg bg-card px-6"
                                            >
                                                <AccordionTrigger className="text-left font-semibold hover:no-underline py-4">
                                                    {faq.q}
                                                </AccordionTrigger>
                                                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                                                    {faq.a}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Still Have Questions */}
                <section className="py-12 md:py-16 bg-muted/30">
                    <div className="container mx-auto px-4 max-w-4xl text-center">
                        <MessageCircle className="h-16 w-16 text-primary mx-auto mb-6" />
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">
                            Не нашли ответ на свой вопрос?
                        </h2>
                        <p className="text-lg text-muted-foreground mb-8">
                            Свяжитесь с нами — мы с радостью ответим на все ваши вопросы
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" className="text-lg px-8 py-6">
                                Написать в WhatsApp
                            </Button>
                            <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                                Позвонить нам
                            </Button>
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
                            Выберите велосипед или закажите индивидуальный подбор
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
