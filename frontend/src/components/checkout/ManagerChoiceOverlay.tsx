"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";

export interface ManagerChoiceOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (choice: "auto" | "manager") => void;
}

export const ManagerChoiceOverlay: React.FC<ManagerChoiceOverlayProps> = ({ open, onOpenChange, onChoose }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle>Оформление заказа</DialogTitle>
        </DialogHeader>
        <Card className="p-4">
          <div className="space-y-4">
            <p className="text-base leading-relaxed">
              У нас уже есть свободный менеджер, который готов вам помочь!
            </p>
            <div className="grid gap-3">
              <TooltipProvider>
                <Button variant="default" className="w-full justify-between" onClick={() => onChoose("auto")}>
                  <span>Сразу выкупаем!</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>Менеджер не будет тревожить без повода; сразу начнём договариваться с продавцом. Свяжемся только в критических случаях и для инвойса.</TooltipContent>
                  </Tooltip>
                </Button>
                <Button variant="outline" className="w-full" onClick={() => onChoose("manager")}> 
                  <span>Мне нужна консультация менеджера</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>Поможем со всеми вопросами: подбор, детали, этапы и оформление.</TooltipContent>
                  </Tooltip>
                </Button>
              </TooltipProvider>
            </div>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerChoiceOverlay;