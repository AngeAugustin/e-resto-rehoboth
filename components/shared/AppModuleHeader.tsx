"use client";

import { Wine, CookingPot, Calculator, Shield, Building2, CalendarRange } from "lucide-react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAppModule } from "@/components/shared/app-module-context";
import { type AppModuleId, visibleModules } from "@/lib/nav";
import { isDirectionRole } from "@/lib/roles";
import type { IExercice } from "@/types";

const ICONS = {
  immobilisations: Building2,
  bar: Wine,
  cuisine: CookingPot,
  paie: Calculator,
  administration: Shield,
} as const;

export function AppModuleHeader() {
  const { moduleId, setModuleId } = useAppModule();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const modules = visibleModules(role);
  const showExercice = isDirectionRole(role) || role === "gerant";

  const { data: exercices } = useQuery({
    queryKey: ["exercices"],
    queryFn: async () => {
      const res = await fetch("/api/exercices");
      if (!res.ok) return null;
      return (await res.json()) as { active: IExercice };
    },
    enabled: showExercice,
    staleTime: 60_000,
  });

  const activeName = exercices?.active?.name;

  if (modules.length <= 1 && !activeName) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E5E5] bg-white/95 backdrop-blur-sm">
      <div className="flex h-12 w-full items-center gap-2 px-3 sm:h-14 sm:px-6 lg:px-8">
        {modules.length > 1 ? (
          <nav
            aria-label="Modules de l'application"
            className="inline-flex min-w-0 max-w-2xl overflow-x-auto rounded-xl bg-[#F5F5F5] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {modules.map((mod) => {
              const Icon = ICONS[mod.id as AppModuleId];
              const selected = moduleId === mod.id;
              const short = mod.shortLabel ?? mod.label;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setModuleId(mod.id)}
                  className={cn(
                    "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-all sm:gap-2 sm:px-3 sm:text-sm",
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-[#6B7280] hover:bg-white hover:text-[#0D0D0D]"
                  )}
                  aria-current={selected ? "page" : undefined}
                  aria-label={mod.label}
                  title={mod.label}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate sm:hidden">{short}</span>
                  <span className="hidden truncate sm:inline">{mod.label}</span>
                </button>
              );
            })}
          </nav>
        ) : null}

        {activeName ? (
          isDirectionRole(role) ? (
            <Link
              href="/accounting/exercices"
              className="ml-auto inline-flex max-w-[40%] shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 sm:max-w-none sm:text-sm"
              title="Gérer les exercices"
            >
              <CalendarRange className="size-3.5 shrink-0" />
              <span className="truncate">{activeName}</span>
            </Link>
          ) : (
            <span className="ml-auto inline-flex max-w-[40%] shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm sm:max-w-none sm:text-sm">
              <CalendarRange className="size-3.5 shrink-0" />
              <span className="truncate">{activeName}</span>
            </span>
          )
        ) : null}
      </div>
    </header>
  );
}
