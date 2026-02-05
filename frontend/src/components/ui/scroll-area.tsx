import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

export const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ children, className, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={className} {...props}>
    <ScrollAreaPrimitive.Viewport>{children}</ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="flex touch-none select-none p-0.5">
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-muted-foreground/30" />
    </ScrollAreaPrimitive.Scrollbar>
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));

ScrollArea.displayName = "ScrollArea";