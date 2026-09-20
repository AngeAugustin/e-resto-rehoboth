"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Wallet, Eye, X, Banknote } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYROLL_TYPE_LABEL, payrollBonuses } from "@/lib/payroll";
import type { ICook, IJobTitle, IKitchenWaitress, IPayroll, IUser, IWaitress, PayrollBeneficiaryType } from "@/types";

function personName(p: IPayroll): string {
  const n = (o?: { firstName?: string; lastName?: string } | string) =>
    typeof o === "object" && o ? `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() : "";
  if (p.beneficiaryType === "WAITRESS") return n(p.waitress as { firstName?: string; lastName?: string }) || "—";
  if (p.beneficiaryType === "KITCHEN_WAITRESS") return n(p.kitchenWaitress as { firstName?: string; lastName?: string }) || "—";
  if (p.beneficiaryType === "COOK") return n(p.cook as { firstName?: string; lastName?: string }) || "—";
  return n(p.user as { firstName?: string; lastName?: string }) || "—";
}

function personIdOf(p: IPayroll): string {
  const id = (v: unknown) => (typeof v === "string" ? v : (v as { _id?: string })?._id ?? "");
  if (p.beneficiaryType === "WAITRESS") return id(p.waitress);
  if (p.beneficiaryType === "KITCHEN_WAITRESS") return id(p.kitchenWaitress);
  if (p.beneficiaryType === "COOK") return id(p.cook);
  return id(p.user);
}

type BonusDraft = { key: string; name: string; amount: string };

function newBonusRow(): BonusDraft {
  return { key: `${Date.now()}-${Math.random()}`, name: "", amount: "" };
}

export default function PayrollPage() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();
  const can = ["directeur", "directrice"].includes(session?.user?.role ?? "");
  const isDirector = session?.user?.role === "directeur";
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<IPayroll | undefined>();
  const [type, setType] = useState<PayrollBeneficiaryType>("WAITRESS");
  const [personId, setPersonId] = useState("");
  const [hasBonus, setHasBonus] = useState(false);
  const [bonuses, setBonuses] = useState<BonusDraft[]>([newBonusRow()]);
  const [formLoading, setFormLoading] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pendingDeleteSlip, setPendingDeleteSlip] = useState<IPayroll | null>(null);
  const [pendingPaySlip, setPendingPaySlip] = useState<IPayroll | null>(null);
  const [pendingSlipSave, setPendingSlipSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: payrollData, isLoading } = useQuery({
    queryKey: ["payroll"],
    queryFn: async () => (await fetch("/api/payroll")).json() as Promise<{ items: IPayroll[]; stats: { totalAmount: number; count: number } }>,
    enabled: can,
  });
  const { data: titles } = useQuery({ queryKey: ["job-titles"], queryFn: async () => (await fetch("/api/job-titles")).json() as Promise<IJobTitle[]>, enabled: can });
  const { data: waitresses } = useQuery({ queryKey: ["waitresses"], queryFn: async () => (await fetch("/api/waitresses")).json() as Promise<IWaitress[]>, enabled: can });
  const { data: kitchenWaitresses } = useQuery({
    queryKey: ["kitchen-waitresses"],
    queryFn: async () => (await fetch("/api/kitchen-waitresses")).json() as Promise<IKitchenWaitress[]>,
    enabled: can,
  });
  const { data: cooks } = useQuery({ queryKey: ["cooks"], queryFn: async () => (await fetch("/api/cooks")).json() as Promise<ICook[]>, enabled: can });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: async () => (await fetch("/api/users")).json() as Promise<IUser[]>, enabled: can });

  const people = useMemo(() => {
    if (type === "WAITRESS") return (waitresses ?? []).map((w) => ({ id: w._id, label: `${w.firstName} ${w.lastName}` }));
    if (type === "KITCHEN_WAITRESS") return (kitchenWaitresses ?? []).map((w) => ({ id: w._id, label: `${w.firstName} ${w.lastName}` }));
    if (type === "COOK") return (cooks ?? []).map((w) => ({ id: w._id, label: `${w.firstName} ${w.lastName}` }));
    return (users ?? []).filter((u) => u.role === "gerant" && u.isActive !== false).map((u) => ({ id: u._id, label: `${u.firstName} ${u.lastName}` }));
  }, [type, waitresses, kitchenWaitresses, cooks, users]);

  const salaryForType = (t: PayrollBeneficiaryType) => titles?.find((x) => x.beneficiaryType === t);
  const baseSalary = salaryForType(type)?.salary ?? 0;
  const bonusesTotal = hasBonus
    ? bonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
    : 0;
  const totalAmount = baseSalary + bonusesTotal;

  const applyType = (next: PayrollBeneficiaryType) => {
    setType(next);
  };

  const populateSlipForm = (p?: IPayroll) => {
    const nextType = p?.beneficiaryType ?? "WAITRESS";
    setType(nextType);
    setPersonId(p ? personIdOf(p) : "");
    const existing = p ? payrollBonuses(p) : [];
    setHasBonus(existing.length > 0);
    setBonuses(
      existing.length > 0
        ? existing.map((b) => ({ key: `${b.name}-${b.amount}`, name: b.name, amount: String(b.amount) }))
        : [newBonusRow()]
    );
    setPeriodStart(p ? p.periodStart.slice(0, 10) : "");
    setPeriodEnd(p ? p.periodEnd.slice(0, 10) : "");
    setPaidAt(p ? p.paidAt.slice(0, 10) : "");
    setComment(p?.comment ?? "");
    setFile(null);
  };

  const openCreate = async (p?: IPayroll) => {
    if (p?.isPaid) {
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description: "Cette fiche est payée et ne peut plus être modifiée.",
      });
      return;
    }
    setEdit(p);
    setOpen(true);
    setFormLoading(Boolean(p?._id));
    let slip = p;
    if (p?._id) {
      const res = await fetch(`/api/payroll/${p._id}`);
      if (res.ok) {
        slip = (await res.json()) as IPayroll;
        setEdit(slip);
      }
    }
    populateSlipForm(slip);
    setFormLoading(false);
  };

  const onPerson = (id: string) => {
    setPersonId(id);
  };

  const commitPayroll = async () => {
    setSaving(true);
    let attachmentUrl = edit?.attachmentUrl;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/media/upload", { method: "POST", body: fd });
      if (!up.ok) {
        setSaving(false);
        toast({ variant: "destructive", title: "Justificatif", description: "Upload impossible" });
        return;
      }
      attachmentUrl = (await up.json()).url;
    }
    const payload = {
      beneficiaryType: type,
      personId,
      jobTitle: salaryForType(type)?._id,
      hasBonus,
      bonuses: hasBonus
        ? bonuses.map((b) => ({ name: b.name.trim(), amount: Number(b.amount) }))
        : [],
      periodStart,
      periodEnd,
      paidAt,
      comment,
      attachmentUrl,
    };
    const res = await fetch(edit ? `/api/payroll/${edit._id}` : "/api/payroll", {
      method: edit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({ variant: "success", title: edit ? "Fiche mise à jour" : "Paie enregistrée" });
    qc.invalidateQueries({ queryKey: ["payroll"] });
    if (edit?._id) qc.invalidateQueries({ queryKey: ["payroll", edit._id] });
    setPendingSlipSave(false);
    setOpen(false);
  };

  const savePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (edit) {
      setPendingSlipSave(true);
      return;
    }
    await commitPayroll();
  };

  const deleteSlip = async (id: string) => {
    setSaving(true);
    const res = await fetch(`/api/payroll/${id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({ variant: "success", title: "Fiche supprimée" });
    qc.invalidateQueries({ queryKey: ["payroll"] });
    setPendingDeleteSlip(null);
  };

  const markSlipPaid = async (p: IPayroll) => {
    setSaving(true);
    const res = await fetch(`/api/payroll/${p._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_paid" }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({ variant: "success", title: "Fiche marquée comme payée" });
    qc.invalidateQueries({ queryKey: ["payroll"] });
    qc.invalidateQueries({ queryKey: ["payroll", p._id] });
    setPendingPaySlip(null);
  };

  if (status === "loading") return <Skeleton className="h-96" />;
  if (!can) return <p className="py-20 text-center text-[#9CA3AF]">Accès réservé à la direction.</p>;

  return (
    <div>
      <PageHeader
        title="Paie"
        subtitle="Salaires des serveuses, cuisinières et gérant(e)"
        action={<Button onClick={() => openCreate()}><Plus className="h-4 w-4" />Nouvelle fiche</Button>}
      />
      <div className="mb-6 max-w-xs">
        {isLoading ? <Skeleton className="h-28" /> : <StatsCard title="Total versé" value={formatCurrency(payrollData?.stats.totalAmount ?? 0)} icon={Wallet} index={0} />}
      </div>
      <div>
        <div className="lg:hidden">
          <MobileCardList>
            {(payrollData?.items ?? []).map((p) => (
              <MobileDataCard key={p._id}>
                <MobileDataCardHeader
                  title={personName(p)}
                  badge={
                    <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {PAYROLL_TYPE_LABEL[p.beneficiaryType]}
                    </span>
                  }
                />
                <MobileDataCardMeta
                  items={[
                    {
                      label: "Période",
                      value: `${formatDate(p.periodStart)} → ${formatDate(p.periodEnd)}`,
                    },
                    { label: "Montant", value: formatCurrency(p.amount) },
                    {
                      label: "Statut",
                      value: p.isPaid ? (
                        <span className="inline-flex rounded-full border border-emerald-200/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90">
                          Payée
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-200/55 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-950/80">
                          À payer
                        </span>
                      ),
                    },
                  ]}
                />
                <MobileDataCardActions>
                  {!p.isPaid && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-xl"
                      title="Marquer comme payée"
                      aria-label={`Payer ${personName(p)}`}
                      onClick={() => setPendingPaySlip(p)}
                    >
                      <Banknote className="h-4 w-4" />
                    </Button>
                  )}
                  <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-xl" asChild>
                    <Link href={`/payroll/${p._id}`} title="Aperçu de la fiche" aria-label="Aperçu de la fiche de paie">
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  {!p.isPaid && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-xl"
                      onClick={() => openCreate(p)}
                      aria-label={`Modifier ${personName(p)}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {isDirector && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-xl border-rose-200/60 text-rose-600"
                      onClick={() => setPendingDeleteSlip(p)}
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
                  <th className="px-4 py-3">Bénéficiaire</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Période</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3">Payé le</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(payrollData?.items ?? []).map((p) => (
                  <tr key={p._id} className="border-b">
                    <td className="px-4 py-3 font-medium">{personName(p)}</td>
                    <td className="px-4 py-3">{PAYROLL_TYPE_LABEL[p.beneficiaryType]}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(p.paidAt)}</td>
                    <td className="px-4 py-3">
                      {p.isPaid ? (
                        <span className="inline-flex rounded-full border border-emerald-200/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90">
                          Payée
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-200/55 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-950/80">
                          À payer
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {!p.isPaid && (
                        <Button
                          size="icon"
                          variant="outline"
                          title="Marquer comme payée"
                          aria-label={`Payer ${personName(p)}`}
                          onClick={() => setPendingPaySlip(p)}
                        >
                          <Banknote className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="outline" asChild>
                        <Link href={`/payroll/${p._id}`} title="Aperçu de la fiche" aria-label="Aperçu de la fiche de paie">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {!p.isPaid && (
                        <Button size="icon" variant="outline" onClick={() => openCreate(p)} aria-label={`Modifier ${personName(p)}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {isDirector && <Button size="icon" variant="outline" className="text-rose-600" onClick={() => setPendingDeleteSlip(p)}><Trash2 className="h-4 w-4" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit ? "Modifier la fiche" : "Nouvelle fiche de paie"}</DialogTitle></DialogHeader>
          {formLoading ? (
            <div className="space-y-3 py-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
          <form onSubmit={savePayroll} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                className="flex h-10 w-full rounded-md border px-3 text-sm"
                value={type}
                onChange={(e) => {
                  const next = e.target.value as PayrollBeneficiaryType;
                  setPersonId("");
                  applyType(next);
                }}
              >
                {Object.entries(PAYROLL_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Bénéficiaire</Label>
              <select className="flex h-10 w-full rounded-md border px-3 text-sm" value={personId} onChange={(e) => onPerson(e.target.value)} required>
                <option value="">Sélectionner</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Du</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label>Au</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Salaire (fonction)</Label>
              <Input type="text" value={formatCurrency(baseSalary)} readOnly disabled className="bg-slate-50 font-semibold" />
              {!salaryForType(type) ? (
                <p className="text-xs text-amber-600">Aucun salaire défini pour cette fonction. Configurez-le dans Comptabilité → Fonctions.</p>
              ) : null}
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border"
                  checked={hasBonus}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasBonus(checked);
                    if (checked) {
                      setBonuses((rows) => (rows.length > 0 ? rows : [newBonusRow()]));
                    } else {
                      setBonuses([newBonusRow()]);
                    }
                  }}
                />
                Ajouter un bonus
              </label>
              {hasBonus ? (
                <div className="space-y-3">
                  {bonuses.map((bonus, index) => (
                    <div key={bonus.key} className="space-y-2 rounded-md border border-dashed p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Bonus {index + 1}</span>
                        {bonuses.length > 1 ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-rose-600"
                            onClick={() => setBonuses((rows) => rows.filter((row) => row.key !== bonus.key))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label>Nom</Label>
                          <Input
                            value={bonus.name}
                            onChange={(e) =>
                              setBonuses((rows) =>
                                rows.map((row) => (row.key === bonus.key ? { ...row, name: e.target.value } : row))
                              )
                            }
                            placeholder="Ex. Prime performance"
                            required={hasBonus}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Montant</Label>
                          <Input
                            type="number"
                            min={0}
                            value={bonus.amount}
                            onChange={(e) =>
                              setBonuses((rows) =>
                                rows.map((row) => (row.key === bonus.key ? { ...row, amount: e.target.value } : row))
                              )
                            }
                            required={hasBonus}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setBonuses((rows) => [...rows, newBonusRow()])}>
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter un autre bonus
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-600">Net versé</span>
              <span className="text-base font-bold">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="space-y-1.5"><Label>Date de paiement</Label><Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Commentaire</Label><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Justificatif</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>Enregistrer</Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pendingSlipSave} onOpenChange={(v) => !v && !saving && setPendingSlipSave(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer la modification</DialogTitle>
            <DialogDescription>
              Enregistrer les changements de la fiche de paie de {edit ? personName(edit) : "ce bénéficiaire"} ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingSlipSave(false)} disabled={saving}>Annuler</Button>
            <Button type="button" onClick={() => commitPayroll()} disabled={saving}>{saving ? "Enregistrement…" : "Confirmer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDeleteSlip} onOpenChange={(v) => !v && !saving && setPendingDeleteSlip(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer cette fiche ?</DialogTitle>
            <DialogDescription>
              Cette action est définitive. La fiche de {pendingDeleteSlip ? personName(pendingDeleteSlip) : "ce bénéficiaire"}
              {pendingDeleteSlip ? ` (${formatCurrency(pendingDeleteSlip.amount)})` : ""} sera retirée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingDeleteSlip(null)} disabled={saving}>Annuler</Button>
            <Button type="button" variant="destructive" onClick={() => pendingDeleteSlip && deleteSlip(pendingDeleteSlip._id)} disabled={saving || !pendingDeleteSlip}>
              {saving ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingPaySlip} onOpenChange={(v) => !v && !saving && setPendingPaySlip(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer le paiement</DialogTitle>
            <DialogDescription>
              Marquer la fiche de {pendingPaySlip ? personName(pendingPaySlip) : "ce bénéficiaire"}
              {pendingPaySlip ? ` (${formatCurrency(pendingPaySlip.amount)})` : ""} comme payée ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingPaySlip(null)} disabled={saving}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => pendingPaySlip && markSlipPaid(pendingPaySlip)}
              disabled={saving || !pendingPaySlip}
            >
              {saving ? "Enregistrement…" : "Payer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
