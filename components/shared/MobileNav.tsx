"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutGrid, LogOut, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useAppModule } from "@/components/shared/app-module-context";
import { isNavItemActive, moduleNavItems } from "@/lib/nav";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const PRIMARY_SLOT_COUNT = 4;

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { moduleId } = useAppModule();
  const role = session?.user?.role ?? "";
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleItems = moduleNavItems(moduleId, role);
  const activeItem = visibleItems.find((item) => isNavItemActive(pathname, item));
  const primaryItems = visibleItems.slice(0, PRIMARY_SLOT_COUNT);
  const overflowItems = visibleItems.slice(PRIMARY_SLOT_COUNT);
  const activeInOverflow = Boolean(
    activeItem && overflowItems.some((item) => item.href === activeItem.href)
  );
  const moreActive = moreOpen || activeInOverflow;

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#E5E5E5] bg-white/95 backdrop-blur-sm safe-area-inset-bottom">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(pathname, item);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1.5 py-2 transition-colors duration-150",
                  isActive ? "text-[#0D0D0D]" : "text-[#9CA3AF] active:bg-[#F5F5F5]"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-[#0D0D0D]")} />
                <span className="max-w-full truncate text-[10px] font-medium leading-tight">
                  {item.mobileLabel ?? item.label}
                </span>
                <span
                  className={cn(
                    "h-1 w-1 rounded-full transition-opacity",
                    isActive ? "bg-[#0D0D0D] opacity-100" : "opacity-0"
                  )}
                  aria-hidden
                />
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1.5 py-2 transition-colors duration-150",
              moreActive ? "text-[#0D0D0D]" : "text-[#9CA3AF] active:bg-[#F5F5F5]"
            )}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <LayoutGrid className={cn("h-5 w-5 shrink-0", moreActive && "text-[#0D0D0D]")} />
            <span className="max-w-full truncate text-[10px] font-medium leading-tight">Plus</span>
            <span
              className={cn(
                "h-1 w-1 rounded-full transition-opacity",
                moreActive ? "bg-[#0D0D0D] opacity-100" : "opacity-0"
              )}
              aria-hidden
            />
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[min(85vh,640px)] overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E5E5E5]" aria-hidden />
          <SheetHeader className="pr-8">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>
              Accédez à toutes les pages du module actuel.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-[#0D0D0D]/15 bg-[#0D0D0D] text-white"
                      : "border-[#E5E5E5] bg-white text-[#0D0D0D] active:bg-[#F5F5F5]"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 space-y-2 border-t border-[#E5E5E5] pt-4">
            <Link
              href="/profile"
              prefetch={false}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-[#E5E5E5] px-3 py-3 text-sm font-medium text-[#0D0D0D] transition-colors active:bg-[#F5F5F5]",
                pathname === "/profile" && "border-[#0D0D0D]/15 bg-[#F5F5F5]"
              )}
            >
              <UserRound className="h-4 w-4 shrink-0 opacity-70" />
              Mon profil
            </Link>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                void signOut({ callbackUrl: "/login" });
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-red-100 px-3 py-3 text-sm font-medium text-red-600 transition-colors active:bg-red-50"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Déconnexion
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
