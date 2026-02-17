import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, Send, MapPin, CheckCircle2, MessageSquare } from "lucide-react";

export const ContactsSection: React.FC = () => {
  const [submitted, setSubmitted] = React.useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <section id="contacts" className="container mx-auto px-4 py-20 max-w-6xl">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Свяжитесь с нами</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Мы всегда на связи. Выберите удобный способ или оставьте заявку — мы перезвоним.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Contact Info Column */}
        <div className="space-y-8">
          <div className="grid sm:grid-cols-2 gap-4">
            <a href="https://t.me/bikeflip" target="_blank" rel="noreferrer" className="group p-6 rounded-2xl border bg-muted/30 hover:bg-blue-500/5 hover:border-blue-500/20 transition-all duration-300">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                <Send className="h-5 w-5" />
              </div>
              <div className="font-bold text-lg mb-1">Telegram</div>
              <div className="text-sm text-muted-foreground group-hover:text-blue-600 transition-colors">@bikewerk</div>
            </a>

            <a href="https://wa.me/123456789" target="_blank" rel="noreferrer" className="group p-6 rounded-2xl border bg-muted/30 hover:bg-green-500/5 hover:border-green-500/20 transition-all duration-300">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-4 group-hover:scale-110 transition-transform">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="font-bold text-lg mb-1">WhatsApp</div>
              <div className="text-sm text-muted-foreground group-hover:text-green-600 transition-colors">Написать нам</div>
            </a>

            <a href="mailto:hello@bikewerk.eu" className="group p-6 rounded-2xl border bg-muted/30 hover:bg-orange-500/5 hover:border-orange-500/20 transition-all duration-300">
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mb-4 group-hover:scale-110 transition-transform">
                <Mail className="h-5 w-5" />
              </div>
              <div className="font-bold text-lg mb-1">Email</div>
              <div className="text-sm text-muted-foreground group-hover:text-orange-600 transition-colors">hello@bikewerk.eu</div>
            </a>

            <a href="tel:+490000000" className="group p-6 rounded-2xl border bg-muted/30 hover:bg-purple-500/5 hover:border-purple-500/20 transition-all duration-300">
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 mb-4 group-hover:scale-110 transition-transform">
                <Phone className="h-5 w-5" />
              </div>
              <div className="font-bold text-lg mb-1">Телефон</div>
              <div className="text-sm text-muted-foreground group-hover:text-purple-600 transition-colors">+49 (0) 123 456 78</div>
            </a>
          </div>

          <div className="p-6 rounded-2xl border bg-muted/30 flex items-start gap-4">
            <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-lg mb-1">Офис в Берлине</div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                Alexanderplatz 1, 10178 Berlin, Deutschland<br />
                Работаем пн-пт с 10:00 до 19:00
              </div>
            </div>
          </div>
        </div>

        {/* Form Column */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 blur-3xl opacity-20 -z-10" />
          <div className="bg-card border rounded-3xl p-8 shadow-lg">
            {submitted ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 mb-2">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold">Сообщение отправлено!</h3>
                <p className="text-muted-foreground max-w-xs">
                  Мы получили вашу заявку и свяжемся с вами в течение рабочего дня.
                </p>
                <Button variant="outline" className="mt-4 rounded-full" onClick={() => setSubmitted(false)}>
                  Отправить ещё одно
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Напишите нам</h3>
                  <p className="text-muted-foreground text-sm">
                    Заполните форму, и мы ответим на любые вопросы о доставке, оплате или подборе байка.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium ml-1">Имя</label>
                      <Input className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background focus:border-primary/20 transition-all" placeholder="Как к вам обращаться?" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium ml-1">Email</label>
                      <Input type="email" className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background focus:border-primary/20 transition-all" placeholder="example@mail.com" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium ml-1">Сообщение</label>
                    <Textarea
                      className="min-h-[120px] rounded-xl bg-muted/50 border-transparent focus:bg-background focus:border-primary/20 transition-all resize-none p-4"
                      placeholder="Расскажите, какой велосипед вы ищете или задайте вопрос..."
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 rounded-full text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                  Отправить сообщение
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Нажимая кнопку, вы соглашаетесь с политикой обработки персональных данных
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
