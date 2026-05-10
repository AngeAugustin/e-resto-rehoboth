"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ShoppingCart, TrendingUp, Clock, CheckCircle2, Eye, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { StatsCard } from "@/components/shared/StatsCard";
import { PremiumTableShell, premiumTableSelectClass } from "@/components/shared/PremiumTableShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { ISale, SalesListResponse } from "@/types";
import { formatSaleTablesLine } from "@/lib/sale-tables";
import { CloseSaleDialog } from "@/components/sales/CloseSaleDialog";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

async function fetchSalesPage(page: number, pageSize: number): Promise<SalesListResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const res = await fetch(`/api/sales?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return (await res.json()) as SalesListResponse;
}

// ----------- Main Page -----------
export default function SalesPage() {
  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;
  const qc = useQueryClient();
  const [saleToClose, setSaleToClose] = useState<ISale | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<ISale | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const { data, isLoading } = useQuery({
    queryKey: ["sales", currentPage, pageSize],
    queryFn: () => fetchSalesPage(currentPage, pageSize),
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
  });

  const cancelSale = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Impossible d'annuler la commande");
      }
    },
    onSuccess: () => {
      toast({ variant: "success", title: "Commande annulée" });
      qc.invalidateQueries({ queryKey: ["sales"] });
      setSaleToCancel(null);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  const stats = data?.stats;
  const totalRevenue = stats?.totalRevenue ?? 0;
  const totalSales = stats?.totalSales ?? 0;
  const pendingSales = stats?.pendingSales ?? 0;
  const completedSales = stats?.completedSales ?? 0;
  const listItems = data?.items ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const listLoading = isLoading && !data;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

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
        {listLoading ? (
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
        <div className="mb-3 flex justify-end">
          <label className="inline-flex items-center gap-2 text-xs text-slate-500">
            Lignes par page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
              className={premiumTableSelectClass}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <PremiumTableShell
          title="Liste des ventes"
          isLoading={listLoading}
          empty={!listLoading && totalCount === 0}
          emptyMessage="Aucune vente enregistrée"
          skeletonRows={6}
          tableMinWidthClass="min-w-[960px]"
          skeletonColSpan={7}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-950/[0.025] text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <th className="whitespace-nowrap px-6 py-3.5 font-semibold">Date</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Tables</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Serveuse</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-center font-semibold">Articles</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right font-semibold">Total</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-center font-semibold">Statut</th>
                  <th className="min-w-[220px] whitespace-nowrap px-6 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/90">
                <AnimatePresence>
                  {listItems.map((sale) => {
                    const waitress = sale.waitress as { firstName: string; lastName: string };
                    return (
                      <motion.tr
                        key={sale._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group border-b border-transparent transition-colors duration-200 hover:bg-gradient-to-r hover:from-violet-500/[0.04] hover:via-transparent hover:to-cyan-500/[0.03]"
                      >
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full border border-slate-200/60 bg-slate-500/[0.08] px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {formatDateTime(sale.createdAt)}
                          </span>
                        </td>
                        <td
                          className="max-w-[200px] truncate px-4 py-4 font-medium text-slate-900"
                          title={formatSaleTablesLine(sale)}
                        >
                          {formatSaleTablesLine(sale)}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {waitress?.firstName} {waitress?.lastName}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center rounded-full border border-cyan-200/55 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-950/85">
                            {sale.items.length} article{sale.items.length > 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-slate-900">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {sale.status === "COMPLETED" ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200/60 bg-emerald-500/12 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 backdrop-blur-[2px]">
                              Clôturée
                            </span>
                          ) : sale.status === "CANCELLED" ? (
                            <span className="inline-flex items-center rounded-full border border-rose-200/60 bg-rose-500/12 px-2.5 py-0.5 text-xs font-semibold text-rose-900 backdrop-blur-[2px]">
                              Annulée
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-violet-200/60 bg-violet-500/12 px-2.5 py-0.5 text-xs font-semibold text-violet-900 backdrop-blur-[2px]">
                              En attente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5 opacity-95 transition group-hover:opacity-100">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm hover:border-violet-200 hover:bg-violet-500/8"
                              asChild
                            >
                              <Link href={`/sales/${sale._id}`}>
                                <Eye className="w-3.5 h-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Détails</span>
                              </Link>
                            </Button>
                            {sale.status === "PENDING" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm hover:border-violet-200 hover:bg-violet-500/8"
                                  asChild
                                >
                                  <Link href={`/sales/${sale._id}/edit`}>
                                    <Pencil className="w-3.5 h-3.5 sm:mr-1" />
                                    <span className="hidden sm:inline">Modifier</span>
                                  </Link>
                                </Button>
                                <Button size="sm" className="rounded-xl shadow-sm" onClick={() => setSaleToClose(sale)}>
                                  Clôturer
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl border-rose-200/60 bg-rose-500/[0.06] text-rose-600 shadow-sm backdrop-blur-sm hover:border-rose-300 hover:bg-rose-500/12"
                                  onClick={() => setSaleToCancel(sale)}
                                >
                                  Annuler
                                </Button>
                              </>
                            )}
                            {sale.status === "COMPLETED" && sale.change !== undefined && (
                              <span className="w-full text-right text-xs text-slate-400 sm:mt-0 sm:w-auto">
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
        </PremiumTableShell>
      </motion.div>

      <PaginationControls
        className="mt-6"
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={totalCount}
        onPageChange={setCurrentPage}
      />

      <CloseSaleDialog sale={saleToClose} onClose={() => setSaleToClose(null)} />

      <Dialog open={!!saleToCancel} onOpenChange={(open) => !open && setSaleToCancel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Annuler cette commande ?</DialogTitle>
            <DialogDescription>
              Cette commande est en attente de clôture. En l&apos;annulant, elle sera supprimée définitivement.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSaleToCancel(null)}>
              Retour
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelSale.isPending}
              onClick={() => {
                if (!saleToCancel?._id) return;
                cancelSale.mutate(saleToCancel._id);
              }}
            >
              {cancelSale.isPending ? "Annulation..." : "Confirmer l'annulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
