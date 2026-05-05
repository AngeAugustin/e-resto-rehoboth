"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Table2, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { PremiumTableShell, premiumTableSelectClass } from "@/components/shared/PremiumTableShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import type { IRestaurantTable } from "@/types";

async function fetchTables(): Promise<IRestaurantTable[]> {
  const res = await fetch("/api/tables");
  if (!res.ok) throw new Error("fetch");
  return res.json();
}

function nextTableNumber(tables: IRestaurantTable[]): number {
  if (tables.length === 0) return 1;
  return Math.max(...tables.map((t) => t.number)) + 1;
}

function readonlyFieldClassName() {
  return "flex min-h-10 w-full items-center rounded-md border border-input bg-muted/60 px-3 py-2 text-sm text-foreground shadow-sm";
}

function TableDialog({
  open,
  onClose,
  table,
  createSeed,
}: {
  open: boolean;
  onClose: () => void;
  table?: IRestaurantTable;
  /** Prochain numéro figé au moment d’ouvrir « Nouvelle table » (évite une réinit si les données se rechargent). */
  createSeed: { n: number } | null;
}) {
  const qc = useQueryClient();
  const [capacity, setCapacity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayNumber = table ? String(table.number) : createSeed != null ? String(createSeed.n) : "—";
  const displayName =
    table != null
      ? (table.name?.trim() ? table.name : `Table ${table.number}`)
      : createSeed != null
        ? `TABLE-${createSeed.n}`
        : "—";

  useEffect(() => {
    if (!open) return;
    if (table) {
      setCapacity(table.capacity != null ? String(table.capacity) : "");
    } else {
      setCapacity("");
    }
  }, [table, open, createSeed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cap = parseInt(capacity, 10);
    if (Number.isNaN(cap) || cap < 1) {
      toast({ variant: "destructive", title: "Erreur", description: "Capacité invalide (minimum 1)." });
      return;
    }

    let num: number;
    let nameStr: string;
    if (table) {
      num = table.number;
      nameStr = (table.name?.trim() ? table.name.trim() : `Table ${table.number}`);
    } else {
      if (!createSeed) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de déterminer le numéro de table." });
        return;
      }
      num = createSeed.n;
      nameStr = `TABLE-${createSeed.n}`;
    }

    setIsSubmitting(true);
    const url = table ? `/api/tables/${table._id}` : "/api/tables";
    const method = table ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: num, name: nameStr, capacity: cap }),
    });
    setIsSubmitting(false);
    if (!res.ok) {
      const err = await res.json();
      toast({ variant: "destructive", title: "Erreur", description: err.error });
      return;
    }
    toast({
      variant: "success",
      title: table ? "Table modifiée" : "Table ajoutée",
    });
    qc.invalidateQueries({ queryKey: ["tables"] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{table ? "Modifier la table" : "Ajouter une table"}</DialogTitle>
          {!table && (
            <DialogDescription>
              Le numéro et le nom sont attribués automatiquement. Indiquez uniquement la capacité (nombre de places).
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Numéro</Label>
              <div className={readonlyFieldClassName()}>{displayNumber}</div>
            </div>
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <div className={cn(readonlyFieldClassName(), "min-w-0")}>
                <span className="truncate">{displayName}</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Capacité (places)</Label>
            <Input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement…" : table ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TablesPage() {
  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;
  const { data: session, status } = useSession();
  const qc = useQueryClient();

  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: fetchTables,
    enabled: session?.user?.role === "directeur",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [createSeed, setCreateSeed] = useState<{ n: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [edit, setEdit] = useState<IRestaurantTable | undefined>();
  const [tablePendingDelete, setTablePendingDelete] = useState<IRestaurantTable | null>(null);

  const closeTableDialog = () => {
    setDialogOpen(false);
    setCreateSeed(null);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tables/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      toast({ variant: "success", title: "Table supprimée" });
      qc.invalidateQueries({ queryKey: ["tables"] });
      setTablePendingDelete(null);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  const openCreate = () => {
    setEdit(undefined);
    setCreateSeed({ n: nextTableNumber(tables ?? []) });
    setDialogOpen(true);
  };
  const openEdit = (t: IRestaurantTable) => {
    setCreateSeed(null);
    setEdit(t);
    setDialogOpen(true);
  };

  const count = tables?.length ?? 0;
  const occupied = tables?.filter((t) => t.occupiedByPendingSaleId).length ?? 0;
  const sortedTables = (tables ?? []).slice().sort((a, b) => a.number - b.number);
  const paginatedTables = sortedTables.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(sortedTables.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  if (status === "loading") return <Skeleton className="h-96" />;
  if (session?.user?.role !== "directeur") {
    return <p className="py-20 text-center text-[#9CA3AF]">Accès réservé au directeur.</p>;
  }

  return (
    <div>
      <PageHeader
        title="Tables"
        subtitle="Gérer le plan de salle"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Ajouter une table
          </Button>
        }
      />

      <div className="mb-8 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {isLoading ? (
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </>
        ) : (
          <>
            <StatsCard title="Tables" value={count} icon={Table2} index={0} />
            <StatsCard title="Occupées (vente en cours)" value={occupied} icon={Table2} index={1} />
          </>
        )}
      </div>

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
          title="Plan de salle"
          isLoading={isLoading}
          empty={!isLoading && (tables?.length === 0)}
          emptyMessage="Aucune table configurée"
          emptyAction={
            <Button variant="link" className="h-auto p-0 text-slate-900 underline-offset-4 hover:underline" onClick={openCreate}>
              Créer une table
            </Button>
          }
          skeletonColSpan={5}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-950/[0.025] text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <th className="whitespace-nowrap px-6 py-3.5 font-semibold">Table</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Capacité</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Statut</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Ajoutée le</th>
                  <th className="whitespace-nowrap px-6 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/90">
                {paginatedTables.map((t) => (
                  <tr
                    key={t._id}
                    className="group transition-colors duration-200 hover:bg-gradient-to-r hover:from-violet-500/[0.04] hover:via-transparent hover:to-cyan-500/[0.03]"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-600/80 shadow-inner ring-1 ring-white/25">
                          <span className="text-xs font-bold tracking-tight text-white">{t.number}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{t.name ?? `Table ${t.number}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {t.capacity != null ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90">
                          {t.capacity} place{t.capacity > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {t.occupiedByPendingSaleId ? (
                        <span className="inline-flex items-center rounded-full border border-violet-200/60 bg-violet-500/12 px-2.5 py-0.5 text-xs font-semibold text-violet-800 backdrop-blur-[2px]">
                          Occupée
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-sky-200/60 bg-sky-500/12 px-2.5 py-0.5 text-xs font-semibold text-sky-900 backdrop-blur-[2px]">
                          Libre
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/55 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-950/80">
                        <CalendarClock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                        {formatDate(t.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1 opacity-90 transition group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-xl border-slate-200/80 bg-white/80 text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-violet-200 hover:bg-violet-500/8 hover:text-violet-900"
                          onClick={() => openEdit(t)}
                          aria-label={`Modifier ${t.name ?? `table ${t.number}`}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-xl border-rose-200/60 bg-rose-500/[0.06] text-rose-600 shadow-sm backdrop-blur-sm transition hover:border-rose-300 hover:bg-rose-500/12 hover:text-rose-700"
                          onClick={() => setTablePendingDelete(t)}
                          aria-label={`Supprimer ${t.name ?? `table ${t.number}`}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumTableShell>
      </motion.div>

      <PaginationControls
        className="mt-6"
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={sortedTables.length}
        onPageChange={setCurrentPage}
      />

      <TableDialog
        open={dialogOpen}
        onClose={closeTableDialog}
        table={edit}
        createSeed={createSeed}
      />

      <Dialog
        open={!!tablePendingDelete}
        onOpenChange={(open) => !open && !deleteMutation.isPending && setTablePendingDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la table ?</DialogTitle>
            <DialogDescription>
              {tablePendingDelete && (
                <>
                  Vous allez supprimer définitivement la table{" "}
                  <span className="font-medium text-[#0D0D0D]">
                    « {tablePendingDelete.name ?? `n° ${tablePendingDelete.number}`} »
                  </span>{" "}
                  (numéro {tablePendingDelete.number}). Cette action est irréversible. Si des ventes sont liées à cette
                  table, la suppression sera refusée.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTablePendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (tablePendingDelete) deleteMutation.mutate(tablePendingDelete._id);
              }}
            >
              {deleteMutation.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
