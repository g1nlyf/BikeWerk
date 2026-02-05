import * as React from "react"
import { motion } from "framer-motion"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Share2, CheckCircle } from "lucide-react"

interface OrderSuccessOverlayProps {
    orderId: string;
    orderNumber: string;
    trackingUrl?: string;
    type?: string;
    onClose?: () => void;
}

export function OrderSuccessOverlay({ orderId, orderNumber, trackingUrl, type = 'order', onClose, embedded = false }: OrderSuccessOverlayProps & { embedded?: boolean }) {
    
    async function share() {
        const link = orderId ? `${window.location.origin}/order-tracking/${orderId}` : `${window.location.origin}/order-tracking`
        try {
            await navigator.clipboard.writeText(link)
            alert('Ссылка скопирована')
        } catch {
            alert(link)
        }
    }

    function gotoTracking() {
        if (trackingUrl && trackingUrl.startsWith('http')) {
            window.location.href = trackingUrl;
            return;
        }
        // Use orderNumber directly as orderCode (e.g. ORD-XXXX)
        const target = (orderNumber || '').trim()
        const url = target ? `/order-tracking/${encodeURIComponent(target)}` : (orderId ? `/order-tracking/${orderId}` : '/order-tracking')
        window.location.href = url
    }

    const Content = (
        <Card className={embedded ? "shadow-none border-0 bg-transparent" : "rounded-3xl shadow-2xl border-white/20"}>
            <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl md:text-3xl">
                    {type === 'order' ? 'Заказ принят!' : 'Заявка отправлена'}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
                <div className="text-muted-foreground">
                    {type === 'order' 
                        ? 'Мы уже начали оформление. Менеджер скоро свяжется с вами для подтверждения.' 
                        : 'Мы приняли вашу заявку и скоро вернемся с ответом.'}
                </div>
                
                <div className="mx-auto max-w-sm rounded-2xl border bg-slate-50 p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Номер заказа</div>
                    <div className="text-2xl font-bold tracking-tight">{orderNumber || 'APP-XXXXXX'}</div>
                    <Badge variant="secondary" className="mt-2">Гость</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="rounded-xl h-12" onClick={share}>
                        <Share2 className="h-4 w-4 mr-2" /> 
                        Поделиться
                    </Button>
                    <Button className="rounded-xl h-12 bg-black text-white hover:bg-black/90" onClick={gotoTracking}>
                        Отследить
                    </Button>
                </div>
                
                {onClose && (
                    <Button variant="ghost" className="w-full rounded-xl text-muted-foreground" onClick={onClose}>
                        Закрыть
                    </Button>
                )}
            </CardContent>
        </Card>
    );

    if (embedded) {
        return <div className="w-full max-w-lg">{Content}</div>;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg"
            >
                {Content}
            </motion.div>
        </div>
    )
}
