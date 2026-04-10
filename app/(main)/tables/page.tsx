"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Table2 } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import type { IRestaurantTable } from "@/types";

async function fetchTables(): Promise<IRestaurantTable[]> {
  const res = await fetch("/api/tables");
  if (!res.ok) throw new Error("fetch");
  return res.json();
}

function TableDialog({
  open,
  onClose,
  table,
}: {
  open: boolean;
  onClose: () => void;
  table?: IRestaurantTable;
}) {
  const qc = useQueryClient();
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (table) {
      setNumber(String(table.number));
      setName(table.name ?? "");
      setCapacity(table.capacity != null ? String(table.capacity) : "");
    } else {
      setNumber("");
      setName("");
      setCapacity("");
    }
  }, [table, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(number, 10);
    const cap = parseInt(capacity, 10);
    if (Number.isNaN(num) || num < 1) {
      toast({ variant: "destructive", title: "Erreur", description: "Numéro de table invalide." });
      return;
    }
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Erreur", description: "Le nom de la table est requis." });
      return;
    }
    if (Number.isNaN(cap) || cap < 1) {
      toast({ variant: "destructive", title: "Erreur", description: "Capacité invalide (minimum 1)." });
      return;
    }

    setIsSubmitting(true);
    const url = table ? `/api/tables/${table._id}` : "/api/tables";
    const method = table ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: num, name: name.trim(), capacity: cap }),
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
          <DialogTitle>{table ? "Modifier la table" : "Nouvelle table"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Numéro</Label>
              <Input
                type="number"
                min={1}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Capacité (places)</Label>
              <Input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Terrasse 1"
              required
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
  const { data: session, status } = useSession();
  const qc = useQueryClient();

  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: fetchTables,
    enabled: session?.user?.role === "directeur",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [edit, setEdit] = useState<IRestaurantTable | undefined>();
  const [tablePendingDelete, setTablePendingDelete] = useState<IRestaurantTable | null>(null);

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

  if (status === "loading") return <Skeleton className="h-96" />;
  if (session?.user?.role !== "directeur") {
    return <p className="py-20 text-center text-[#9CA3AF]">Accès réservé au directeur.</p>;
  }

  const openCreate = () => {
    setEdit(undefined);
    setDialogOpen(true);
  };
  const openEdit = (t: IRestaurantTable) => {
    setEdit(t);
    setDialogOpen(true);
  };

  const count = tables?.length ?? 0;
  const occupied = tables?.filter((t) => t.occupiedByPendingSaleId).length ?? 0;

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

      <div className="mb-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
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

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
          Plan de salle
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[148px] rounded-2xl" />
            ))}
          </div>
        ) : tables?.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-white/60 py-16 text-center">
            <p className="text-sm text-[#9CA3AF]">Aucune table configurée</p>
            <Button variant="link" className="mt-2 h-auto p-0 text-[#0D0D0D]" onClick={openCreate}>
              Créer une table
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables
              ?.slice()
              .sort((a, b) => a.number - b.number)
              .map((t, i) => (
                <motion.article
                  key={t._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.32), ease: [0.22, 1, 0.36, 1] }}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white p-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-[#D4D4D4] hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.1)]"
                >
                  <div className="absolute left-0 top-0 h-full w-[3px] bg-[#0D0D0D] opacity-[0.08]" aria-hidden />

                  <div className="flex items-start justify-between gap-3 pl-0.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] font-medium tabular-nums tracking-wide text-[#B0B0B0]">
                        Table {t.number}
                      </p>
                      <h3 className="mt-0.5 truncate text-[13px] font-semibold leading-snug tracking-tight text-[#0D0D0D]">
                        {t.name ?? `Table ${t.number}`}
                      </h3>
                      <p className="mt-2 text-[11px] text-[#9CA3AF]">Ajoutée le {formatDate(t.createdAt)}</p>
                    </div>
                    <div
                      className="flex min-w-[48px] flex-col items-center justify-center rounded-xl bg-[#F5F5F5] px-2 py-1.5"
                      aria-hidden
                    >
                      <span className="text-[14px] font-semibold tabular-nums leading-none text-[#0D0D0D]">
                        {t.capacity ?? "—"}
                      </span>
                      <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.15em] text-[#A3A3A3]">
                        pl.
                      </span>
                    </div>
                  </div>

                  {t.occupiedByPendingSaleId ? (
                    <Badge
                      variant="outline"
                      className="mt-3 w-fit border-transparent bg-[#F4F4F5] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#52525B]"
                    >
                      Commande en cours
                    </Badge>
                  ) : (
                    <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#D4D4D8]">
                      Libre
                    </p>
                  )}

                  <div className="mt-3.5 flex justify-end gap-0.5 border-t border-[#F0F0F0] pt-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-[12px] font-medium text-[#6B7280] hover:bg-[#F5F5F5] hover:text-[#0D0D0D]"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="mr-1.5 h-3 w-3" />
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-[12px] font-medium text-[#9CA3AF] hover:bg-red-50 hover:text-red-600"
                      onClick={() => setTablePendingDelete(t)}
                    >
                      <Trash2 className="mr-1.5 h-3 w-3" />
                      Supprimer
                    </Button>
                  </div>
                </motion.article>
              ))}
          </div>
        )}
      </motion.section>

      <TableDialog open={dialogOpen} onClose={() => setDialogOpen(false)} table={edit} />

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
