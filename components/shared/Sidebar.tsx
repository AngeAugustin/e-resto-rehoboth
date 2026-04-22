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
  Users,
  UserRound,
  Table2,
  BarChart3,
  LogOut,
  Settings2,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  { href: "/products", label: "Produits", icon: Package, roles: ["directeur", "gerant"] },
  { href: "/supplies", label: "Approvisionnements", icon: TruckIcon, roles: ["directeur", "gerant"] },
  { href: "/sales", label: "Ventes", icon: ShoppingCart, roles: ["directeur", "gerant"] },
  { href: "/waitresses", label: "Serveuses", icon: UserRound, roles: ["directeur"] },
  { href: "/tables", label: "Tables", icon: Table2, roles: ["directeur"] },
  { href: "/analytics", label: "Analytiques", icon: BarChart3, roles: ["directeur"] },
  { href: "/users", label: "Utilisateurs", icon: Users, roles: ["directeur"] },
  { href: "/settings", label: "Paramètres", icon: Settings2, roles: ["directeur", "gerant"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
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
    <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-primary text-primary-foreground fixed left-0 top-0 bottom-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <Image
          src={logoSrc}
          alt="Logo Rehoboth - Fleur de Dieu"
          width={40}
          height={40}
          className="h-10 w-10 rounded-full object-contain bg-white"
          priority
        />
        <div>
          <p className="font-semibold text-sm leading-tight">{solutionName}</p>
          <p className="text-[10px] text-white/40 leading-tight">Bar Restaurant</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                  isActive
                    ? "bg-white text-primary"
                    : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/10"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
            {getInitials(firstName ?? "U", lastName ?? "")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{name}</p>
            <p className="text-[10px] text-white/40 capitalize">{role}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-shrink-0 text-white/60 hover:text-white hover:bg-white/10"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="w-4 h-4" />
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
