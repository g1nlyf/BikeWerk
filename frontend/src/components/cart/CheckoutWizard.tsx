"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { apiPost } from "@/api";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { HelpCircle, ChevronLeft, Check, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CartItem = { 
  id: string; 
  name: string; 
  price: number; 
  quantity: number; 
  imageUrl?: string;
  details?: {
    brand?: string;
    model?: string;
    year?: number;
    specifications?: any;
    color?: string;
    size?: string;
    condition_status?: string;
    original_price?: number;
    category?: string;
  }
};

export interface CheckoutWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onSuccess?: (result: any) => void;
  needsManager?: boolean;
  guestMode?: boolean;
  fast?: boolean;
}

export const CheckoutWizard: React.FC<CheckoutWizardProps> = ({ open, onOpenChange, items, onSuccess, needsManager = false, guestMode = false, fast = false }) => {
  const [step, setStep] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [deliveryMethod, setDeliveryMethod] = React.useState("courier");
  const [paymentMethod, setPaymentMethod] = React.useState("card");
  const [notes, setNotes] = React.useState("");

  const totalEUR = Math.round(items.reduce((sum, i) => sum + (i.price * i.quantity), 0));

  // Auto-fill if user data is available (could be passed as props or context, but keeping it simple for now)

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Prepare items with details for the backend
      const itemsPayload = items.map(i => ({
        bike_id: i.id,
        quantity: i.quantity,
        price: i.price,
        specifications: i.details?.specifications,
        size: i.details?.size,
        color: i.details?.color,
        condition: i.details?.condition_status,
        year: i.details?.year,
        brand: i.details?.brand,
        model: i.details?.model,
        category: i.details?.category,
        original_price: i.details?.original_price
      }));

      if (guestMode) {
        const contact_method = email ? "email" : "phone";
        const contact_value = email ? String(email).trim() : String(phone).replace(/\D+/g, "");
        const payload = { 
          name: String(name).trim(), 
          contact_method, 
          contact_value, 
          notes: notes || null,
          items: itemsPayload // Send detailed items
        };
        const result = fast
          ? await apiPost('/v1/crm/orders/quick', payload)
          : await apiPost('/v1/crm/applications', payload);
        setSubmitting(false);
        if (onSuccess) onSuccess(result);
        onOpenChange(false);
        return;
      }
      const payload = {
        name,
        email,
        phone,
        address,
        city,
        postalCode,
        delivery_method: deliveryMethod,
        payment_method: paymentMethod,
        contact_method: email ? "email" : (phone ? "phone" : "email"),
        notes,
        needs_manager: !!needsManager,
        items: itemsPayload // Send detailed items
      };
      const result = await apiPost('/checkout', payload);
      setSubmitting(false);
      if (onSuccess) onSuccess(result);
      onOpenChange(false);
    } catch (e: any) {
      setSubmitting(false);
      setError(e?.message || 'Не удалось оформить заказ');
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
       {[1, 2, ...(guestMode ? [] : [3, 4])].map((s) => (
         <div key={s} className="flex items-center">
           <div className={cn(
             "h-2.5 w-2.5 rounded-full transition-colors duration-300",
             s === step ? "bg-primary scale-125" : (s < step ? "bg-primary/60" : "bg-muted")
           )} />
           {s !== (guestMode ? 2 : 4) && <div className="w-4 h-[1px] bg-muted mx-1" />}
         </div>
       ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl rounded-[2rem] p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-none shadow-2xl">
        <div className="bg-muted/30 px-6 py-4 border-b flex items-center justify-between">
          <DialogTitle className="text-xl font-semibold">
            {guestMode ? (fast ? 'Быстрый заказ' : 'Заявка') : 'Оформление заказа'}
          </DialogTitle>
          <StepIndicator />
        </div>
        
        <div className="p-6 md:p-8">
          <div className="min-h-[300px]">
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              {guestMode && (
                <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-medium text-blue-900">Оформление заявки — бесплатно</h4>
                      <p className="text-sm text-blue-700/90 leading-relaxed">
                        Сейчас нужно написать продавцу, договориться о продаже, задать все ваши вопросы — поэтому мы создаем бесплатную заявку, после которой с вами свяжется менеджер. <span className="font-semibold">Сейчас платить ничего не нужно будет.</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-muted-foreground ml-1">Ваше имя</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван Иванов" className="h-12 rounded-xl bg-muted/20 border-transparent focus:bg-background focus:border-primary/20 transition-all" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-muted-foreground ml-1">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 rounded-xl bg-muted/20 border-transparent focus:bg-background focus:border-primary/20 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-muted-foreground ml-1">Телефон</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 000-00-00" className="h-12 rounded-xl bg-muted/20 border-transparent focus:bg-background focus:border-primary/20 transition-all" />
                  </div>
                </div>
                {guestMode && (
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium text-muted-foreground ml-1">Комментарий (необязательно)</Label>
                    <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ваши пожелания" className="h-12 rounded-xl bg-muted/20 border-transparent focus:bg-background focus:border-primary/20 transition-all" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground bg-blue-500/5 p-3 rounded-xl border border-blue-500/10">
                 <ShieldCheck className="h-4 w-4 text-blue-500" />
                 <span>Ваши данные надежно защищены и используются только для оформления заказа.</span>
              </div>
            </div>
          )}

          {!guestMode && step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground ml-1">Адрес доставки</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Улица, дом, квартира" className="h-12 rounded-xl bg-muted/20 border-transparent focus:bg-background focus:border-primary/20 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground ml-1">Город</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" className="h-12 rounded-xl bg-muted/20 border-transparent focus:bg-background focus:border-primary/20 transition-all" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground ml-1">Индекс</Label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="101000" className="h-12 rounded-xl bg-muted/20 border-transparent focus:bg-background focus:border-primary/20 transition-all" />
                </div>
              </div>
            </div>
          )}

          {!guestMode && step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground ml-1">Способ доставки</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'courier', label: 'Курьер', icon: Truck },
                      { id: 'pickup', label: 'Самовывоз', icon: ShieldCheck },
                      { id: 'postal', label: 'Почта', icon: Truck }
                    ].map(m => (
                      <div 
                        key={m.id}
                        onClick={() => setDeliveryMethod(m.id)}
                        className={cn(
                          "cursor-pointer rounded-xl border-2 p-3 flex flex-col items-center justify-center gap-2 transition-all hover:bg-muted/50",
                          deliveryMethod === m.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/20"
                        )}
                      >
                        <m.icon className={cn("h-5 w-5", deliveryMethod === m.id ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-xs font-medium", deliveryMethod === m.id ? "text-foreground" : "text-muted-foreground")}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground ml-1">Способ оплаты</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-transparent focus:bg-background focus:border-primary/20"><SelectValue placeholder="Выберите способ" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="card">Банковская карта (Visa/MC/Mir)</SelectItem>
                      <SelectItem value="cash">Наличные при получении</SelectItem>
                      <SelectItem value="transfer">Банковский перевод (Счет)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground ml-1">Комментарий к заказу</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Код домофона, время доставки..." className="h-12 rounded-xl bg-muted/20 border-transparent focus:bg-background focus:border-primary/20 transition-all" />
                </div>
              </div>
            </div>
          )}

          {(guestMode ? step === 2 : step === 4) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="space-y-4">
                 {items.map((i) => (
                   <div key={i.id} className="flex gap-4 bg-card rounded-2xl border p-3 shadow-sm hover:shadow-md transition-all">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {i.imageUrl ? (
                          <img src={i.imageUrl} alt={i.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Нет фото</div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between py-1">
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold line-clamp-1">{i.name}</h4>
                              <p className="text-xs text-muted-foreground">{i.details?.brand} {i.details?.model}</p>
                            </div>
                            <div className="text-right">
                               <div className="font-bold">{Math.round(i.price).toLocaleString()} €</div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {i.details?.year && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{i.details.year}</Badge>}
                            {i.details?.size && <Badge variant="outline" className="text-[10px] h-5 px-1.5">{i.details.size}</Badge>}
                            {i.details?.condition_status && <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-blue-200 text-blue-700 bg-blue-50">{i.details.condition_status}</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                           <span>Количество: {i.quantity}</span>
                        </div>
                      </div>
                   </div>
                 ))}
               </div>

               <div className="rounded-2xl bg-muted/30 p-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Товары ({items.reduce((a,c)=>a+c.quantity,0)})</span>
                    <span>{totalEUR.toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Доставка</span>
                    <span className="text-green-600 font-medium">Рассчитывается</span>
                  </div>
                  <div className="pt-3 border-t flex justify-between items-end">
                    <span className="font-semibold">Итого</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{totalEUR.toLocaleString()} €</span>
                      <p className="text-[10px] text-muted-foreground">Оплата в рублях по курсу ЦБ + %</p>
                    </div>
                  </div>
               </div>
            </div>
          )}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
               <HelpCircle className="h-4 w-4" />
               {error}
            </div>
          )}

          <div className="flex gap-3 mt-8 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => step === 1 ? onOpenChange(false) : setStep(s => s - 1)}
              className="h-12 px-6 rounded-xl border-muted-foreground/20 hover:bg-muted/50"
              disabled={submitting}
            >
              {step === 1 ? 'Отмена' : 'Назад'}
            </Button>
            <Button 
              className="flex-1 h-12 rounded-xl font-medium text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              onClick={
                (guestMode && step === 2) || (!guestMode && step === 4) 
                  ? submit 
                  : () => setStep(s => s + 1)
              }
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  Обработка...
                </span>
              ) : (
                (guestMode && step === 2) || (!guestMode && step === 4) ? 'Оформить заказ' : 'Далее'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutWizard;
