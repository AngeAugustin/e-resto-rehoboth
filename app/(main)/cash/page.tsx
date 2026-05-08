"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Wallet, Plus, Lock, RotateCcw, Pencil, FileDown, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { buildCashSessionName } from "@/lib/cash-session";
import { exportAnalyticsReportPdf, type AnalyticsReportPayload } from "@/lib/analytics-report-pdf";

type CashSession = {
  _id: string;
  name: string;
  sessionDate: string;
  openingFloat: number;
  openingFloatRecovered?: boolean;
  status: "OPEN" | "CLOSED";
  closedAt?: string;
  createdAt: string;
  financialSummary?: {
    salesCount: number;
    revenue: number;
    cashRevenue: number;
    mobileMoneyRevenue: number;
    expectedCashOnHand: number;
  };
};

async function fetchCashSessions(): Promise<CashSession[]> {
  const res = await fetch("/api/cash-sessions");
  if (!res.ok) throw new Error("Impossible de charger les sessions");
  return res.json();
}

export default function CashPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["cash-sessions"],
    queryFn: fetchCashSessions,
    enabled: ["directeur", "gerant"].includes(session?.user?.role ?? ""),
  });

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState<CashSession | null>(null);
  const [pendingClose, setPendingClose] = useState<CashSession | null>(null);
  const [pendingReopen, setPendingReopen] = useState<CashSession | null>(null);
  const [openingFloatRecoveredOnClose, setOpeningFloatRecoveredOnClose] = useState(true);
  const [openingFloatInput, setOpeningFloatInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null);

  const activeSession = useMemo(
    () => (sessions ?? []).find((s) => s.status === "OPEN") ?? null,
    [sessions]
  );
  const closedCount = (sessions ?? []).filter((s) => s.status === "CLOSED").length;

  const createNamePreview = buildCashSessionName(new Date());

  const reloadSessions = () => qc.invalidateQueries({ queryKey: ["cash-sessions"] });

  async function createSession() {
    const openingFloat = Number(openingFloatInput);
    if (!Number.isFinite(openingFloat) || openingFloat < 0) {
      toast({ variant: "destructive", title: "Erreur", description: "Fond de caisse invalide." });
      return;
    }

    setSaving(true);
    const res = await fetch("/api/cash-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingFloat }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: "Erreur", description: err.error ?? "Création impossible." });
      return;
    }

    toast({ variant: "success", title: "Session ouverte" });
    setOpenCreate(false);
    setOpeningFloatInput("");
    reloadSessions();
  }

  async function updateSessionOpeningFloat(sessionId: string) {
    const openingFloat = Number(openingFloatInput);
    if (!Number.isFinite(openingFloat) || openingFloat < 0) {
      toast({ variant: "destructive", title: "Erreur", description: "Fond de caisse invalide." });
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/cash-sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingFloat }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: "Erreur", description: err.error ?? "Modification impossible." });
      return;
    }
    toast({ variant: "success", title: "Session modifiée" });
    setOpenEdit(null);
    setOpeningFloatInput("");
    reloadSessions();
  }

  async function applyAction(sessionId: string, action: "close" | "reopen") {
    setSaving(true);
    const res = await fetch(`/api/cash-sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body:
        action === "close"
          ? JSON.stringify({ action, openingFloatRecovered: openingFloatRecoveredOnClose })
          : JSON.stringify({ action }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: "Erreur", description: err.error ?? "Action impossible." });
      return;
    }
    toast({
      variant: "success",
      title: action === "close" ? "Session clôturée" : "Session relancée",
    });
    setPendingClose(null);
    setPendingReopen(null);
    reloadSessions();
  }

  async function exportSessionAnalytics(sessionId: string) {
    setExportingSessionId(sessionId);
    const res = await fetch(`/api/cash-sessions/${sessionId}/analytics`);
    if (!res.ok) {
      setExportingSessionId(null);
      const err = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: "Erreur", description: err.error ?? "Export impossible." });
      return;
    }

    const payload = (await res.json()) as AnalyticsReportPayload;
    try {
      await exportAnalyticsReportPdf(payload);
      toast({ variant: "success", title: "Export terminé", description: "Le PDF de session a été généré." });
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer le PDF analytique de la session.",
      });
    } finally {
      setExportingSessionId(null);
    }
  }

  if (!["directeur", "gerant"].includes(session?.user?.role ?? "")) {
    return <p className="py-20 text-center text-[#9CA3AF]">Accès réservé aux directeurs et gérants.</p>;
  }

  return (
    <div>
      <PageHeader
        title="Caisse"
        subtitle="Gérez les sessions de caisse quotidiennes"
        action={
          <Button
            onClick={() => {
              setOpenCreate(true);
              setOpeningFloatInput("");
            }}
            disabled={!!activeSession}
            title={activeSession ? "Clôturez la session en cours avant d'en ouvrir une autre." : undefined}
          >
            <Plus className="h-4 w-4" />
            Ouvrir une session
          </Button>
        }
      />

      <div className="mb-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </>
        ) : (
          <>
            <StatsCard title="Total sessions" value={(sessions ?? []).length} icon={Wallet} index={0} />
            <StatsCard title="Session en cours" value={activeSession ? 1 : 0} icon={Wallet} index={1} />
            <StatsCard title="Sessions clôturées" value={closedCount} icon={Wallet} index={2} />
          </>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : (sessions?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-10 text-center text-[#9CA3AF]">
          Aucune session de caisse enregistrée.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(sessions ?? []).map((s) => (
            <div key={s._id} className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-[#0D0D0D]" title={s.name}>
                  {s.name}
                </p>
                <Badge variant={s.status === "OPEN" ? "success" : "secondary"}>
                  {s.status === "OPEN" ? "En cours" : "Clôturée"}
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-[#6B7280]">
                <p>Fond: <span className="font-medium text-[#0D0D0D]">{formatCurrency(s.openingFloat)}</span></p>
                {s.closedAt ? <p>Clôturée le: {formatDate(s.closedAt)}</p> : null}
                {s.closedAt ? (
                  <p>
                    Fond repris:{" "}
                    <span className="font-medium text-[#0D0D0D]">
                      {s.openingFloatRecovered === true ? "Oui" : "Non"}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-2.5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  Récap financier
                </p>
                <div className="space-y-1 text-xs text-[#4B5563]">
                  <p className="flex items-center justify-between gap-2">
                    <span>Ventes clôturées</span>
                    <span className="font-medium text-[#0D0D0D]">{s.financialSummary?.salesCount ?? 0}</span>
                  </p>
                  <p className="flex items-center justify-between gap-2">
                    <span>CA total</span>
                    <span className="font-semibold text-[#0D0D0D]">
                      {formatCurrency(s.financialSummary?.revenue ?? 0)}
                    </span>
                  </p>
                  <p className="flex items-center justify-between gap-2">
                    <span>Encaissements espèces</span>
                    <span className="font-medium text-emerald-700">
                      {formatCurrency(s.financialSummary?.cashRevenue ?? 0)}
                    </span>
                  </p>
                  <p className="flex items-center justify-between gap-2">
                    <span>Encaissements Mobile Money</span>
                    <span className="font-medium text-indigo-700">
                      {formatCurrency(s.financialSummary?.mobileMoneyRevenue ?? 0)}
                    </span>
                  </p>
                  <p className="flex items-center justify-between gap-2 border-t border-[#E5E7EB] pt-1.5">
                    <span>Solde espèces théorique</span>
                    <span className="font-bold text-[#0D0D0D]">
                      {formatCurrency(s.financialSummary?.expectedCashOnHand ?? s.openingFloat)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => exportSessionAnalytics(s._id)}
                  disabled={exportingSessionId === s._id}
                >
                  {exportingSessionId === s._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  Exporter
                </Button>
                {s.status === "OPEN" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setOpenEdit(s);
                        setOpeningFloatInput(String(s.openingFloat));
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setPendingClose(s);
                        setOpeningFloatRecoveredOnClose(true);
                      }}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Clôturer
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!!activeSession}
                    onClick={() => setPendingReopen(s)}
                    title={activeSession ? "Une session est déjà en cours." : undefined}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Relancer
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ouvrir une session de caisse</DialogTitle>
            <DialogDescription>
              Le nom est attribué automatiquement selon la date du jour.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom de session</Label>
              <div className="rounded-md border border-input bg-muted/60 px-3 py-2 text-sm">{createNamePreview}</div>
            </div>
            <div className="space-y-1.5">
              <Label>Fond de caisse (FCFA)</Label>
              <Input
                type="number"
                min={0}
                value={openingFloatInput}
                onChange={(e) => setOpeningFloatInput(e.target.value)}
                placeholder="Ex: 50000"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" onClick={createSession} disabled={saving || !!activeSession}>
              {saving ? "Ouverture..." : "Ouvrir la session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openEdit} onOpenChange={(v) => !v && setOpenEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la session</DialogTitle>
            <DialogDescription>
              Seules les sessions non clôturées sont modifiables.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Session</Label>
              <div className="rounded-md border border-input bg-muted/60 px-3 py-2 text-sm">{openEdit?.name}</div>
            </div>
            <div className="space-y-1.5">
              <Label>Fond de caisse (FCFA)</Label>
              <Input
                type="number"
                min={0}
                value={openingFloatInput}
                onChange={(e) => setOpeningFloatInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpenEdit(null)} disabled={saving}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => openEdit && updateSessionOpeningFloat(openEdit._id)}
              disabled={saving || !openEdit}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingClose} onOpenChange={(v) => !v && setPendingClose(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clôturer cette session ?</DialogTitle>
            <DialogDescription>
              Vous pourrez la relancer ensuite si besoin.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <label className="flex items-start gap-2 text-sm text-[#374151]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={openingFloatRecoveredOnClose}
                onChange={(e) => setOpeningFloatRecoveredOnClose(e.target.checked)}
                disabled={saving}
              />
              <span>J&apos;ai repris le fond de caisse à la clôture.</span>
            </label>
            <p className="mt-1 text-xs text-[#6B7280]">
              Décochez si le fond n&apos;a pas encore été repris.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingClose(null)} disabled={saving}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => pendingClose && applyAction(pendingClose._id, "close")}
              disabled={saving || !pendingClose}
            >
              {saving ? "Clôture..." : "Clôturer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingReopen} onOpenChange={(v) => !v && setPendingReopen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Relancer cette session ?</DialogTitle>
            <DialogDescription>
              Vous ne pouvez avoir qu&apos;une session active à la fois.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingReopen(null)} disabled={saving}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => pendingReopen && applyAction(pendingReopen._id, "reopen")}
              disabled={saving || !pendingReopen || !!activeSession}
            >
              {saving ? "Relance..." : "Relancer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
