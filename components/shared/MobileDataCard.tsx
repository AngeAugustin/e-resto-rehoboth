"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Carte liste pour mobile / tablette — remplace une ligne de tableau. */
export function MobileDataCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm ring-1 ring-slate-950/[0.03]",
        onClick && "active:bg-slate-50 transition-colors",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function MobileDataCardHeader({
  title,
  meta,
  badge,
}: {
  title: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
        {meta ? <p className="mt-0.5 truncate text-xs text-slate-500">{meta}</p> : null}
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  );
}

export function MobileDataCardMeta({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{item.label}</dt>
          <dd className="mt-0.5 truncate text-sm font-medium text-slate-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MobileDataCardActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
      {children}
    </div>
  );
}

export function MobileCardList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 px-3 py-3 sm:px-4">{children}</div>;
}

export function MobileCardListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 px-3 py-3 sm:px-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-[7.5rem] animate-pulse rounded-2xl bg-slate-100/80"
        />
      ))}
    </div>
  );
}
