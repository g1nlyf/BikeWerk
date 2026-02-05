"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0..100
  indicatorClassName?: string;
}

export function Progress({ value = 0, className, indicatorClassName, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("h-2 w-full overflow-hidden rounded bg-muted", className)}
      {...props}
    >
      <div
        className={cn("h-full w-full origin-left bg-primary", indicatorClassName)}
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  );
}

export default Progress;