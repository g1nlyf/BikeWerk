import * as React from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { MessageCircle, HelpCircle } from "lucide-react";

type FAQ = { q: string; a: string };

const faqs: FAQ[] = [
  { 
    q: "Как происходит оплата? Безопасно ли это?", 
    a: "Мы работаем официально по договору. Оплата прозрачна и может быть разделена на этапы (выкуп и логистика). Мы принимаем платежи удобными для вас способами, включая карты банков РФ. На каждый платеж вы получаете подтверждающий документ. Никаких скрытых комиссий — все фиксируется «на берегу»." 
  },
  { 
    q: "Как вы доставляете велосипеды в текущих условиях (санкции)?", 
    a: "У нас налажена надежная логистическая цепочка через транзитные страны. Мы берем на себя все вопросы таможенного оформления и прохождения границ. Для вас процесс выглядит так же просто, как заказ в обычном интернет-магазине: выбрали, оплатили, получили в своем городе." 
  },
  { 
    q: "А вдруг велосипед повредится или потеряется в пути?", 
    a: "Каждый груз застрахован на 100% его стоимости. Перед отправкой мы делаем дополнительную упаковку (усиленный картон, пупырчатая пленка, обрешетка при необходимости). Если (что крайне маловероятно) с грузом что-то случится, мы полностью вернем деньги или привезем аналогичный велосипед за свой счет." 
  },
  { 
    q: "Сколько ждать доставку?", 
    a: "Средний срок доставки составляет 3-4 недели с момента выкупа велосипеда в Европе. Сроки могут незначительно варьироваться в зависимости от вашего региона и текущей ситуации на таможне, но ваш личный менеджер будет держать вас в курсе движения заказа 24/7." 
  },
  { 
    q: "Что если велосипед мне не подойдет по размеру?", 
    a: "Мы сводим этот риск к нулю. Перед покупкой наш эксперт запрашивает ваши параметры (рост, длина ног и др.) и сверяет их с геометрией конкретной рамы. Если есть сомнения, мы порекомендуем другую модель или размер. Мы не привезем вам то, на чем будет неудобно ездить." 
  },
  { 
    q: "Можно ли заказать б/у велосипед? Как проверить его состояние?", 
    a: "Да, это отличный способ сэкономить! Мы работаем только с проверенными площадками. Перед выкупом мы запрашиваем детальные фото и видео, проверяем историю обслуживания и состояние компонентов. Мы никогда не купим для вас «кота в мешке» — только велосипед, в котором уверены сами." 
  },
  { 
    q: "Какие гарантии, что вы не пропадете после оплаты?", 
    a: "Мы дорожим своей репутацией. Мы — публичная компания: ведем социальные сети, показываем наши лица, публикуем отчеты о доставках и отзывы реальных клиентов. Мы работаем по официальному договору, имеем юридическое лицо и несем ответственность перед законом. Вы всегда можете связаться с нами или нашим руководителем." 
  }
];

export const FAQSection: React.FC = () => {
  return (
    <section id="faq" className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-4">
          <HelpCircle className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Частые вопросы</h2>
        <p className="text-lg text-muted-foreground">
          Мы собрали ответы на самые популярные вопросы, чтобы вам было спокойнее.
        </p>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 shadow-sm">
        <Accordion type="single" collapsible className="w-full space-y-4">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border rounded-xl px-4 hover:bg-muted/30 transition-colors">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline py-4 text-left">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground leading-relaxed pb-4">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="mt-12 text-center bg-primary/5 rounded-2xl p-8 border border-primary/10">
        <h3 className="text-2xl font-bold mb-3">Не нашли ответ на свой вопрос?</h3>
        <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
          Напишите нам в мессенджеры. Наши менеджеры (живые люди, не боты) ответят вам в течение 15 минут, все подробно расскажут и успокоят.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gap-2 text-lg h-12 px-8">
            <MessageCircle className="w-5 h-5" />
            Написать менеджеру
          </Button>
        </div>
      </div>
    </section>
  );
};
