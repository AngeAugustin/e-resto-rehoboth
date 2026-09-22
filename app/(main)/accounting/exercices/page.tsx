"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { CalendarRange, Eye, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  MobileCardList,
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardMeta,
} from "@/components/shared/MobileDataCard";
import { Badge } from "@/components/ui/badge";
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
import type { IExercice } from "@/types";

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type ExercicesResponse = {
  active: IExercice;
  items: IExercice[];
};

export default function AccountingExercicesPage() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();
  const can = ["directeur", "directrice"].includes(session?.user?.role ?? "");

  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [form, setForm] = useState({
    name: `Exercice ${new Date().getFullYear() + 1}`,
    startedAt: toDateTimeLocal(new Date()),
    openingBalance: "0",
    note: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["exercices"],
    queryFn: async () => {
      const res = await fetch("/api/exercices");
      if (!res.ok) throw new Error((await res.json()).error ?? "exercices");
      return res.json() as Promise<ExercicesResponse>;
    },
    enabled: can,
  });

  const closedItems = useMemo(
    () => (data?.items ?? []).filter((row) => !row.isActive),
    [data?.items]
  );

  const startForm = () => {
    const year = new Date().getFullYear();
    setForm({
      name: `Exercice ${year}`,
      startedAt: toDateTimeLocal(new Date()),
      openingBalance: "0",
      note: "",
    });
    setConfirmText("");
    setOpenForm(true);
  };

  const saveExercice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText.trim().toUpperCase() !== "NOUVEL EXERCICE") return;
    setSaving(true);
    const res = await fetch("/api/exercices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        startedAt: form.startedAt,
        openingBalance: Number(form.openingBalance),
        note: form.note,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({
      variant: "success",
      title: "Nouvel exercice ouvert",
      description: "Le système repart à zéro pour cet exercice.",
    });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["exercices"] }),
      qc.invalidateQueries({ queryKey: ["accounting-period"] }),
      qc.invalidateQueries({ queryKey: ["accounting-snapshot"] }),
      qc.invalidateQueries({ queryKey: ["sales"] }),
      qc.invalidateQueries({ queryKey: ["supplies"] }),
      qc.invalidateQueries({ queryKey: ["expenses"] }),
      qc.invalidateQueries({ queryKey: ["payroll"] }),
      qc.invalidateQueries({ queryKey: ["immobilisations"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["products-stock"] }),
      qc.invalidateQueries({ queryKey: ["cash-sessions"] }),
      qc.invalidateQueries({ queryKey: ["kitchen-orders"] }),
    ]);
    setOpenForm(false);
  };

  if (status === "loading" || isLoading) return <Skeleton className="h-96" />;
  if (!can) return <p className="py-20 text-center text-[#9CA3AF]">Accès réservé à la direction.</p>;

  const active = data?.active;
  const confirmOk = confirmText.trim().toUpperCase() === "NOUVEL EXERCICE";

  return (
    <div>
      <PageHeader
        title="Exercices"
        subtitle="Ouvrir un nouvel exercice archive l’ancien et remet ventes, stocks, caisse, dépenses, paie et immobilisations à zéro"
        action={
          <Button onClick={startForm}>
            <Plus className="h-4 w-4" />
            Nouvel exercice
          </Button>
        }
      />

      {active ? (
        <div className="mb-6 rounded-xl border border-[#E5E5E5] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-[#6B7280]">Exercice en cours</p>
              </div>
              <h2 className="text-lg font-semibold text-[#0D0D0D]">{active.name}</h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                Ouvert le {formatDate(active.startedAt)}
                {active.note ? ` — ${active.note}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-600">Actif</Badge>
              <Button asChild variant="outline" size="sm">
                <Link href={`/accounting/exercices/${active._id}`}>
                  <Eye className="h-3.5 w-3.5" />
                  Voir le détail
                </Link>
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#0D0D0D]">
            Solde d’ouverture : <span className="font-semibold">{formatCurrency(active.openingBalance)}</span>
          </p>
        </div>
      ) : null}

      <h3 className="mb-3 text-sm font-semibold text-[#0D0D0D]">Exercices clôturés</h3>
      {closedItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#E5E5E5] px-4 py-10 text-center text-sm text-[#9CA3AF]">
          Aucun exercice clôturé pour le moment.
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[#E5E5E5] bg-white md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-left text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Début</th>
                  <th className="px-4 py-3 font-medium">Clôture</th>
                  <th className="px-4 py-3 font-medium">Solde d’ouverture</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {closedItems.map((row) => (
                  <tr key={row._id} className="border-b border-[#F3F4F6] last:border-0">
                    <td className="px-4 py-3 font-medium text-[#0D0D0D]">{row.name}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{formatDate(row.startedAt)}</td>
                    <td className="px-4 py-3 text-[#6B7280]">
                      {row.closedAt ? formatDate(row.closedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#0D0D0D]">{formatCurrency(row.openingBalance)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/accounting/exercices/${row._id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          Consulter
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            <MobileCardList>
              {closedItems.map((row) => (
                <MobileDataCard key={row._id}>
                  <MobileDataCardHeader
                    title={row.name}
                    badge={<Badge variant="secondary">Clôturé</Badge>}
                  />
                  <MobileDataCardMeta
                    items={[
                      { label: "Début", value: formatDate(row.startedAt) },
                      { label: "Clôture", value: row.closedAt ? formatDate(row.closedAt) : "—" },
                      { label: "Ouverture", value: formatCurrency(row.openingBalance) },
                    ]}
                  />
                  <div className="mt-3">
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/accounting/exercices/${row._id}`}>
                        <Eye className="h-3.5 w-3.5" />
                        Consulter en lecture seule
                      </Link>
                    </Button>
                  </div>
                </MobileDataCard>
              ))}
            </MobileCardList>
          </div>
        </>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ouvrir un nouvel exercice</DialogTitle>
            <DialogDescription>
              L’exercice actuel sera archivé. Ventes, stocks, approvisionnements, caisse, cuisine,
              dépenses, paie et immobilisations repartent à zéro. Les catalogues (produits, menus,
              utilisateurs…) sont conservés.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveExercice} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="exercice-name">Nom</Label>
              <Input
                id="exercice-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exercice-start">Date de début</Label>
              <Input
                id="exercice-start"
                type="datetime-local"
                value={form.startedAt}
                onChange={(e) => setForm((f) => ({ ...f, startedAt: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exercice-balance">Solde d’ouverture (FCFA)</Label>
              <Input
                id="exercice-balance"
                type="number"
                min={0}
                step={1}
                value={form.openingBalance}
                onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exercice-note">Note (optionnel)</Label>
              <Textarea
                id="exercice-note"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Label htmlFor="exercice-confirm">
                Tapez <span className="font-semibold">NOUVEL EXERCICE</span> pour confirmer
              </Label>
              <Input
                id="exercice-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="NOUVEL EXERCICE"
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving || !confirmOk}>
                {saving ? "Ouverture…" : "Ouvrir l’exercice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
