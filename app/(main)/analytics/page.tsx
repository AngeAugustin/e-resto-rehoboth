"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { AnalyticsData } from "@/types";

const AnalyticsCharts = dynamic(() => import("./AnalyticsCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-6">
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  ),
});

async function fetchAnalytics(): Promise<AnalyticsData> {
  const res = await fetch("/api/analytics");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    enabled: session?.user?.role === "directeur",
    staleTime: 60 * 1000,
  });

  if (status === "loading") return <Skeleton className="h-96" />;
  if (session?.user?.role !== "directeur") {
    return <p className="text-center py-20 text-[#9CA3AF]">Accès réservé au Directeur</p>;
  }

  return (
    <div>
      <PageHeader title="Analytiques" subtitle="Visualisations avancées et tendances" />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ) : (
        <AnalyticsCharts data={data} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="mt-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Performance par Produit</CardTitle>
            <CardDescription>Détail complet — unités vendues et revenus</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F5F5F5]">
                      <th className="text-left py-3 px-3 text-xs font-medium text-[#9CA3AF]">#</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-[#9CA3AF]">Produit</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[#9CA3AF]">Unités vendues</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[#9CA3AF]">Revenus</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[#9CA3AF]">% du CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const products = data?.productRevenue ?? [];
                      const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
                      return products.map((product, index) => (
                        <tr
                          key={product.name}
                          className="border-b border-[#FAFAFA] hover:bg-[#FAFAFA] transition-colors"
                        >
                          <td className="py-3 px-3 text-[#9CA3AF] font-mono text-xs">
                            {String(index + 1).padStart(2, "0")}
                          </td>
                          <td className="py-3 px-3 font-medium text-[#0D0D0D]">{product.name}</td>
                          <td className="py-3 px-3 text-right text-[#374151]">{product.units}</td>
                          <td className="py-3 px-3 text-right font-semibold text-[#0D0D0D]">
                            {formatCurrency(product.revenue)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#0D0D0D] rounded-full"
                                  style={{
                                    width: `${totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[#6B7280] text-xs w-8 text-right">
                                {totalRevenue > 0
                                  ? ((product.revenue / totalRevenue) * 100).toFixed(1)
                                  : 0}
                                %
                              </span>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
