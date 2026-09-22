"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ArrowLeft, Building2, HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
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
import type { IExpense, IExpensePaymentMethod, IImmobilisation } from "@/types";

type VersementsResponse = {
  immobilisation: IImmobilisation;
  items: IExpense[];
};

export default function ImmobilisationVersementsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const qc = useQueryClient();
  const can = ["directeur", "directrice"].includes(session?.user?.role ?? "");

  const [versementOpen, setVersementOpen] = useState(false);
  const [editVersement, setEditVersement] = useState<IExpense | undefined>();
  const [versementForm, setVersementForm] = useState({
    label: "",
    amount: "",
    date: "",
    paymentMethod: "",
    comment: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [versementPendingDelete, setVersementPendingDelete] = useState<IExpense | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["immobilisation-versements", id],
    queryFn: async () => {
      const res = await fetch(`/api/immobilisations/${id}/versements`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
      return res.json() as Promise<VersementsResponse>;
    },
    enabled: can && Boolean(id),
  });

  const { data: methods } = useQuery({
    queryKey: ["expense-payment-methods"],
    queryFn: async () => (await fetch("/api/expense-payment-methods")).json() as Promise<IExpensePaymentMethod[]>,
    enabled: can,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["immobilisations"] });
    qc.invalidateQueries({ queryKey: ["immobilisation-versements", id] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["accounting-snapshot"] });
  };

  const openVersementForm = (versement?: IExpense) => {
    setEditVersement(versement);
    setVersementForm({
      label: versement?.label ?? "",
      amount: versement ? String(versement.amount) : "",
      date: versement ? versement.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      paymentMethod:
        typeof versement?.paymentMethod === "object"
          ? versement.paymentMethod._id
          : versement?.paymentMethod ?? "",
      comment: versement?.comment ?? "",
    });
    setFile(null);
    setVersementOpen(true);
  };

  const saveVersement = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!id) return;

    let attachmentUrl = editVersement?.attachmentUrl;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/media/upload", { method: "POST", body: fd });
      if (!up.ok) {
        toast({ variant: "destructive", title: "Justificatif" });
        return;
      }
      attachmentUrl = (await up.json()).url;
    }

    const url = editVersement
      ? `/api/immobilisations/${id}/versements/${editVersement._id}`
      : `/api/immobilisations/${id}/versements`;
    const res = await fetch(url, {
      method: editVersement ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...versementForm,
        amount: Number(versementForm.amount),
        attachmentUrl,
      }),
    });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({ variant: "success", title: editVersement ? "Versement modifié" : "Versement enregistré" });
    invalidateAll();
    setVersementOpen(false);
  };

  const deleteVersement = useMutation({
    mutationFn: async (expenseId: string) => {
      const res = await fetch(`/api/immobilisations/${id}/versements/${expenseId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      toast({ variant: "success", title: "Versement supprimé" });
      setVersementPendingDelete(null);
      invalidateAll();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  if (status === "loading" || isLoading) return <Skeleton className="h-96" />;
  if (!can) return <p className="py-20 text-center text-[#9CA3AF]">Accès refusé.</p>;
  if (isError || !data?.immobilisation) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-[#9CA3AF]">Immobilisation introuvable.</p>
        <Button asChild variant="outline">
          <Link href="/immobilisations">Retour aux immobilisations</Link>
        </Button>
      </div>
    );
  }

  const asset = data.immobilisation;

  return (
    <div>
      <Button asChild variant="ghost" className="mb-4 -ml-2 gap-2 text-[#6B7280]">
        <Link href="/immobilisations">
          <ArrowLeft className="h-4 w-4" />
          Retour aux immobilisations
        </Link>
      </Button>

      <PageHeader
        title={`Versements — ${asset.name}`}
        subtitle="Chaque versement est compté comme une dépense et réduit le reste à payer"
        action={
          <Button disabled={asset.remainingAmount <= 0} onClick={() => openVersementForm()}>
            <Plus className="h-4 w-4" />
            Nouveau versement
          </Button>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatsCard title="Montant" value={formatCurrency(asset.amount)} icon={Building2} index={0} />
        <StatsCard title="Versé" value={formatCurrency(asset.paidAmount)} icon={HandCoins} index={1} />
        <StatsCard title="Reste à payer" value={formatCurrency(asset.remainingAmount)} icon={Building2} index={2} />
      </div>

      <div>
        <div className="lg:hidden">
          <MobileCardList>
            {data.items.map((v) => (
              <MobileDataCard key={v._id}>
                <MobileDataCardHeader title={v.label} meta={formatDate(v.date)} />
                <MobileDataCardMeta
                  items={[
                    {
                      label: "Paiement",
                      value: typeof v.paymentMethod === "object" ? v.paymentMethod.name : "—",
                    },
                    { label: "Montant", value: formatCurrency(v.amount) },
                  ]}
                />
                <MobileDataCardActions>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl"
                    onClick={() => openVersementForm(v)}
                    aria-label="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl border-rose-200/60 text-rose-600"
                    onClick={() => setVersementPendingDelete(v)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </MobileDataCardActions>
              </MobileDataCard>
            ))}
          </MobileCardList>
          {data.items.length === 0 ? (
            <p className="py-10 text-center text-slate-400">Aucun versement pour le moment.</p>
          ) : null}
        </div>

        <div className="hidden min-w-0 overflow-x-auto rounded-xl border lg:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Libellé</th>
                <th className="px-4 py-3">Paiement</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((v) => (
                <tr key={v._id} className="border-b">
                  <td className="px-4 py-3 text-xs">{formatDate(v.date)}</td>
                  <td className="px-4 py-3 font-medium">{v.label}</td>
                  <td className="px-4 py-3">
                    {typeof v.paymentMethod === "object" ? v.paymentMethod.name : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(v.amount)}</td>
                  <td className="space-x-1 px-4 py-3 text-right">
                    <Button size="icon" variant="outline" onClick={() => openVersementForm(v)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-rose-600"
                      onClick={() => setVersementPendingDelete(v)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Aucun versement pour le moment.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={versementOpen} onOpenChange={setVersementOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editVersement ? "Modifier le versement" : "Nouveau versement"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveVersement} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input
                value={versementForm.label}
                onChange={(e) => setVersementForm({ ...versementForm, label: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Montant</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={versementForm.amount}
                  onChange={(e) => setVersementForm({ ...versementForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={versementForm.date}
                  onChange={(e) => setVersementForm({ ...versementForm, date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <select
                className="flex h-10 w-full rounded-md border px-3 text-sm"
                value={versementForm.paymentMethod}
                onChange={(e) => setVersementForm({ ...versementForm, paymentMethod: e.target.value })}
                required
              >
                <option value="">Sélectionner</option>
                {(methods ?? []).map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Commentaire</Label>
              <Textarea
                value={versementForm.comment}
                onChange={(e) => setVersementForm({ ...versementForm, comment: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Justificatif</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVersementOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!versementPendingDelete}
        onOpenChange={(open) => !open && !deleteVersement.isPending && setVersementPendingDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le versement ?</DialogTitle>
            <DialogDescription>
              {versementPendingDelete && (
                <>
                  Vous allez supprimer définitivement le versement «{" "}
                  <span className="font-medium text-[#0D0D0D]">{versementPendingDelete.label}</span> » (
                  {formatCurrency(versementPendingDelete.amount)}). Cette action retirera aussi la dépense associée
                  de la comptabilité.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVersementPendingDelete(null)}
              disabled={deleteVersement.isPending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteVersement.isPending}
              onClick={() => {
                if (versementPendingDelete) deleteVersement.mutate(versementPendingDelete._id);
              }}
            >
              {deleteVersement.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
