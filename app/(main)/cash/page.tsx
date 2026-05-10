"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Wallet,
  Plus,
  Lock,
  RotateCcw,
  Pencil,
  FileDown,
  Loader2,
  CalendarClock,
  Receipt,
  Package,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { StatsCard } from "@/components/shared/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
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
    totalSales: number;
    totalSupplies: number;
  };
};

async function fetchCashSessions(): Promise<CashSession[]> {
  const res = await fetch("/api/cash-sessions");
  if (!res.ok) throw new Error("Impossible de charger les sessions");
  return res.json();
}

function CashSessionCard({
  session: s,
  canReopen,
  hasActiveSession,
  exportingSessionId,
  onExport,
  onEdit,
  onClose,
  onReopen,
}: {
  session: CashSession;
  canReopen: boolean;
  hasActiveSession: boolean;
  exportingSessionId: string | null;
  onExport: (id: string) => void;
  onEdit: (session: CashSession) => void;
  onClose: (session: CashSession) => void;
  onReopen: (session: CashSession) => void;
}) {
  const isOpen = s.status === "OPEN";
  const summary = s.financialSummary;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200",
        "hover:border-foreground/10 hover:shadow-md",
        isOpen && "border-emerald-200/80 ring-1 ring-emerald-500/10"
      )}
    >
      {isOpen ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
          aria-hidden
        />
      ) : null}

      <CardHeader className="space-y-3 p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <CardTitle className="truncate text-[15px] font-semibold leading-snug tracking-tight" title={s.name}>
              {s.name}
            </CardTitle>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant="outline"
                className="h-6 gap-1 border-border/80 bg-muted/30 px-2 text-[11px] font-medium text-muted-foreground shadow-none"
              >
                <CalendarClock className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                <span className="tabular-nums">{formatDateTime(s.createdAt)}</span>
              </Badge>
              {s.closedAt ? (
                <Badge
                  variant="secondary"
                  className="h-6 gap-1 px-2 text-[11px] font-medium shadow-none"
                >
                  <span className="text-muted-foreground">Clôture</span>
                  <span className="tabular-nums text-foreground/90">{formatDateTime(s.closedAt)}</span>
                </Badge>
              ) : null}
            </div>
          </div>
          <Badge
            variant={isOpen ? "success" : "secondary"}
            className={cn("shrink-0 shadow-none", isOpen && "bg-emerald-600/10 text-emerald-800 ring-0")}
          >
            {isOpen ? "En cours" : "Clôturée"}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Wallet className="size-3.5 opacity-70" aria-hidden />
            Fond de caisse
          </span>
          <span className="text-sm font-semibold tabular-nums tracking-tight">{formatCurrency(s.openingFloat)}</span>
        </div>

        {s.closedAt ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Fond repris</span>
            <Badge
              variant={s.openingFloatRecovered === true ? "success" : "warning"}
              className="h-5 px-2 text-[10px] font-semibold uppercase tracking-wide shadow-none"
            >
              {s.openingFloatRecovered === true ? "Oui" : "Non"}
            </Badge>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-3 pt-0">
        <Separator className="bg-border/80" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Récap financier</p>
        <dl className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-lg border border-border/50 bg-background/80 px-2.5 py-2.5">
            <dt className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Receipt className="size-3 opacity-70" aria-hidden />
              Ventes totales
            </dt>
            <dd className="text-right text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(summary?.totalSales ?? 0)}
            </dd>
          </div>
          <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.06] px-2.5 py-2.5">
            <dt className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-amber-950/70">
              <Package className="size-3" aria-hidden />
              Approvisionnement total
            </dt>
            <dd className="text-right text-sm font-semibold tabular-nums text-amber-950">
              {formatCurrency(summary?.totalSupplies ?? 0)}
            </dd>
          </div>
        </dl>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 bg-muted/20 p-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-border/80 bg-background/80 text-xs shadow-sm hover:bg-background"
          onClick={() => onExport(s._id)}
          disabled={exportingSessionId === s._id}
        >
          {exportingSessionId === s._id ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FileDown className="size-3.5" />
          )}
          Exporter
        </Button>
        {isOpen ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-border/80 bg-background/80 text-xs shadow-sm hover:bg-background"
              onClick={() => onEdit(s)}
            >
              <Pencil className="size-3.5" />
              Modifier
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 text-xs shadow-sm"
              onClick={() => onClose(s)}
            >
              <Lock className="size-3.5" />
              Clôturer
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-border/80 bg-background/80 text-xs shadow-sm hover:bg-background disabled:opacity-50"
            disabled={hasActiveSession || !canReopen}
            onClick={() => onReopen(s)}
            title={
              hasActiveSession
                ? "Une session est déjà en cours."
                : !canReopen
                  ? "Seule la dernière session en date peut être relancée."
                  : undefined
            }
          >
            <RotateCcw className="size-3.5" />
            Relancer
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);

  const activeSession = useMemo(
    () => (sessions ?? []).find((s) => s.status === "OPEN") ?? null,
    [sessions]
  );

  /** Dernière session créée (même critère que l’API) : seule une session clôturée peut être relancée si c’est elle. */
  const latestSession = useMemo(() => {
    const list = sessions ?? [];
    if (list.length === 0) return null;
    return [...list].sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      if (db !== da) return db - da;
      return b._id.localeCompare(a._id);
    })[0];
  }, [sessions]);

  const canReopenSession = (s: CashSession) =>
    s.status === "CLOSED" && !!latestSession && s._id === latestSession._id;

  const closedCount = (sessions ?? []).filter((s) => s.status === "CLOSED").length;

  const allSessions = useMemo(() => sessions ?? [], [sessions]);
  const totalPages = Math.max(1, Math.ceil(allSessions.length / pageSize));
  const paginatedSessions = useMemo(
    () => allSessions.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [allSessions, currentPage, pageSize]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
          {Array.from({ length: Math.min(pageSize, 9) }).map((_, i) => (
            <Skeleton key={i} className="h-[22rem] rounded-2xl" />
          ))}
        </div>
      ) : allSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 py-16 text-center text-sm text-muted-foreground">
          Aucune session de caisse enregistrée.
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-[#6B7280]">
              Cartes par page
              <select
                value={pageSize}
                onChange={(e) =>
                  setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                }
                className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2 text-xs text-[#0D0D0D] outline-none transition-colors focus:border-[#0D0D0D]"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedSessions.map((s) => (
              <CashSessionCard
                key={s._id}
                session={s}
                canReopen={canReopenSession(s)}
                hasActiveSession={!!activeSession}
                exportingSessionId={exportingSessionId}
                onExport={exportSessionAnalytics}
                onEdit={(sess) => {
                  setOpenEdit(sess);
                  setOpeningFloatInput(String(sess.openingFloat));
                }}
                onClose={(sess) => {
                  setPendingClose(sess);
                  setOpeningFloatRecoveredOnClose(true);
                }}
                onReopen={(sess) => setPendingReopen(sess)}
              />
            ))}
          </div>
          <PaginationControls
            className="mt-6"
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={allSessions.length}
            onPageChange={setCurrentPage}
          />
        </>
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
              Seule la dernière session en date pourra être relancée plus tard si besoin.
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
              Vous ne pouvez avoir qu&apos;une session active à la fois. Seule la dernière session en date peut être
              relancée.
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
