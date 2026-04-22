"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const normalizedStart = Math.max(1, end - 4);
  for (let p = normalizedStart; p <= end; p++) pages.push(p);
  return pages;
}

export function PaginationControls({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  className,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);
  const pages = getVisiblePages(safePage, totalPages);

  if (totalItems <= pageSize) return null;

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-sm text-[#6B7280]">
        Affichage <span className="font-medium text-[#0D0D0D]">{from}</span>-<span className="font-medium text-[#0D0D0D]">{to}</span> sur{" "}
        <span className="font-medium text-[#0D0D0D]">{totalItems}</span>
      </p>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages[0] && pages[0] > 1 && (
          <>
            <Button type="button" size="sm" variant="outline" className="h-8 min-w-8 px-2" onClick={() => onPageChange(1)}>
              1
            </Button>
            {pages[0] > 2 && <span className="px-1 text-[#9CA3AF]">…</span>}
          </>
        )}

        {pages.map((page) => (
          <Button
            key={page}
            type="button"
            size="sm"
            variant={page === safePage ? "default" : "outline"}
            className="h-8 min-w-8 px-2"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        ))}

        {pages[pages.length - 1] && pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="px-1 text-[#9CA3AF]">…</span>}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 min-w-8 px-2"
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}

        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
