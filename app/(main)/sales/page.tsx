"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ShoppingCart, TrendingUp, Clock, CheckCircle2, Eye, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { ISale } from "@/types";
import { CloseSaleDialog } from "@/components/sales/CloseSaleDialog";

async function fetchSales(): Promise<ISale[]> {
  const res = await fetch("/api/sales");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

// ----------- Main Page -----------
export default function SalesPage() {
  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: fetchSales,
    refetchInterval: 30000,
  });

  const [saleToClose, setSaleToClose] = useState<ISale | null>(null);

  const totalRevenue = sales?.filter((s) => s.status === "COMPLETED").reduce((sum, s) => sum + s.totalAmount, 0) ?? 0;
  const totalSales = sales?.length ?? 0;
  const pendingSales = sales?.filter((s) => s.status === "PENDING").length ?? 0;
  const completedSales = sales?.filter((s) => s.status === "COMPLETED").length ?? 0;

  return (
    <div>
      <PageHeader
        title="Ventes"
        subtitle="Gérez les commandes et ventes"
        action={
          <Button asChild>
            <Link href="/sales/new">
              <Plus className="w-4 h-4" />
              Nouvelle vente
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatsCard title="Chiffre d'affaires" value={formatCurrency(totalRevenue)} icon={TrendingUp} variant="dark" index={0} />
            <StatsCard title="Total ventes" value={totalSales} icon={ShoppingCart} index={1} />
            <StatsCard title="En attente" value={pendingSales} icon={Clock} variant={pendingSales > 0 ? "warning" : "default"} index={2} />
            <StatsCard title="Clôturées" value={completedSales} icon={CheckCircle2} variant="success" index={3} />
          </>
        )}
      </div>

      {/* Sales Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Liste des ventes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : sales?.length === 0 ? (
              <p className="text-center py-12 text-[#9CA3AF]">Aucune vente enregistrée</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F5F5F5]">
                      <th className="text-left py-3 px-3 text-xs font-medium text-[#9CA3AF]">Date</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-[#9CA3AF]">Table</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-[#9CA3AF]">Serveuse</th>
                      <th className="text-center py-3 px-3 text-xs font-medium text-[#9CA3AF]">Articles</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[#9CA3AF]">Total</th>
                      <th className="text-center py-3 px-3 text-xs font-medium text-[#9CA3AF]">Statut</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[#9CA3AF] min-w-[200px]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {sales?.map((sale) => {
                        const waitress = sale.waitress as { firstName: string; lastName: string };
                        const table = sale.table as { number: number; name?: string };
                        return (
                          <motion.tr
                            key={sale._id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="border-b border-[#FAFAFA] hover:bg-[#FAFAFA] transition-colors"
                          >
                            <td className="py-3.5 px-3 text-[#6B7280]">
                              {formatDateTime(sale.createdAt)}
                            </td>
                            <td className="py-3.5 px-3 font-medium text-[#0D0D0D]">
                              {table?.name ?? `Table ${table?.number}`}
                            </td>
                            <td className="py-3.5 px-3 text-[#374151]">
                              {waitress?.firstName} {waitress?.lastName}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <Badge variant="secondary">{sale.items.length} article{sale.items.length > 1 ? "s" : ""}</Badge>
                            </td>
                            <td className="py-3.5 px-3 text-right font-semibold text-[#0D0D0D]">
                              {formatCurrency(sale.totalAmount)}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <Badge variant={sale.status === "COMPLETED" ? "success" : "pending"}>
                                {sale.status === "COMPLETED" ? "Clôturée" : "En attente"}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/sales/${sale._id}`}>
                                    <Eye className="w-3.5 h-3.5 sm:mr-1" />
                                    <span className="hidden sm:inline">Détails</span>
                                  </Link>
                                </Button>
                                {sale.status === "PENDING" && (
                                  <>
                                    <Button size="sm" variant="outline" asChild>
                                      <Link href={`/sales/${sale._id}/edit`}>
                                        <Pencil className="w-3.5 h-3.5 sm:mr-1" />
                                        <span className="hidden sm:inline">Modifier</span>
                                      </Link>
                                    </Button>
                                    <Button size="sm" variant="default" onClick={() => setSaleToClose(sale)}>
                                      Clôturer
                                    </Button>
                                  </>
                                )}
                                {sale.status === "COMPLETED" && sale.change !== undefined && (
                                  <span className="text-xs text-[#9CA3AF] w-full sm:w-auto text-right mt-1 sm:mt-0">
                                    Rendu : {formatCurrency(sale.change)}
                                  </span>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <CloseSaleDialog sale={saleToClose} onClose={() => setSaleToClose(null)} />
    </div>
  );
}
