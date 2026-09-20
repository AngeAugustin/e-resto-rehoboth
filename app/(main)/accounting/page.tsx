"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Calculator, Download, Landmark, Pencil, Plus, Truck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ACCOUNTING_MONTHS } from "@/lib/accounting-window";
import { exportAccountingReportPdf } from "@/lib/accounting-report-pdf";
import type { AccountingFilter, IAccountingPeriod, IAccountingSnapshot } from "@/types";

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AccountingPage() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();
  const can = ["directeur", "directrice", "gerant"].includes(session?.user?.role ?? "");
  const canEdit = ["directeur", "directrice"].includes(session?.user?.role ?? "");
  const now = new Date();
  const currentYear = now.getFullYear();

  const [filter, setFilter] = useState<AccountingFilter>("month");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({ openingBalance: "", openedAt: toDateTimeLocal(new Date()), note: "" });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const invalidRange = Boolean(filter === "range" && customFrom && customTo && customFrom > customTo);
  const rangeReady = filter !== "range" || Boolean(customFrom && customTo && !invalidRange);

  const queryParams = useMemo(() => {
    const search = new URLSearchParams({ filter });
    if (filter === "year") search.set("year", String(year));
    else if (filter === "range") {
      search.set("from", customFrom);
      search.set("to", customTo);
    } else {
      search.set("year", String(year));
      search.set("month", String(month));
    }
    return search.toString();
  }, [customFrom, customTo, filter, month, year]);

  const { data: snapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: ["accounting-snapshot", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/accounting/snapshot?${queryParams}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "snapshot");
      return res.json() as Promise<IAccountingSnapshot>;
    },
    enabled: can && rangeReady,
  });

  const { data: opening } = useQuery({
    queryKey: ["accounting-period"],
    queryFn: async () => {
      const res = await fetch("/api/accounting-periods");
      if (!res.ok) throw new Error("period");
      return res.json() as Promise<IAccountingPeriod | null>;
    },
    enabled: can,
  });

  const runningRows = useMemo(() => {
    if (!snapshot?.active) return [];
    let remaining = snapshot.startBalance;
    return snapshot.movements.map((row) => {
      remaining -= row.amount;
      return { ...row, remaining };
    });
  }, [snapshot]);

  const startForm = () => {
    setForm({
      openingBalance: opening ? String(opening.openingBalance) : "",
      openedAt: opening ? toDateTimeLocal(new Date(opening.openedAt)) : toDateTimeLocal(new Date()),
      note: opening?.note ?? "",
    });
    setOpenForm(true);
  };

  const savePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (opening && !canEdit) return;
    setSaving(true);
    const res = await fetch(opening ? `/api/accounting-periods/${opening._id}` : "/api/accounting-periods", {
      method: opening ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openingBalance: Number(form.openingBalance),
        openedAt: form.openedAt,
        note: form.note,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({ variant: "success", title: opening ? "Solde d’ouverture mis à jour" : "Solde d’ouverture enregistré" });
    qc.invalidateQueries({ queryKey: ["accounting-snapshot"] });
    qc.invalidateQueries({ queryKey: ["accounting-period"] });
    setOpenForm(false);
  };

  const handleExport = async () => {
    if (!snapshot?.active) return;
    setExporting(true);
    try {
      await exportAccountingReportPdf(snapshot);
      toast({ title: "Export PDF", description: "La situation comptable a été téléchargée." });
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de générer le PDF." });
    } finally {
      setExporting(false);
    }
  };

  if (status === "loading") return <Skeleton className="h-96" />;
  if (!can) return <p className="py-20 text-center text-[#9CA3AF]">Accès refusé.</p>;

  const showOpeningAction = !opening || canEdit;
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div>
      <PageHeader
        title="Comptabilité"
        subtitle="Situation par période, mois ou année — solde de départ, approvisionnements et dépenses"
        action={
          showOpeningAction ? (
            <Button onClick={startForm}>
              {opening ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {opening ? "Modifier le solde" : "Solde à l’ouverture"}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label>Période</Label>
            <Select value={filter} onValueChange={(value) => setFilter(value as AccountingFilter)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="range">De telle date à telle date</SelectItem>
                <SelectItem value="month">Mois</SelectItem>
                <SelectItem value="year">Année</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(filter === "month" || filter === "year") && (
            <div className="space-y-1.5">
              <Label>Année</Label>
              <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {filter === "month" && (
            <div className="space-y-1.5">
              <Label>Mois</Label>
              <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTING_MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {filter === "range" && (
            <>
              <div className="space-y-1.5">
                <Label>Du</Label>
                <Input className="w-[160px]" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Au</Label>
                <Input className="w-[160px]" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}

          <Button
            variant="outline"
            className="mb-0.5"
            onClick={handleExport}
            disabled={snapshotLoading || exporting || !snapshot?.active}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Export…" : "Exporter PDF"}
          </Button>
        </div>
        {invalidRange ? (
          <p className="text-xs text-red-700">La date de début doit précéder la date de fin.</p>
        ) : (
          <p className="text-xs text-[#6B7280]">
            Période : <span className="font-medium text-[#0D0D0D]">{snapshot?.label ?? "…"}</span>
          </p>
        )}
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filter === "range" && !rangeReady ? (
          <p className="col-span-full py-6 text-sm text-[#6B7280]">
            {invalidRange ? "Corrigez la plage de dates." : "Choisissez une date de début et une date de fin."}
          </p>
        ) : snapshotLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatsCard
              title="Solde de départ"
              value={formatCurrency(snapshot?.startBalance ?? 0)}
              subtitle={snapshot?.active ? snapshot.label : opening ? "Période antérieure à l’ouverture" : "Aucun solde saisi"}
              icon={Wallet}
              index={0}
            />
            <StatsCard
              title="Approvisionnements"
              value={formatCurrency(snapshot?.suppliesTotal ?? 0)}
              icon={Truck}
              index={1}
            />
            <StatsCard
              title="Dépenses"
              value={formatCurrency(snapshot?.expensesTotal ?? 0)}
              icon={Landmark}
              index={2}
            />
            <StatsCard
              title="Solde de fin"
              value={formatCurrency(snapshot?.remaining ?? 0)}
              icon={Calculator}
              variant={(snapshot?.remaining ?? 0) < 0 ? "danger" : "dark"}
              index={3}
            />
          </>
        )}
      </div>

      <div>
        <div className="lg:hidden">
          {filter === "range" && !rangeReady ? (
            <p className="px-4 py-12 text-center text-sm text-[#6B7280]">
              {invalidRange ? "La date de début doit précéder la date de fin." : "Choisissez une date de début et une date de fin."}
            </p>
          ) : snapshotLoading ? (
            <div className="space-y-3 px-4 py-3">
              <Skeleton className="h-[7.5rem] rounded-2xl" />
              <Skeleton className="h-[7.5rem] rounded-2xl" />
            </div>
          ) : !opening ? (
            <p className="px-4 py-12 text-center text-sm text-[#6B7280]">
              Aucun solde d’ouverture. Enregistrez-en un pour commencer le suivi.
            </p>
          ) : !snapshot?.active ? (
            <p className="px-4 py-12 text-center text-sm text-[#6B7280]">
              Cette période est antérieure au solde d’ouverture ({formatDate(opening.openedAt)}).
            </p>
          ) : (
            <MobileCardList>
              <MobileDataCard>
                <MobileDataCardHeader
                  title={snapshot.period?.note || "Solde de départ de la période"}
                  badge={<Badge variant="secondary">Départ</Badge>}
                />
                <MobileDataCardMeta
                  items={[
                    { label: "Date", value: formatDate(snapshot.from) },
                    { label: "Sortie", value: "—" },
                    { label: "Reste", value: formatCurrency(snapshot.startBalance) },
                  ]}
                />
              </MobileDataCard>
              {runningRows.map((row) => (
                <MobileDataCard key={`${row.kind}-${row.id}`}>
                  <MobileDataCardHeader
                    title={row.label}
                    badge={
                      <Badge variant={row.kind === "SUPPLY" ? "pending" : "outline"}>
                        {row.kind === "SUPPLY" ? "Approvisionnement" : "Dépense"}
                      </Badge>
                    }
                  />
                  <MobileDataCardMeta
                    items={[
                      { label: "Date", value: formatDate(row.date) },
                      { label: "Sortie", value: formatCurrency(row.amount) },
                      { label: "Reste", value: formatCurrency(row.remaining) },
                    ]}
                  />
                </MobileDataCard>
              ))}
              {runningRows.length === 0 ? (
                <p className="px-1 py-4 text-center text-sm text-[#6B7280]">
                  Aucun approvisionnement ni dépense sur cette période.
                </p>
              ) : null}
            </MobileCardList>
          )}
        </div>
        <div className="hidden min-w-0 overflow-x-auto rounded-xl border lg:block">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3 text-right">Sortie</th>
              <th className="px-4 py-3 text-right">Reste</th>
            </tr>
          </thead>
          <tbody>
            {filter === "range" && !rangeReady ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#6B7280]">
                  {invalidRange ? "La date de début doit précéder la date de fin." : "Choisissez une date de début et une date de fin."}
                </td>
              </tr>
            ) : snapshotLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8">
                  <Skeleton className="h-8 w-full" />
                </td>
              </tr>
            ) : !opening ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#6B7280]">
                  Aucun solde d’ouverture. Enregistrez-en un pour commencer le suivi.
                </td>
              </tr>
            ) : !snapshot?.active ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#6B7280]">
                  Cette période est antérieure au solde d’ouverture ({formatDate(opening.openedAt)}).
                </td>
              </tr>
            ) : (
              <>
                <tr className="border-b bg-slate-50/80">
                  <td className="px-4 py-3 text-xs">{formatDate(snapshot.from)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">Départ</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium">{snapshot.period?.note || "Solde de départ de la période"}</td>
                  <td className="px-4 py-3 text-right text-[#9CA3AF]">—</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(snapshot.startBalance)}</td>
                </tr>
                {runningRows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b">
                    <td className="px-4 py-3 text-xs">{formatDate(row.date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={row.kind === "SUPPLY" ? "pending" : "outline"}>
                        {row.kind === "SUPPLY" ? "Approvisionnement" : "Dépense"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.remaining)}</td>
                  </tr>
                ))}
                {runningRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#6B7280]">
                      Aucun approvisionnement ni dépense sur cette période.
                    </td>
                  </tr>
                ) : null}
              </>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{opening ? "Modifier le solde d’ouverture" : "Solde à l’ouverture"}</DialogTitle>
            <DialogDescription>
              Un seul solde d’ouverture. Les situations par période partent de ce montant, moins les sorties déjà passées.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={savePeriod} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Montant</Label>
              <Input
                type="number"
                min={0}
                value={form.openingBalance}
                onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date et heure</Label>
              <Input
                type="datetime-local"
                value={form.openedAt}
                onChange={(e) => setForm({ ...form, openedAt: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
