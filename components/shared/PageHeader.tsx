"use client";

import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-[#0D0D0D] sm:text-2xl">{title}</h1>
        <p className="mt-0.5 text-sm text-[#6B7280]">{subtitle}</p>
      </div>
      {action ? (
        <div className="w-full min-w-0 sm:w-auto sm:flex-shrink-0 [&>a]:w-full [&>button]:w-full sm:[&>a]:w-auto sm:[&>button]:w-auto">
          {action}
        </div>
      ) : null}
    </motion.div>
  );
}
