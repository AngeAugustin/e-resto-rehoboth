"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  User,
  UtensilsCrossed,
  Calendar,
  Receipt,
  Banknote,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime, formatSalePaymentLabel } from "@/lib/utils";
import type { ISale } from "@/types";
import { formatSaleTablesLine } from "@/lib/sale-tables";
import { ProductThumb } from "@/components/sales/ProductThumb";
import { CloseSaleDialog } from "@/components/sales/CloseSaleDialog";
import { SaleReceiptPreview } from "@/components/sales/SaleReceiptPreview";
import { toast } from "@/hooks/use-toast";
import { SALE_CHANGE_PICKUP_DEADLINE_DAYS } from "@/lib/app-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

async function fetchSale(id: string): Promise<ISale> {
  const res = await fetch(`/api/sales/${id}`);
  if (!res.ok) throw new Error("fetch");
  return res.json();
}

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [saleForClose, setSaleForClose] = useState<ISale | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<ISale | null>(null);

  const { data: sale, isLoading, isError } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => fetchSale(id),
    enabled: Boolean(id),
  });

  const cancelSale = useMutation({
    mutationFn: async (saleId: string) => {
      const res = await fetch(`/api/sales/${saleId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Impossible d'annuler la commande");
      }
    },
    onSuccess: async () => {
      toast({ variant: "success", title: "Commande annulée" });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["sales"] }),
        qc.invalidateQueries({ queryKey: ["sale", id] }),
      ]);
      setSaleToCancel(null);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-8 pb-10 xl:flex-row xl:items-start xl:gap-10">
        <div className="min-w-0 flex-1 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full max-w-3xl" />
          <Skeleton className="h-64 w-full max-w-3xl" />
        </div>
        <div className="hidden w-full shrink-0 xl:block xl:w-[min(100%,340px)] 2xl:w-[360px]">
          <Skeleton className="ml-auto h-10 w-24 rounded-xl" />
          <Skeleton className="mx-auto mt-4 h-[420px] w-full max-w-[300px] rounded-sm" />
        </div>
      </div>
    );
  }

  if (isError || !sale) {
    return (
      <div className="py-16 text-center">
        <p className="text-[#6B7280] mb-4">Vente introuvable.</p>
        <Button asChild variant="outline">
          <Link href="/sales">Retour aux ventes</Link>
        </Button>
      </div>
    );
  }

  const waitress = sale.waitress as { firstName: string; lastName: string };
  const tablesLine = formatSaleTablesLine(sale);
  const tablesHeading =
    Array.isArray(sale.tables) && sale.tables.length > 1 ? "Tables" : "Table";
  const createdBy = sale.createdBy as { firstName?: string; lastName?: string };

  const totalMargin = sale.items.reduce((sum, item) => {
    if (item.unitCost == null) return sum;
    return sum + (item.total - item.unitCost * item.quantity);
  }, 0);

  return (
    <>
      <div className="flex w-full flex-col pb-10 xl:flex-row xl:items-start xl:gap-10">
        <div className="min-w-0 flex-1">
          <div className="max-w-3xl">
            <Link
              href="/sales"
              className="mb-6 inline-flex items-center gap-2 text-sm text-[#6B7280] transition-colors hover:text-[#0D0D0D]"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux ventes
            </Link>

            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold text-[#0D0D0D]">Détail de la vente</h1>
                  <Badge
                    variant={
                      sale.status === "COMPLETED"
                        ? "success"
                        : sale.status === "CANCELLED"
                          ? "destructive"
                          : "pending"
                    }
                  >
                    {sale.status === "COMPLETED"
                      ? "Clôturée"
                      : sale.status === "CANCELLED"
                        ? "Annulée"
                        : "En attente"}
                  </Badge>
                </div>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#6B7280]">
                  <Calendar className="h-4 w-4" />
                  {formatDateTime(sale.createdAt)}
                </p>
              </div>
              {sale.status === "PENDING" && (
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/sales/${id}/edit`}>Modifier</Link>
                  </Button>
                  <Button onClick={() => setSaleForClose(sale)}>Clôturer la vente</Button>
                  <Button
                    variant="outline"
                    className="border-[#F2D7D7] text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setSaleToCancel(sale)}
                  >
                    Annuler
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-6">
        <Card className="border-[#E5E5E5]">
          <CardHeader>
            <CardTitle className="text-base">Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F5F5]">
                  <User className="w-4 h-4 text-[#0D0D0D]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#9CA3AF]">Serveuse</p>
                  <p className="truncate font-medium text-[#0D0D0D]">
                    {waitress?.firstName} {waitress?.lastName}
                  </p>
                </div>
              </div>
              <div className="hidden h-10 w-px shrink-0 bg-[#E5E5E5] sm:block" />
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F5F5]">
                  <UtensilsCrossed className="w-4 h-4 text-[#0D0D0D]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#9CA3AF]">{tablesHeading}</p>
                  <p className="truncate font-medium text-[#0D0D0D]">{tablesLine}</p>
                </div>
              </div>
            </div>
            {(createdBy?.firstName || createdBy?.lastName) && (
              <p className="text-xs text-[#9CA3AF] pt-2 border-t border-[#F5F5F5]">
                Enregistré par {createdBy.firstName} {createdBy.lastName}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E5E5E5]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Articles
            </CardTitle>
            <CardDescription>{sale.items.length} ligne{sale.items.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-[#F5F5F5]">
              {sale.items.map((item, idx) => {
                const prod = item.product as { name?: string; image?: string };
                const name = prod?.name ?? "Produit";
                return (
                  <li key={idx} className="flex items-center gap-4 px-6 py-4">
                    <ProductThumb imageUrl={prod?.image} name={name} sizeClass="h-14 w-14" variant="light" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#0D0D0D]">{name}</p>
                      <p className="text-xs text-[#6B7280]">
                        Prix marché {formatCurrency(item.unitPrice)} × {item.quantity}
                        {item.unitCost != null && (
                          <span className="block text-[#9CA3AF] mt-0.5">
                            Coût {formatCurrency(item.unitCost)} / u. · Marge{" "}
                            {formatCurrency(item.total - item.unitCost * item.quantity)}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="font-semibold text-[#0D0D0D] shrink-0">{formatCurrency(item.total)}</p>
                  </li>
                );
              })}
            </ul>
            <div className="space-y-2 px-6 py-4 bg-[#FAFAFA] border-t border-[#E5E5E5]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#0D0D0D]">Total</span>
                <span className="text-xl font-bold text-[#0D0D0D]">{formatCurrency(sale.totalAmount)}</span>
              </div>
              {sale.items.some((i) => i.unitCost != null) && (
                <div className="flex items-center justify-between text-sm border-t border-[#E5E5E5] pt-2">
                  <span className="text-[#6B7280]">Marge sur commande</span>
                  <span className="font-semibold text-green-800">{formatCurrency(totalMargin)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {sale.status === "COMPLETED" && sale.amountPaid !== undefined && (
          <Card className="border-[#E5E5E5]">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Paiement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between gap-4 text-sm">
                <span className="shrink-0 text-[#6B7280]">Mode de paiement</span>
                <span className="min-w-0 text-right font-medium text-[#0D0D0D]">
                  {formatSalePaymentLabel(sale.paymentMethod)}
                </span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="shrink-0 text-[#6B7280]">Montant remis</span>
                <span className="font-medium text-[#0D0D0D]">{formatCurrency(sale.amountPaid)}</span>
              </div>
              {sale.change !== undefined && sale.change > 0 && sale.changeReturnedAck !== false && (
                <div className="flex justify-between items-center rounded-lg bg-green-50 px-4 py-3">
                  <span className="text-sm font-medium text-green-900 flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    Monnaie rendue au client
                  </span>
                  <span className="font-bold text-green-800">{formatCurrency(sale.change)}</span>
                </div>
              )}
              {sale.change !== undefined && sale.change > 0 && sale.changeReturnedAck === false && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-semibold text-amber-900">Reliquat non encore perçu</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/95">
                    Montant à rendre au client : <span className="font-bold">{formatCurrency(sale.change)}</span>.{" "}
                    {SALE_CHANGE_PICKUP_DEADLINE_DAYS === 1 ? (
                      <>Le client dispose d&apos;un jour calendaire pour venir récupérer cette somme à l&apos;établissement.</>
                    ) : (
                      <>
                        Le client dispose de {SALE_CHANGE_PICKUP_DEADLINE_DAYS} jours calendaires pour venir récupérer
                        cette somme à l&apos;établissement.
                      </>
                    )}{" "}
                    Passé ce délai, le reliquat n&apos;est plus remboursable (voir ticket).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
            </div>
          </div>
        </div>

        <aside className="mt-10 w-full shrink-0 self-start xl:mt-0 xl:w-[min(100%,340px)] 2xl:w-[360px] xl:sticky xl:top-6">
          <SaleReceiptPreview sale={sale} />
        </aside>
      </div>

      <CloseSaleDialog sale={saleForClose} onClose={() => setSaleForClose(null)} />
      <Dialog open={!!saleToCancel} onOpenChange={(open) => !open && setSaleToCancel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Annuler cette commande ?</DialogTitle>
            <DialogDescription>
              Cette commande est en attente de clôture. En l&apos;annulant, elle reste visible dans la liste avec le
              statut <span className="font-medium text-[#0D0D0D]">Annulée</span>.
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
    </>
  );
}
