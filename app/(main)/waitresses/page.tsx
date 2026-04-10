"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
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
import { formatDate, getInitials } from "@/lib/utils";
import type { IWaitress } from "@/types";

async function fetchWaitresses(): Promise<IWaitress[]> {
  const res = await fetch("/api/waitresses");
  if (!res.ok) throw new Error("fetch");
  return res.json();
}

function WaitressDialog({
  open,
  onClose,
  waitress,
}: {
  open: boolean;
  onClose: () => void;
  waitress?: IWaitress;
}) {
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (waitress) {
      setFirstName(waitress.firstName);
      setLastName(waitress.lastName);
      setPhone(waitress.phone ?? "");
    } else {
      setFirstName("");
      setLastName("");
      setPhone("");
    }
  }, [waitress, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const url = waitress ? `/api/waitresses/${waitress._id}` : "/api/waitresses";
    const method = waitress ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone: phone.trim() || undefined }),
    });
    setIsSubmitting(false);
    if (!res.ok) {
      const err = await res.json();
      toast({ variant: "destructive", title: "Erreur", description: err.error });
      return;
    }
    toast({
      variant: "success",
      title: waitress ? "Serveuse modifiée" : "Serveuse ajoutée",
    });
    qc.invalidateQueries({ queryKey: ["waitresses"] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{waitress ? "Modifier la serveuse" : "Nouvelle serveuse"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prénom</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Numéro de téléphone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex. 07 01 23 45 67"
              type="tel"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement…" : waitress ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function WaitressesPage() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();

  const { data: waitresses, isLoading } = useQuery({
    queryKey: ["waitresses"],
    queryFn: fetchWaitresses,
    enabled: session?.user?.role === "directeur",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [edit, setEdit] = useState<IWaitress | undefined>();
  const [waitressPendingDelete, setWaitressPendingDelete] = useState<IWaitress | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/waitresses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      toast({ variant: "success", title: "Serveuse supprimée" });
      qc.invalidateQueries({ queryKey: ["waitresses"] });
      setWaitressPendingDelete(null);
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
  const openEdit = (w: IWaitress) => {
    setEdit(w);
    setDialogOpen(true);
  };

  const count = waitresses?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Serveuses"
        subtitle="Gérer l’équipe de salle"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Ajouter une serveuse
          </Button>
        }
      />

      <div className="mb-10 max-w-xs">
        {isLoading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <StatsCard title="Serveuses enregistrées" value={count} icon={UserRound} index={0} />
        )}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
          Équipe
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-2xl" />
            ))}
          </div>
        ) : waitresses?.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-white/60 py-16 text-center">
            <p className="text-sm text-[#9CA3AF]">Aucune serveuse enregistrée</p>
            <Button variant="link" className="mt-2 h-auto p-0 text-[#0D0D0D]" onClick={openCreate}>
              Ajouter la première
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {waitresses?.map((w, i) => (
              <motion.article
                key={w._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.32), ease: [0.22, 1, 0.36, 1] }}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white p-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-[#D4D4D4] hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.1)]"
              >
                <div className="absolute left-0 top-0 h-full w-[3px] bg-[#0D0D0D] opacity-[0.08]" aria-hidden />

                <div className="flex items-start gap-3 pl-0.5">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0D0D0D] text-[10px] font-semibold tracking-tight text-white"
                    aria-hidden
                  >
                    {getInitials(w.firstName, w.lastName)}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="truncate text-[13px] font-semibold leading-snug tracking-tight text-[#0D0D0D]">
                      {w.firstName} {w.lastName}
                    </h3>
                    <p className="mt-1 truncate text-[11px] leading-snug text-[#737373]">
                      {w.phone ?? "Pas de téléphone"}
                    </p>
                    <p className="mt-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#B4B4B4]">
                      Depuis {formatDate(w.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex justify-end gap-0.5 border-t border-[#F0F0F0] pt-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-[12px] font-medium text-[#6B7280] hover:bg-[#F5F5F5] hover:text-[#0D0D0D]"
                    onClick={() => openEdit(w)}
                  >
                    <Pencil className="mr-1.5 h-3 w-3" />
                    Modifier
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-[12px] font-medium text-[#9CA3AF] hover:bg-red-50 hover:text-red-600"
                    onClick={() => setWaitressPendingDelete(w)}
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

      <WaitressDialog open={dialogOpen} onClose={() => setDialogOpen(false)} waitress={edit} />

      <Dialog
        open={!!waitressPendingDelete}
        onOpenChange={(open) => !open && !deleteMutation.isPending && setWaitressPendingDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la serveuse ?</DialogTitle>
            <DialogDescription>
              {waitressPendingDelete && (
                <>
                  Vous allez supprimer définitivement{" "}
                  <span className="font-medium text-[#0D0D0D]">
                    {waitressPendingDelete.firstName} {waitressPendingDelete.lastName}
                  </span>
                  . Cette action est irréversible. Si des ventes sont liées à cette serveuse, la suppression sera
                  refusée.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWaitressPendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (waitressPendingDelete) deleteMutation.mutate(waitressPendingDelete._id);
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
