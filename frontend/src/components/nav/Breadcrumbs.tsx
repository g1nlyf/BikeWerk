import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (!items?.length) return null;

  return (
    <nav aria-label="breadcrumb" className={cn("text-xs text-zinc-500", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${it.label}-${idx}`} className="flex items-center gap-1">
              {it.href && !isLast ? (
                <Link
                  to={it.href}
                  className="hover:text-zinc-900 transition-colors"
                >
                  {it.label}
                </Link>
              ) : (
                <span className={cn(isLast ? "text-zinc-900" : "")}>{it.label}</span>
              )}
              {!isLast && <span className="px-0.5">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

