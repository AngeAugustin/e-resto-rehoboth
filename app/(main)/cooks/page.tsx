"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, ChefHat, Eye, Phone } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { PremiumTableShell } from "@/components/shared/PremiumTableShell";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";
import { ProductThumb } from "@/components/sales/ProductThumb";
import type { ICook } from "@/types";

function CookDialog({ open, onClose, cook }: { open: boolean; onClose: () => void; cook?: ICook }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "MOBILE_MONEY">("CASH");
  const [photo, setPhoto] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName(cook?.firstName ?? "");
    setLastName(cook?.lastName ?? "");
    setPhone(cook?.phone ?? "");
    setPaymentMode(cook?.paymentMode ?? "CASH");
    setPhoto(cook?.photo ?? "");
    setFile(null);
  }, [open, cook]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let photoUrl = photo;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/media/upload", { method: "POST", body: fd });
      if (!up.ok) {
        setSaving(false);
        toast({ variant: "destructive", title: "Upload photo impossible" });
        return;
      }
      photoUrl = (await up.json()).url;
    }
    const res = await fetch(cook ? `/api/cooks/${cook._id}` : "/api/cooks", {
      method: cook ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone, paymentMode, photo: photoUrl }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({ variant: "success", title: cook ? "Cuisinière modifiée" : "Cuisinière ajoutée" });
    qc.invalidateQueries({ queryKey: ["cooks"] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{cook ? "Modifier" : "Nouvelle cuisinière"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Prénom</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Nom</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
          </div>
          <div className="space-y-1.5"><Label>Téléphone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" /></div>
          <div className="space-y-1.5">
            <Label>Mode de paiement</Label>
            <select className="flex h-10 w-full rounded-md border px-3 text-sm" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "CASH" | "MOBILE_MONEY")}>
              <option value="CASH">Espèces</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Photo</Label>
            <Input ref={fileRef} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "…" : cook ? "Mettre à jour" : "Ajouter"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CooksPage() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();
  const canManage = ["directeur", "directrice"].includes(session?.user?.role ?? "");
  const isDirector = session?.user?.role === "directeur";
  const { data: cooks, isLoading } = useQuery({
    queryKey: ["cooks"],
    queryFn: async () => (await fetch("/api/cooks")).json() as Promise<ICook[]>,
    enabled: canManage,
  });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ICook | undefined>();
  const [pending, setPending] = useState<ICook | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cooks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => { toast({ variant: "success", title: "Supprimée" }); qc.invalidateQueries({ queryKey: ["cooks"] }); setPending(null); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const toggle = async (c: ICook) => {
    const res = await fetch(`/api/cooks/${c._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: c.isActive ? "deactivate" : "activate" }),
    });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({
      variant: "success",
      title: c.isActive ? "Cuisinière désactivée" : "Cuisinière réactivée",
      description: c.isActive
        ? "Elle n’apparaîtra plus dans les nouvelles commandes."
        : "Elle est de nouveau disponible pour les commandes.",
    });
    qc.invalidateQueries({ queryKey: ["cooks"] });
  };

  if (status === "loading") return <Skeleton className="h-96" />;
  if (!canManage) return <p className="py-20 text-center text-[#9CA3AF]">Accès réservé à la direction.</p>;
  const rows = (cooks ?? []).slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader title="Cuisinières" subtitle="Équipe cuisine" action={<Button onClick={() => { setEdit(undefined); setOpen(true); }}><Plus className="h-4 w-4" />Ajouter</Button>} />
      <div className="mb-8 max-w-xs">{isLoading ? <Skeleton className="h-28" /> : <StatsCard title="Cuisinières" value={cooks?.length ?? 0} icon={ChefHat} index={0} />}</div>
      <PremiumTableShell
        title="Équipe"
        isLoading={isLoading}
        empty={!isLoading && !cooks?.length}
        emptyMessage="Aucune cuisinière"
        skeletonRows={5}
        tableMinWidthClass="min-w-[720px]"
        skeletonColSpan={4}
        mobileContent={
          <MobileCardList>
            {rows.map((c) => (
              <MobileDataCard key={c._id}>
                <MobileDataCardHeader
                  title={`${c.firstName} ${c.lastName}`}
                  badge={
                    c.isActive ? (
                      <span className="inline-flex rounded-full border border-emerald-200/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        Désactivée
                      </span>
                    )
                  }
                />
                <MobileDataCardMeta
                  items={[{ label: "Téléphone", value: c.phone || "—" }]}
                />
                <MobileDataCardActions>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-xl text-xs"
                    onClick={() => toggle(c)}
                  >
                    {c.isActive ? "Désactiver" : "Activer"}
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" asChild>
                    <Link href={`/cooks/${c._id}`} aria-label={`Voir ${c.firstName}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl"
                    onClick={() => { setEdit(c); setOpen(true); }}
                    aria-label="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {isDirector && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl border-rose-200/60 text-rose-600"
                      onClick={() => setPending(c)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </MobileDataCardActions>
              </MobileDataCard>
            ))}
          </MobileCardList>
        }
      >
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase text-slate-500">
              <th className="px-6 py-3 text-left">Cuisinière</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c._id} className="border-b">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    {c.photo ? <ProductThumb imageUrl={c.photo} name={c.firstName} sizeClass="h-10 w-10" /> : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-xs text-white">{getInitials(c.firstName, c.lastName)}</div>
                    )}
                    <span className="font-semibold">{c.firstName} {c.lastName}</span>
                  </div>
                </td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{c.phone}</span></td>
                <td className="px-4 py-3 text-xs">{c.isActive ? "Active" : "Désactivée"}</td>
                <td className="px-6 py-3 text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => toggle(c)}>{c.isActive ? "Désactiver" : "Activer"}</Button>
                  <Button size="icon" variant="outline" asChild><Link href={`/cooks/${c._id}`}><Eye className="h-4 w-4" /></Link></Button>
                  <Button size="icon" variant="outline" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  {isDirector && <Button size="icon" variant="outline" className="text-rose-600" onClick={() => setPending(c)}><Trash2 className="h-4 w-4" /></Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PremiumTableShell>
      <PaginationControls className="mt-6" currentPage={page} pageSize={pageSize} totalItems={cooks?.length ?? 0} onPageChange={setPage} />
      <CookDialog open={open} onClose={() => setOpen(false)} cook={edit} />
      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer ?</DialogTitle><DialogDescription>Si des commandes existent, désactivez plutôt le profil.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => pending && del.mutate(pending._id)}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
