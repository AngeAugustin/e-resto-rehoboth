"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/shared/Sidebar";
import { MobileNav } from "@/components/shared/MobileNav";
import { SidebarLayoutProvider, useSidebarLayout } from "@/components/shared/sidebar-layout-context";
import { AppModuleProvider } from "@/components/shared/app-module-context";
import { AppModuleHeader } from "@/components/shared/AppModuleHeader";
import { RouteAccessGuard } from "@/components/shared/RouteAccessGuard";

function MainArea({ children }: { children: ReactNode }) {
  const { collapsed, hydrated } = useSidebarLayout();
  const isCollapsed = hydrated && collapsed;

  return (
    <main
      className={cn(
        "w-full min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] transition-[padding] duration-200 ease-out lg:pb-0",
        !hydrated || !collapsed ? "lg:pl-64" : "lg:pl-[calc(4.5rem+0.75rem)]"
      )}
    >
      <AppModuleHeader />
      <div
        className={cn(
          "mx-auto min-w-0 max-w-7xl px-3 py-4 sm:px-6 sm:py-6",
          isCollapsed
            ? "lg:mx-0 lg:w-full lg:min-w-0 lg:max-w-none lg:px-6 xl:px-8"
            : "lg:mx-auto lg:px-8"
        )}
      >
        <RouteAccessGuard>{children}</RouteAccessGuard>
      </div>
    </main>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarLayoutProvider>
      <AppModuleProvider>
        <div className="min-h-screen overflow-x-hidden bg-[#FAFAFA]">
          <Sidebar />
          <MobileNav />
          <MainArea>{children}</MainArea>
        </div>
      </AppModuleProvider>
    </SidebarLayoutProvider>
  );
}
