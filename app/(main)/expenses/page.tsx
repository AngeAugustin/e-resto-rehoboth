"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isVersementCategoryName } from "@/lib/versement-category";
import type { IExpense, IExpenseCategory, IExpensePaymentMethod } from "@/types";

export default function ExpensesPage() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();
  const can = ["directeur", "directrice", "gerant"].includes(session?.user?.role ?? "");
  const canDelete = ["directeur", "directrice"].includes(session?.user?.role ?? "");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<IExpense | undefined>();
  const [form, setForm] = useState({ label: "", category: "", amount: "", date: "", paymentMethod: "", comment: "" });
  const [file, setFile] = useState<File | null>(null);

  const { data: expensesData, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await fetch("/api/expenses")).json() as Promise<{ items: IExpense[]; stats: { totalAmount: number } }>,
    enabled: can,
  });
  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => (await fetch("/api/expense-categories")).json() as Promise<IExpenseCategory[]>,
    enabled: can,
  });
  const { data: methods } = useQuery({
    queryKey: ["expense-payment-methods"],
    queryFn: async () => (await fetch("/api/expense-payment-methods")).json() as Promise<IExpensePaymentMethod[]>,
    enabled: can,
  });

  const openForm = (e?: IExpense) => {
    setEdit(e);
    setForm({
      label: e?.label ?? "",
      category: typeof e?.category === "object" ? e.category._id : e?.category ?? "",
      amount: e ? String(e.amount) : "",
      date: e ? e.date.slice(0, 10) : "",
      paymentMethod: typeof e?.paymentMethod === "object" ? e.paymentMethod._id : e?.paymentMethod ?? "",
      comment: e?.comment ?? "",
    });
    setFile(null);
    setOpen(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    let attachmentUrl = edit?.attachmentUrl;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/media/upload", { method: "POST", body: fd });
      if (!up.ok) { toast({ variant: "destructive", title: "Justificatif" }); return; }
      attachmentUrl = (await up.json()).url;
    }
    const res = await fetch(edit ? `/api/expenses/${edit._id}` : "/api/expenses", {
      method: edit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount), attachmentUrl }),
    });
    if (!res.ok) { toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error }); return; }
    toast({ variant: "success", title: edit ? "Dépense modifiée" : "Dépense enregistrée" });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["accounting-snapshot"] });
    setOpen(false);
  };

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["accounting-snapshot"] }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  if (status === "loading") return <Skeleton className="h-96" />;
  if (!can) return <p className="py-20 text-center text-[#9CA3AF]">Accès refusé.</p>;

  return (
    <div>
      <PageHeader
        title="Dépenses"
        subtitle="Sorties générales (électricité, entretien, etc.)"
        action={<Button onClick={() => openForm()}><Plus className="h-4 w-4" />Nouvelle dépense</Button>}
      />

      <div className="mb-8 max-w-xs">
        {isLoading ? <Skeleton className="h-28" /> : (
          <StatsCard title="Total des dépenses" value={formatCurrency(expensesData?.stats.totalAmount ?? 0)} icon={Wallet} index={0} />
        )}
      </div>

      <div>
        <div className="lg:hidden">
          <MobileCardList>
            {(expensesData?.items ?? []).map((e) => (
              <MobileDataCard key={e._id}>
                <MobileDataCardHeader
                  title={e.label}
                  meta={formatDate(e.date)}
                />
                <MobileDataCardMeta
                  items={[
                    {
                      label: "Catégorie",
                      value: typeof e.category === "object" ? e.category.name : "—",
                    },
                    {
                      label: "Paiement",
                      value: typeof e.paymentMethod === "object" ? e.paymentMethod.name : "—",
                    },
                    { label: "Montant", value: formatCurrency(e.amount) },
                  ]}
                />
                <MobileDataCardActions>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl"
                    onClick={() => openForm(e)}
                    aria-label="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-xl border-rose-200/60 text-rose-600"
                      onClick={() => del.mutate(e._id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </MobileDataCardActions>
              </MobileDataCard>
            ))}
          </MobileCardList>
        </div>
        <div className="hidden min-w-0 overflow-x-auto rounded-xl border lg:block">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Paiement</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(expensesData?.items ?? []).map((e) => (
              <tr key={e._id} className="border-b">
                <td className="px-4 py-3 text-xs">{formatDate(e.date)}</td>
                <td className="px-4 py-3 font-medium">{e.label}</td>
                <td className="px-4 py-3">{typeof e.category === "object" ? e.category.name : "—"}</td>
                <td className="px-4 py-3">{typeof e.paymentMethod === "object" ? e.paymentMethod.name : "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(e.amount)}</td>
                <td className="px-4 py-3 text-right space-x-1">
                  <Button size="icon" variant="outline" onClick={() => openForm(e)}><Pencil className="h-4 w-4" /></Button>
                  {canDelete && <Button size="icon" variant="outline" className="text-rose-600" onClick={() => del.mutate(e._id)}><Trash2 className="h-4 w-4" /></Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit ? "Modifier" : "Nouvelle dépense"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5"><Label>Libellé</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <select className="flex h-10 w-full rounded-md border px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                <option value="">Sélectionner</option>
                {(categories ?? [])
                  .filter((c) => !isVersementCategoryName(c.name))
                  .map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Montant</Label><Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <select className="flex h-10 w-full rounded-md border px-3 text-sm" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} required>
                <option value="">Sélectionner</option>
                {(methods ?? []).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Commentaire</Label><Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Justificatif</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
