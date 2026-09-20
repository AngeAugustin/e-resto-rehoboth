"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileCardListSkeleton } from "@/components/shared/MobileDataCard";

export const premiumTableSelectClass =
  "h-8 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 text-xs font-medium text-slate-800 shadow-sm outline-none ring-violet-500/20 transition focus:border-violet-300 focus:ring-2";

type PremiumTableShellProps = {
  title: string;
  isLoading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  tableMinWidthClass?: string;
  skeletonColSpan?: number;
  /** Affiché sous le message lorsque `empty` est vrai (ex. bouton d’action). */
  emptyAction?: ReactNode;
  /**
           * Contenu alternatif mobile/tablette (< lg).
           * Si fourni : cartes en dessous de lg, tableau à partir de lg.
           */
  mobileContent?: ReactNode;
  children: React.ReactNode;
};

export function PremiumTableShell({
  title,
  isLoading = false,
  empty = false,
  emptyMessage = "Aucune donnée",
  skeletonRows = 6,
  tableMinWidthClass = "min-w-[860px]",
  skeletonColSpan = 8,
  emptyAction,
  mobileContent,
  children,
}: PremiumTableShellProps) {
  const hasMobile = mobileContent != null;

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.25)] backdrop-blur-sm ring-1 ring-slate-950/[0.04] sm:rounded-3xl">
      <div className="relative border-b border-slate-200/60 bg-gradient-to-r from-violet-500/[0.06] via-slate-50/40 to-cyan-500/[0.05] px-4 py-4 sm:px-6 sm:py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_120%_at_0%_0%,rgba(139,92,246,0.08),transparent_55%)]" />
        <div className="relative flex items-end justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">{title}</h2>
          {!hasMobile ? (
            <p className="hidden text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:block md:hidden">
              Glisser →
            </p>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <>
          {hasMobile ? (
            <div className="lg:hidden">
              <MobileCardListSkeleton rows={Math.min(skeletonRows, 5)} />
            </div>
          ) : null}
          <div
            className={
              hasMobile
                ? "hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain lg:block [-webkit-overflow-scrolling:touch]"
                : "min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
            }
          >
            <table className={`w-full border-collapse text-left text-sm ${tableMinWidthClass}`}>
              <tbody className="divide-y divide-slate-100/80">
                {Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 sm:px-6 sm:py-4" colSpan={skeletonColSpan}>
                      <Skeleton className="h-12 w-full rounded-xl bg-slate-100/70" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : empty ? (
        <div className="flex flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-14">
          <p className="text-sm text-slate-400">{emptyMessage}</p>
          {emptyAction ? <div className="mt-3">{emptyAction}</div> : null}
        </div>
      ) : (
        <>
          {hasMobile ? <div className="lg:hidden">{mobileContent}</div> : null}
          <div
            className={
              hasMobile
                ? "hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain lg:block [-webkit-overflow-scrolling:touch]"
                : "min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
            }
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
