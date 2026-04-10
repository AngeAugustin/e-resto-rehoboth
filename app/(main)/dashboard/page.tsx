"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, ShoppingCart, AlertTriangle, Package } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { DashboardStats } from "@/types";

const DashboardCharts = dynamic(() => import("./DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  ),
});

async function fetchDashboard(): Promise<DashboardStats> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Bienvenue — ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatsCard
              title="Chiffre d'affaires"
              value={formatCurrency(data?.todayRevenue ?? 0)}
              subtitle="Aujourd'hui"
              icon={TrendingUp}
              variant="dark"
              index={0}
            />
            <StatsCard
              title="Ventes"
              value={data?.todaySalesCount ?? 0}
              subtitle="Aujourd'hui"
              icon={ShoppingCart}
              index={1}
            />
            <StatsCard
              title="Stock faible"
              value={data?.lowStockCount ?? 0}
              subtitle="Produits < 5 unités"
              icon={AlertTriangle}
              variant={data?.lowStockCount && data.lowStockCount > 0 ? "warning" : "default"}
              index={2}
            />
            <StatsCard
              title="Produits"
              value={data?.totalProducts ?? 0}
              subtitle="Dans le catalogue"
              icon={Package}
              index={3}
            />
          </>
        )}
      </div>

      {isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <DashboardCharts data={data} />
      )}
    </div>
  );
}
