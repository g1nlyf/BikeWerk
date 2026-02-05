"use client";
import * as React from "react";
import { X, ShoppingCart, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartUI } from "@/lib/cart-ui";
import { cn } from "@/lib/utils";

export function CartNotification() {
  const { notificationOpen, setNotificationOpen, lastAddedImage } = useCartUI();
  
  if (!notificationOpen) return null;

  return (
    <div className="fixed top-24 right-4 z-[100] w-[320px] animate-in slide-in-from-right-full duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-border/50 p-4 flex flex-col gap-4 backdrop-blur-md bg-white/90">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden border">
               {lastAddedImage ? (
                 <img src={lastAddedImage} className="h-full w-full object-cover" alt="" />
               ) : (
                 <div className="h-full w-full flex items-center justify-center bg-emerald-50 text-emerald-600">
                   <Check className="h-5 w-5" />
                 </div>
               )}
            </div>
            <div>
               <h4 className="font-bold text-sm">Добавлено в корзину</h4>
               <p className="text-xs text-muted-foreground">Мы забронируем это для вас</p>
            </div>
          </div>
          <button onClick={() => setNotificationOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="flex gap-2">
           <Button 
             variant="outline" 
             size="sm" 
             className="flex-1 h-9 text-xs rounded-lg"
             onClick={() => setNotificationOpen(false)}
           >
             Продолжить
           </Button>
           <Button 
             size="sm" 
             className="flex-1 h-9 text-xs bg-black hover:bg-black/80 text-white rounded-lg"
             onClick={() => window.location.href = '/cart'}
           >
             Оформить <ArrowRight className="ml-1 h-3 w-3" />
           </Button>
        </div>
      </div>
    </div>
  );
}
