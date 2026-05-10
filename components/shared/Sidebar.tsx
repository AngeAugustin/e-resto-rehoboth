"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  TruckIcon,
  ShoppingCart,
  Wallet,
  Users,
  UserRound,
  Table2,
  BarChart3,
  LogOut,
  Settings2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSidebarLayout } from "@/components/shared/sidebar-layout-context";
import { DEFAULT_LOGO_URL, DEFAULT_SOLUTION_NAME } from "@/lib/app-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const navItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ["directeur", "gerant"] },
  { href: "/products", label: "Produits", icon: Package, roles: ["directeur"] },
  { href: "/supplies", label: "Approvisionnements", icon: TruckIcon, roles: ["directeur", "gerant"] },
  { href: "/sales", label: "Ventes", icon: ShoppingCart, roles: ["directeur", "gerant"] },
  { href: "/cash", label: "Caisse", icon: Wallet, roles: ["directeur", "gerant"] },
  { href: "/waitresses", label: "Serveuses", icon: UserRound, roles: ["directeur"] },
  { href: "/tables", label: "Tables", icon: Table2, roles: ["directeur"] },
  { href: "/analytics", label: "Analytiques", icon: BarChart3, roles: ["directeur"] },
  { href: "/users", label: "Utilisateurs", icon: Users, roles: ["directeur"] },
  { href: "/settings", label: "Paramètres", icon: Settings2, roles: ["directeur"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { collapsed, toggleCollapsed } = useSidebarLayout();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const role = session?.user?.role ?? "";
  const name = session?.user?.name ?? "";
  const [firstName, lastName] = name.split(" ");
  const { data: branding } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return { logoUrl: DEFAULT_LOGO_URL, solutionName: DEFAULT_SOLUTION_NAME };
      return (await res.json()) as { logoUrl?: string; solutionName?: string };
    },
    staleTime: 60 * 1000,
  });
  const logoSrc = branding?.logoUrl || DEFAULT_LOGO_URL;
  const solutionName = branding?.solutionName || DEFAULT_SOLUTION_NAME;

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={cn(
        "fixed bottom-0 left-0 top-0 z-40 hidden min-h-screen flex-col bg-primary text-primary-foreground transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      {/* Logo + repli */}
      <div
        className={cn(
          "border-b border-white/10",
          collapsed ? "flex flex-col items-center gap-2 px-2 py-3" : "flex items-center gap-2 px-4 py-4"
        )}
      >
        <Image
          src={logoSrc}
          alt="Logo Rehoboth - Fleur de Dieu"
          width={40}
          height={40}
          className={cn("rounded-full bg-white object-contain", collapsed ? "h-9 w-9" : "h-10 w-10")}
          priority
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">{solutionName}</p>
            <p className="text-[10px] leading-tight text-white/40">Bar Restaurant</p>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className={cn(
            "h-9 w-9 shrink-0 text-white/70 hover:bg-white/10 hover:text-white",
            collapsed ? "" : "ml-auto"
          )}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          title={collapsed ? "Déplier le menu" : "Replier le menu"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-0.5 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              title={collapsed ? item.label : undefined}
            >
              <motion.div
                whileHover={collapsed ? undefined : { x: 2 }}
                className={cn(
                  "flex cursor-pointer items-center rounded-lg text-sm font-medium transition-all duration-150",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-white text-primary"
                    : "text-primary-foreground/60 hover:bg-white/10 hover:text-primary-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-indicator"
                        className="ml-auto size-1.5 shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className={cn("border-t border-white/10 py-4", collapsed ? "px-2" : "px-3")}>
        <div
          className={cn(
            "flex py-2",
            collapsed ? "flex-col items-center gap-2 px-0" : "items-center gap-2 px-3",
            !collapsed && "justify-between"
          )}
        >
          <Link
            href="/profile"
            prefetch={false}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-lg py-1 transition-colors hover:bg-white/10",
              collapsed ? "justify-center px-1" : "flex-1 px-1"
            )}
            title={collapsed ? "Mon profil" : undefined}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {getInitials(firstName ?? "U", lastName ?? "")}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{name}</p>
                <p className="text-[10px] capitalize text-white/40">{role}</p>
              </div>
            )}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer la déconnexion</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment vous déconnecter ? Vous devrez vous reconnecter pour accéder à
              l&apos;application.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setLogoutOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Se déconnecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
