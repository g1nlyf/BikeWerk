import * as React from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Share2, Check, Send, MessageCircle, Phone, ShieldCheck, Bike, ArrowRight, Loader2 } from "lucide-react"
import { apiPost } from "@/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { LegalConsentFields } from "@/components/legal/LegalConsentFields"
import { DEFAULT_FORM_LEGAL_CONSENT, buildLegalAuditLine, hasRequiredFormLegalConsent } from "@/lib/legal"

type ContactMethod = "telegram" | "whatsapp" | "phone"

type OrderItem = {
  id: string | number;
  name: string;
  price: number;
  image?: string;
  details?: {
    brand?: string;
    model?: string;
    year?: number;
    size?: string;
  };
  link?: string;
}

export default function GuestOrderWizardPage() {
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  
  // Form State
  const [name, setName] = React.useState("")
  const [contactMethod, setContactMethod] = React.useState<ContactMethod>("telegram")
  const [contactValue, setContactValue] = React.useState("")
  const [communicationMode, setCommunicationMode] = React.useState<"silent" | "active">("silent")
  const [tariff, setTariff] = React.useState<"standard" | "sniper">("standard")
  const [legalConsent, setLegalConsent] = React.useState(DEFAULT_FORM_LEGAL_CONSENT)
  
  // Items from Calculator or other sources
  const [items, setItems] = React.useState<OrderItem[]>([])

  React.useEffect(() => {
    try {
      const calcDataRaw = localStorage.getItem('calculator_data')
      if (calcDataRaw) {
        const d = JSON.parse(calcDataRaw)
        setItems([{
          id: d.info?.id || `calc-${Date.now()}`,
          name: d.info?.title || (d.mode === 'manual' ? `Байк за ${d.bikePrice}€` : "Найденный велосипед"),
          price: d.bikePrice,
          image: d.info?.image,
          details: {
            brand: d.info?.brand,
            model: d.info?.model,
            year: d.info?.year,
          },
          link: d.link
        }])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const handleSubmit = async () => {
    if (!hasRequiredFormLegalConsent(legalConsent)) {
      setError("Подтвердите согласие с условиями оферты и обработкой персональных данных")
      return
    }
    if (!name.trim() || !contactValue.trim()) {
      setError("Пожалуйста, заполните имя и контакт")
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const legalAudit = buildLegalAuditLine(legalConsent.marketingAccepted)
      const payload = {
        source: "website_guest_order_page",
        name,
        contact_method: contactMethod,
        contact_value: contactValue,
        tariff,
        items: items.map(i => ({
          bike_id: i.id,
          price: i.price,
          name: i.name,
          details: i.details,
          link: i.link
        })),
        total_price: items.reduce((sum, i) => sum + Number(i.price), 0) + (tariff === 'sniper' ? 249 : 0),
        customer: {
          is_auth: false,
          user_id: null
        },
        preferences: {
          communication_mode: communicationMode,
          needs_manager: communicationMode === "active"
        },
        notes: (communicationMode === "active" 
          ? "Клиент запросил консультацию (Активный режим)" 
          : "Клиент ждет ссылку на оплату (Тихий режим)") + 
          (tariff === 'sniper' ? " | Тариф: Sniper Lab (+249€)" : "") +
          ` | ${legalAudit}`
      };

      const res = await apiPost('/v1/crm/orders/quick', payload);
      
      if (res?.success || res?.order_id || res?.application_id) {
        // Clear calc data
        try { localStorage.removeItem('calculator_data') } catch {}

        // Silent redirect to home
        window.location.href = '/';
      } else {
        throw new Error(res?.error || "Не удалось создать заявку")
      }
    } catch (e: any) {
      setError(e.message || "Произошла ошибка. Попробуйте позже.")
    } finally {
      setSubmitting(false)
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Card className="rounded-3xl border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-black text-white p-8">
              <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight">Оформление заказа</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
             {items.length > 0 && (
               <div className="bg-gray-50 border-b p-6">
                 <div className="flex items-start gap-4">
                    <div className="h-20 w-20 shrink-0 rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm">
                      {items[0].image ? (
                        <img src={items[0].image} alt={items[0].name} className="h-full w-full object-cover" />
                      ) : (
                        <Bike className="h-8 w-8 m-auto text-gray-400 mt-6" />
                      )}
                    </div>
                    <div className="flex-1 py-1">
                      <h4 className="font-bold text-base leading-tight mb-1 line-clamp-2">{items[0].name}</h4>
                      <div className="text-xs text-gray-500 mb-2">
                        {items[0].details?.brand} {items[0].details?.model}
                      </div>
                      <div className="font-bold text-black text-lg">
                        {items[0].price.toLocaleString()} €
                      </div>
                    </div>
                 </div>
               </div>
             )}

             <div className="p-6 md:p-8 space-y-8">
                {/* Tariff Selector */}
                <div className="space-y-3">
                   <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold ml-1">Уровень сервиса</Label>
                   <div className="grid gap-3">
                      <div 
                        onClick={() => setTariff("standard")}
                        className={cn(
                          "cursor-pointer group relative flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200",
                          tariff === "standard" 
                            ? "border-black bg-gray-50 shadow-sm" 
                            : "border-transparent bg-gray-50/50 hover:bg-gray-100"
                        )}
                      >
                        <div className={cn(
                          "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0", 
                          tariff === "standard" ? "border-black bg-black text-white" : "border-gray-300 group-hover:border-gray-400"
                        )}>
                          {tariff === "standard" && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                             <div className="font-bold text-base text-black">Standard Delivery</div>
                          </div>
                          <div className="text-sm text-gray-500 leading-snug">
                            Базовая инспекция, страховка, фотоотчет и доставка до двери.
                          </div>
                        </div>
                      </div>

                      <div 
                        onClick={() => setTariff("sniper")}
                        className={cn(
                          "cursor-pointer group relative flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200",
                          tariff === "sniper" 
                            ? "border-purple-600 bg-purple-50/30 shadow-sm ring-1 ring-purple-500/20" 
                            : "border-transparent bg-gray-50/50 hover:bg-gray-100"
                        )}
                      >
                         <div className={cn(
                          "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0", 
                          tariff === "sniper" ? "border-purple-600 bg-purple-600 text-white" : "border-gray-300 group-hover:border-gray-400"
                        )}>
                          {tariff === "sniper" && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                             <div className="flex items-center gap-2">
                               <div className="font-bold text-base text-purple-900">Sniper Lab</div>
                               <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-0 h-5 text-[10px]">PRO</Badge>
                             </div>
                             <div className="font-bold text-purple-700">+249 €</div>
                          </div>
                          <div className="text-sm text-gray-600 leading-snug">
                            <span className="font-medium text-purple-800">Digital Twin Diagnostics.</span> Полный разбор до винтика, эндоскопия рамы + 100% гарантия таможенной очистки (0% рисков).
                          </div>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Contact Form */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold ml-1">Как к вам обращаться?</Label>
                    <Input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Иван"
                      className="h-14 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all px-4 font-medium placeholder:text-gray-400 text-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold ml-1">Способ связи</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'telegram', icon: Send, label: 'Telegram', colorClass: 'text-[#229ED9]' },
                        { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', colorClass: 'text-[#25D366]' },
                        { id: 'phone', icon: Phone, label: 'Звонок', colorClass: 'text-black' },
                      ].map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setContactMethod(method.id as any)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all duration-200",
                            contactMethod === method.id 
                              ? "border-black bg-black text-white shadow-md scale-[1.02]" 
                              : "border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100"
                          )}
                        >
                          <method.icon className={cn("h-5 w-5", contactMethod !== method.id && method.colorClass)} />
                          <span className="text-[11px] font-bold">{method.label}</span>
                        </button>
                      ))}
                    </div>

                    <Input 
                      value={contactValue} 
                      onChange={(e) => setContactValue(e.target.value)}
                      placeholder={contactMethod === 'phone' ? "+7 900 ..." : "@username или номер"}
                      className="h-14 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all px-4 font-medium placeholder:text-gray-400 text-lg"
                    />
                  </div>
                </div>

                <Separator />

                {/* Mode Switcher */}
                <div className="space-y-3">
                   <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold ml-1">Режим обработки</Label>
                   <div className="grid gap-3">
                      <div 
                        onClick={() => setCommunicationMode("silent")}
                        className={cn(
                          "cursor-pointer group relative flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200",
                          communicationMode === "silent" 
                            ? "border-emerald-500 bg-emerald-50/30 shadow-sm ring-1 ring-emerald-500/20" 
                            : "border-transparent bg-gray-50 hover:bg-gray-100"
                        )}
                      >
                        <div className={cn(
                          "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0", 
                          communicationMode === "silent" ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 group-hover:border-gray-400"
                        )}>
                          {communicationMode === "silent" && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                             <div className={cn("font-bold text-base", communicationMode === "silent" ? "text-black" : "text-gray-500")}>
                               Тихий режим
                             </div>
                             {communicationMode === "silent" && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px] h-5">Рекомендуем</Badge>}
                          </div>
                          <div className="text-sm text-gray-500 leading-snug">
                            Мы проверим байк, пришлем фотоотчет и ссылку на оплату в мессенджер. <span className="font-medium text-gray-700">Никаких звонков.</span>
                          </div>
                        </div>
                      </div>

                      <div 
                        onClick={() => setCommunicationMode("active")}
                        className={cn(
                          "cursor-pointer group relative flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200",
                          communicationMode === "active" 
                            ? "border-black bg-white shadow-sm ring-1 ring-black/5" 
                            : "border-transparent bg-gray-50 hover:bg-gray-100"
                        )}
                      >
                         <div className={cn(
                          "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0", 
                          communicationMode === "active" ? "border-black bg-black text-white" : "border-gray-300 group-hover:border-gray-400"
                        )}>
                          {communicationMode === "active" && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1">
                          <div className={cn("font-bold text-base", communicationMode === "active" ? "text-black" : "text-gray-500")}>
                            Нужна консультация
                          </div>
                          <div className="text-sm text-gray-500 leading-snug">
                            Менеджер свяжется с вами, ответит на вопросы, поможет с выбором размера и обсудит торг.
                          </div>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Footer Info */}
                <div className="flex items-start gap-3 bg-gray-50 p-4 rounded-2xl">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-500 font-medium leading-relaxed">
                    <span className="text-black font-semibold">Безопасная сделка.</span> Вы платите только после того, как мы подтвердим наличие, состояние и забронируем байк.
                  </div>
                </div>

                <LegalConsentFields value={legalConsent} onChange={setLegalConsent} />

                {error && (
                  <div className="p-4 rounded-2xl bg-red-50 text-red-600 text-sm font-medium text-center">
                    {error}
                  </div>
                )}

                <Button 
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-16 rounded-2xl text-lg font-bold bg-black text-white hover:bg-gray-800 shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5"
                >
                  {submitting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      Оформить заявку <ArrowRight className="ml-2 w-5 h-5" />
                    </>
                  )}
                </Button>
             </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
