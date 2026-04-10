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
  variant?: "default" | "dark" | "success" | "warning" | "danger";
  index?: number;
}

const variants = {
  default: "bg-white border-[#E5E5E5] text-[#0D0D0D]",
  dark: "bg-[#0D0D0D] border-[#0D0D0D] text-white",
  success: "bg-green-50 border-green-100 text-green-900",
  warning: "bg-amber-50 border-amber-100 text-amber-900",
  danger: "bg-red-50 border-red-100 text-red-900",
};

const iconVariants = {
  default: "bg-[#F5F5F5] text-[#0D0D0D]",
  dark: "bg-white/10 text-white",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  index = 0,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -2, shadow: "lg" }}
      className={cn(
        "rounded-xl border p-5 transition-all duration-200 hover:shadow-md cursor-default",
        variants[variant]
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconVariants[variant])}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              trend.value >= 0
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            )}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value}% {trend.label}
          </span>
        )}
      </div>
      <div>
        <p className={cn("text-2xl font-bold tracking-tight", variant === "dark" ? "text-white" : "text-[#0D0D0D]")}>
          {value}
        </p>
        <p className={cn("text-sm font-medium mt-0.5", variant === "dark" ? "text-white/70" : "text-[#6B7280]")}>
          {title}
        </p>
        {subtitle && (
          <p className={cn("text-xs mt-1", variant === "dark" ? "text-white/40" : "text-[#9CA3AF]")}>
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
}
