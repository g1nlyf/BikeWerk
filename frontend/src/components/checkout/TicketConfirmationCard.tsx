"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Share2, MapPin } from "lucide-react";

export interface TicketConfirmationCardProps {
  orderNumber?: string;
  applicationNumber?: string;
  totalAmount?: number;
  trackingUrl?: string;
  onClose?: () => void;
}

export const TicketConfirmationCard: React.FC<TicketConfirmationCardProps> = ({ orderNumber, applicationNumber, totalAmount, trackingUrl, onClose }) => {
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" /> Заявка и заказ созданы
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Номер заявки</span><span className="font-medium">{applicationNumber || '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Номер заказа</span><span className="font-medium">{orderNumber || '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Сумма</span><span className="font-medium">{typeof totalAmount === 'number' ? Math.round(totalAmount) + ' €' : '—'}</span></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" className="w-full" onClick={() => {
            const text = `Заявка ${applicationNumber || ''} создана на BikeEU`;
            if (navigator.share) {
              navigator.share({ title: 'Заявка создана', text, url: trackingUrl || window.location.href }).catch(()=>{})
            } else {
              try { navigator.clipboard.writeText(`${text} ${trackingUrl || ''}`) } catch {}
            }
          }}><Share2 className="mr-2 h-4 w-4" /> Поделиться</Button>
          <Button className="w-full" onClick={() => { if (trackingUrl) window.location.href = trackingUrl; }}><MapPin className="mr-2 h-4 w-4" /> К отслеживанию</Button>
        </div>
        <Button className="mt-2 w-full" onClick={onClose}>Вернуться в каталог</Button>
      </CardContent>
    </Card>
  );
};

export default TicketConfirmationCard;