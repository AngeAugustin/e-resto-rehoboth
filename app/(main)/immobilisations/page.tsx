"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Building2, HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import {
  MobileCardList,
  MobileDataCard,
  MobileDataCardActions,
  MobileDataCardHeader,
  MobileDataCardMeta,
} from "@/components/shared/MobileDataCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { IImmobilisation } from "@/types";

type ImmobilisationsResponse = {
  items: IImmobilisation[];
  stats: { totalAmount: number; totalPaid: number; totalRemaining: number; count: number };
};

export default function ImmobilisationsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const qc = useQueryClient();
  const can = ["directeur", "directrice"].includes(session?.user?.role ?? "");

  const [assetOpen, setAssetOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<IImmobilisation | undefined>();
  const [assetForm, setAssetForm] = useState({ name: "", amount: "" });
  const [assetPendingDelete, setAssetPendingDelete] = useState<IImmobilisation | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["immobilisations"],
    queryFn: async () => (await fetch("/api/immobilisations")).json() as Promise<ImmobilisationsResponse>,
    enabled: can,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["immobilisations"] });
  };

  const openAssetForm = (asset?: IImmobilisation) => {
    setEditAsset(asset);
    setAssetForm({
      name: asset?.name ?? "",
      amount: asset ? String(asset.amount) : "",
    });
    setAssetOpen(true);
  };

  const saveAsset = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const res = await fetch(editAsset ? `/api/immobilisations/${editAsset._id}` : "/api/immobilisations", {
      method: editAsset ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: assetForm.name, amount: Number(assetForm.amount) }),
    });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({ variant: "success", title: editAsset ? "Immobilisation modifiée" : "Immobilisation créée" });
    invalidateAll();
    setAssetOpen(false);
  };

  const deleteAsset = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await fetch(`/api/immobilisations/${assetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      toast({ variant: "success", title: "Immobilisation supprimée" });
      setAssetPendingDelete(null);
      invalidateAll();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  if (status === "loading") return <Skeleton className="h-96" />;
  if (!can) return <p className="py-20 text-center text-[#9CA3AF]">Accès refusé.</p>;

  return (
    <div>
      <PageHeader
        title="Immobilisations"
        subtitle="Suivi des biens et des versements associés"
        action={
          <Button onClick={() => openAssetForm()}>
            <Plus className="h-4 w-4" />
            Nouvelle immobilisation
          </Button>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatsCard title="Montant total" value={formatCurrency(data?.stats.totalAmount ?? 0)} icon={Building2} index={0} />
            <StatsCard title="Versé" value={formatCurrency(data?.stats.totalPaid ?? 0)} icon={HandCoins} index={1} />
            <StatsCard title="Reste à payer" value={formatCurrency(data?.stats.totalRemaining ?? 0)} icon={Building2} index={2} />
          </>
        )}
      </div>

      <div>
        <div className="lg:hidden">
          <MobileCardList>
            {(data?.items ?? []).map((asset) => (
              <MobileDataCard key={asset._id}>
                <MobileDataCardHeader title={asset.name} meta={formatDate(asset.createdAt)} />
                <MobileDataCardMeta
                  items={[
                    { label: "Montant", value: formatCurrency(asset.amount) },
                    { label: "Versé", value: formatCurrency(asset.paidAmount) },
                    { label: "Reste", value: formatCurrency(asset.remainingAmount) },
                  ]}
                />
                <MobileDataCardActions>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => router.push(`/immobilisations/${asset._id}`)}
                  >
                    Versements
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl"
                    onClick={() => openAssetForm(asset)}
                    aria-label="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl border-rose-200/60 text-rose-600"
                    onClick={() => setAssetPendingDelete(asset)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </MobileDataCardActions>
              </MobileDataCard>
            ))}
          </MobileCardList>
        </div>

        <div className="hidden min-w-0 overflow-x-auto rounded-xl border lg:block">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-right">Versé</th>
                <th className="px-4 py-3 text-right">Reste</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((asset) => (
                <tr key={asset._id} className="border-b">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/immobilisations/${asset._id}`} className="hover:underline">
                      {asset.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(asset.amount)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(asset.paidAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(asset.remainingAmount)}</td>
                  <td className="space-x-1 px-4 py-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/immobilisations/${asset._id}`}>Versements</Link>
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => openAssetForm(asset)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-rose-600"
                      onClick={() => setAssetPendingDelete(asset)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && (data?.items?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Aucune immobilisation pour le moment.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editAsset ? "Modifier l'immobilisation" : "Nouvelle immobilisation"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveAsset} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={assetForm.name}
                onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Montant</Label>
              <Input
                type="number"
                min={0}
                value={assetForm.amount}
                onChange={(e) => setAssetForm({ ...assetForm, amount: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssetOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!assetPendingDelete}
        onOpenChange={(open) => !open && !deleteAsset.isPending && setAssetPendingDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;immobilisation ?</DialogTitle>
            <DialogDescription>
              {assetPendingDelete && (
                <>
                  Vous allez supprimer définitivement «{" "}
                  <span className="font-medium text-[#0D0D0D]">{assetPendingDelete.name}</span> ». Cette action est
                  irréversible. Si des versements sont liés, la suppression sera refusée.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssetPendingDelete(null)}
              disabled={deleteAsset.isPending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteAsset.isPending}
              onClick={() => {
                if (assetPendingDelete) deleteAsset.mutate(assetPendingDelete._id);
              }}
            >
              {deleteAsset.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
