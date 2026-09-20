"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  /** Texte affiché dans le cercle à droite (ex. valeur courte). Sinon déduit de `value` si c'est un nombre. */
  ringDisplay?: string;
  variant?: "default" | "dark" | "success" | "warning" | "danger";
  index?: number;
}

const accent = {
  default: {
    icon: "bg-teal-700",
    bars: "bg-teal-700",
    ring: "border-teal-700 text-teal-700",
  },
  dark: {
    icon: "bg-teal-800",
    bars: "bg-teal-800",
    ring: "border-teal-800 text-teal-800",
  },
  success: {
    icon: "bg-emerald-600",
    bars: "bg-emerald-600",
    ring: "border-emerald-600 text-emerald-600",
  },
  warning: {
    icon: "bg-orange-500",
    bars: "bg-orange-500",
    ring: "border-orange-500 text-orange-500",
  },
  danger: {
    icon: "bg-red-600",
    bars: "bg-red-600",
    ring: "border-red-600 text-red-600",
  },
} as const;

function MiniBars({ className }: { className: string }) {
  const heights = ["h-2", "h-3.5", "h-5", "h-7"] as const;
  return (
    <div className="flex h-10 w-8 shrink-0 items-end justify-center gap-0.5">
      {heights.map((h, i) => (
        <div key={i} className={cn("w-1.5 rounded-sm", className, h)} />
      ))}
    </div>
  );
}

function RingBadge({ className, children }: { className: string; children: string }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-[0.625rem] font-bold tabular-nums leading-none",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  ringDisplay,
  variant = "default",
  index = 0,
}: StatsCardProps) {
  const a = accent[variant];
  const preferRing = index % 4 >= 2;
  const inferredRing =
    ringDisplay ??
    (typeof value === "number"
      ? String(value)
      : typeof value === "string" && value.length <= 5
        ? value
        : null);
  const useRing = preferRing && inferredRing !== null;
  const trendColor =
    trend && trend.value < 0 ? "text-red-600" : "text-[#28a745]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      className={cn(
        "flex cursor-default items-center gap-2.5 rounded-2xl bg-white p-3 shadow-[0_4px_6px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.04] transition-shadow duration-200 hover:shadow-[0_6px_12px_rgba(0,0,0,0.06)] sm:gap-4 sm:p-4"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white sm:h-11 sm:w-11",
          a.icon
        )}
      >
        <Icon className="h-4 w-4 stroke-[1.75] sm:h-5 sm:w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <p className="truncate text-base font-bold tracking-tight text-[#0D0D0D] sm:text-xl">
            {value}
          </p>
          {trend != null && (
            <span className={cn("text-[0.729rem] font-semibold tabular-nums", trendColor)}>
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
              {trend.label ? ` ${trend.label}` : ""}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[0.6875rem] font-medium text-[#6c757d] sm:text-[0.729rem]">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[0.625rem] text-[#9CA3AF]">{subtitle}</p>
        ) : null}
      </div>

      <div className="hidden sm:block">
        {useRing ? (
          <RingBadge className={a.ring}>{inferredRing!}</RingBadge>
        ) : (
          <MiniBars className={a.bars} />
        )}
      </div>
    </motion.div>
  );
}
