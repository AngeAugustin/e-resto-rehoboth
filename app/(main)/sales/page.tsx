"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ShoppingCart, TrendingUp, Clock, CheckCircle2, Eye, Pencil, Trash2, BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { StatsCard } from "@/components/shared/StatsCard";
import { PremiumTableShell, premiumTableSelectClass } from "@/components/shared/PremiumTableShell";
import {
  MobileCardList,
  MobileDataCard,
  MobileDataCardActions,
  MobileDataCardHeader,
  MobileDataCardMeta,
} from "@/components/shared/MobileDataCard";
import { VerifyTicketDialog } from "@/components/shared/VerifyTicketDialog";
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
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [saleToClose, setSaleToClose] = useState<ISale | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<ISale | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
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
  const canCancelSale = session?.user?.role !== "gerant";

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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Button type="button" variant="outline" className="w-full gap-1.5 sm:w-auto" onClick={() => setVerifyOpen(true)}>
              <BadgeCheck className="h-4 w-4" />
              Vérifier ticket
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/sales/new">
                <Plus className="w-4 h-4" />
                Nouvelle vente
              </Link>
            </Button>
          </div>
        }
      />

      <VerifyTicketDialog open={verifyOpen} onOpenChange={setVerifyOpen} module="bar" />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-4 sm:mb-8 lg:grid-cols-4">
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
          tableMinWidthClass="min-w-[720px]"
          skeletonColSpan={7}
          mobileContent={
            <MobileCardList>
              {listItems.map((sale) => {
                const waitress = sale.waitress as { firstName: string; lastName: string };
                const statusBadge =
                  sale.status === "COMPLETED" ? (
                    <span className="inline-flex rounded-full border border-emerald-200/60 bg-emerald-500/12 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                      Clôturée
                    </span>
                  ) : sale.status === "CANCELLED" ? (
                    <span className="inline-flex rounded-full border border-rose-200/60 bg-rose-500/12 px-2.5 py-0.5 text-xs font-semibold text-rose-900">
                      Annulée
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-violet-200/60 bg-violet-500/12 px-2.5 py-0.5 text-xs font-semibold text-violet-900">
                      En attente
                    </span>
                  );
                return (
                  <MobileDataCard key={sale._id}>
                    <MobileDataCardHeader
                      title={formatSaleTablesLine(sale)}
                      meta={formatDateTime(sale.createdAt)}
                      badge={statusBadge}
                    />
                    <MobileDataCardMeta
                      items={[
                        {
                          label: "Serveuse",
                          value: `${waitress?.firstName ?? ""} ${waitress?.lastName ?? ""}`.trim() || "—",
                        },
                        {
                          label: "Articles",
                          value: `${sale.items.length}`,
                        },
                        {
                          label: "Total",
                          value: formatCurrency(sale.totalAmount),
                        },
                        ...(sale.status === "COMPLETED" && sale.change !== undefined
                          ? [{ label: "Rendu", value: formatCurrency(sale.change) }]
                          : []),
                      ]}
                    />
                    <MobileDataCardActions>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-xl border-slate-200/80 bg-white/80 shadow-sm"
                        asChild
                      >
                        <Link href={`/sales/${sale._id}`} aria-label="Voir les détails">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {sale.status === "PENDING" && (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 rounded-xl border-slate-200/80 bg-white/80 shadow-sm"
                            asChild
                          >
                            <Link href={`/sales/${sale._id}/edit`} aria-label="Modifier la vente">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          {canCancelSale ? (
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 rounded-xl border-rose-200/60 bg-rose-500/[0.06] text-rose-600 shadow-sm"
                              aria-label="Annuler la vente"
                              onClick={() => setSaleToCancel(sale)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            className="ml-auto rounded-xl shadow-sm"
                            onClick={() => setSaleToClose(sale)}
                          >
                            Clôturer
                          </Button>
                        </>
                      )}
                    </MobileDataCardActions>
                  </MobileDataCard>
                );
              })}
            </MobileCardList>
          }
        >
          <div className="overflow-x-auto px-6">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-950/[0.025] text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <th className="w-0 whitespace-nowrap px-6 py-3 font-semibold">Date</th>
                  <th className="w-0 whitespace-nowrap px-6 py-3 font-semibold">Tables</th>
                  <th className="w-0 whitespace-nowrap px-6 py-3 font-semibold">Serveuse</th>
                  <th className="w-0 whitespace-nowrap px-6 py-3 text-center font-semibold">Articles</th>
                  <th className="w-0 whitespace-nowrap px-6 py-3 text-right font-semibold">Total</th>
                  <th className="w-0 whitespace-nowrap px-6 py-3 text-center font-semibold">Statut</th>
                  <th className="whitespace-nowrap px-6 py-3 text-left font-semibold">Actions</th>
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
                        <td className="w-0 whitespace-nowrap px-6 py-3">
                          <span className="inline-flex rounded-full border border-slate-200/60 bg-slate-500/[0.08] px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {formatDateTime(sale.createdAt)}
                          </span>
                        </td>
                        <td
                          className="w-0 whitespace-nowrap px-6 py-3 font-medium text-slate-900"
                          title={formatSaleTablesLine(sale)}
                        >
                          {formatSaleTablesLine(sale)}
                        </td>
                        <td className="w-0 whitespace-nowrap px-6 py-3 text-slate-600">
                          {waitress?.firstName} {waitress?.lastName}
                        </td>
                        <td className="w-0 whitespace-nowrap px-6 py-3 text-center">
                          <span className="inline-flex items-center rounded-full border border-cyan-200/55 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-950/85">
                            {sale.items.length} article{sale.items.length > 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="w-0 whitespace-nowrap px-6 py-3 text-right font-semibold text-slate-900">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                        <td className="w-0 whitespace-nowrap px-6 py-3 text-center">
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
                        <td className="px-6 py-3 text-left">
                          <div className="flex flex-wrap items-center justify-start gap-1 opacity-95 transition group-hover:opacity-100">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 rounded-xl border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm hover:border-violet-200 hover:bg-violet-500/8"
                              asChild
                            >
                              <Link href={`/sales/${sale._id}`} title="Détails" aria-label="Voir les détails">
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {sale.status === "PENDING" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9 rounded-xl border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm hover:border-violet-200 hover:bg-violet-500/8"
                                  asChild
                                >
                                  <Link href={`/sales/${sale._id}/edit`} title="Modifier" aria-label="Modifier la vente">
                                    <Pencil className="h-4 w-4" />
                                  </Link>
                                </Button>
                                {canCancelSale ? (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-9 w-9 rounded-xl border-rose-200/60 bg-rose-500/[0.06] text-rose-600 shadow-sm backdrop-blur-sm hover:border-rose-300 hover:bg-rose-500/12"
                                    title="Annuler"
                                    aria-label="Annuler la vente"
                                    onClick={() => setSaleToCancel(sale)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : null}
                                <Button size="sm" className="rounded-xl shadow-sm" onClick={() => setSaleToClose(sale)}>
                                  Clôturer
                                </Button>
                              </>
                            )}
                            {sale.status === "COMPLETED" && sale.change !== undefined && (
                              <span className="w-full text-left text-xs text-slate-400 sm:mt-0 sm:w-auto">
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
