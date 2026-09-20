"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  UtensilsCrossed,
  Search,
  ImageIcon,
  Ban,
  Power,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { PaginationControls } from "@/components/shared/PaginationControls";
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
import { cn, formatCurrency } from "@/lib/utils";
import { resolveProductImageDisplayUrl } from "@/lib/media-urls";
import { ProductThumb } from "@/components/sales/ProductThumb";
import type { IMenu } from "@/types";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

function MenuDialog({ open, onClose, menu }: { open: boolean; onClose: () => void; menu?: IMenu }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(menu?.name ?? "");
    setPrice(menu?.price != null ? String(menu.price) : "");
    setImage(menu?.image ?? "");
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }, [open, menu]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let imageUrl = image;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/media/upload", { method: "POST", body: fd });
      if (!up.ok) {
        setSaving(false);
        const err = await up.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Upload", description: err.error ?? "Échec" });
        return;
      }
      imageUrl = (await up.json()).url;
    }
    const res = await fetch(menu ? `/api/menus/${menu._id}` : "/api/menus", {
      method: menu ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        price: Number(price),
        ...(imageUrl ? { image: imageUrl } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        variant: "destructive",
        title: "Erreur",
        description: typeof err.error === "string" ? err.error : "Enregistrement impossible",
      });
      return;
    }
    toast({ variant: "success", title: menu ? "Menu modifié" : "Menu ajouté" });
    qc.invalidateQueries({ queryKey: ["menus"] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{menu ? "Modifier le menu" : "Nouveau menu"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Prix (FCFA)</Label>
            <Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Photo (facultatif)</Label>
            <Input
              ref={fileRef}
              type="file"
              accept={ACCEPTED.join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFile(f);
                setPreview(URL.createObjectURL(f));
              }}
            />
            {(preview || image) && (
              <ProductThumb imageUrl={preview || image} name={name || "Menu"} sizeClass="h-20 w-20" />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : menu ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MenusPage() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();
  const canManage = ["directeur", "directrice", "gerant"].includes(session?.user?.role ?? "");
  const isDirector = session?.user?.role === "directeur";

  const { data: menus, isLoading } = useQuery({
    queryKey: ["menus"],
    queryFn: async () => (await fetch("/api/menus")).json() as Promise<IMenu[]>,
    enabled: canManage,
  });

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<IMenu | undefined>();
  const [pendingDelete, setPendingDelete] = useState<IMenu | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<{ menu: IMenu; nextActive: boolean } | null>(null);
  const [toggling, setToggling] = useState(false);
  const [search, setSearch] = useState("");
  const [priceMinFilter, setPriceMinFilter] = useState("");
  const [priceMaxFilter, setPriceMaxFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/menus/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      toast({ variant: "success", title: "Menu supprimé" });
      qc.invalidateQueries({ queryKey: ["menus"] });
      setPendingDelete(null);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const commitToggle = async () => {
    if (!toggleConfirm) return;
    setToggling(true);
    const { menu, nextActive } = toggleConfirm;
    const res = await fetch(`/api/menus/${menu._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: nextActive ? "activate" : "deactivate" }),
    });
    setToggling(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({
      variant: "success",
      title: nextActive ? "Menu réactivé" : "Menu désactivé",
    });
    qc.invalidateQueries({ queryKey: ["menus"] });
    setToggleConfirm(null);
  };

  const minPrice = priceMinFilter.trim() === "" ? null : Number(priceMinFilter);
  const maxPrice = priceMaxFilter.trim() === "" ? null : Number(priceMaxFilter);

  const filtered = useMemo(() => {
    return (menus ?? []).filter((m) => {
      const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase());
      const matchesMin =
        minPrice === null || Number.isNaN(minPrice) ? true : m.price >= minPrice;
      const matchesMax =
        maxPrice === null || Number.isNaN(maxPrice) ? true : m.price <= maxPrice;
      return matchesSearch && matchesMin && matchesMax;
    });
  }, [menus, search, minPrice, maxPrice]);

  const activeCount = (menus ?? []).filter((m) => m.isActive).length;
  const inactiveCount = (menus ?? []).length - activeCount;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, priceMinFilter, priceMaxFilter, pageSize]);

  if (status === "loading") return <Skeleton className="h-96" />;
  if (!canManage) {
    return <p className="py-20 text-center text-[#9CA3AF]">Accès refusé.</p>;
  }

  return (
    <div>
      <PageHeader
        title="Menus"
        subtitle="Référentiel des plats proposés en cuisine"
        action={
          <Button
            onClick={() => {
              setEdit(undefined);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nouveau menu
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatsCard title="Total menus" value={menus?.length ?? 0} icon={UtensilsCrossed} index={0} />
            <StatsCard title="Actifs" value={activeCount} icon={Power} index={1} />
            <StatsCard title="Désactivés" value={inactiveCount} icon={Ban} index={2} />
          </>
        )}
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un menu…"
            className="pl-9"
          />
        </div>
        <Input
          type="number"
          min={0}
          placeholder="Prix min"
          value={priceMinFilter}
          onChange={(e) => setPriceMinFilter(e.target.value)}
        />
        <Input
          type="number"
          min={0}
          placeholder="Prix max"
          value={priceMaxFilter}
          onChange={(e) => setPriceMaxFilter(e.target.value)}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-[#6B7280]">
          Cartes par page
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
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

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <UtensilsCrossed className="mx-auto mb-3 h-12 w-12 text-[#E5E5E5]" />
          <p className="text-[#9CA3AF]">Aucun menu trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence>
            {paginated.map((menu, i) => {
              const imageSrc = resolveProductImageDisplayUrl(menu.image);
              return (
                <motion.div
                  key={menu._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  whileHover={{ y: -2 }}
                  className={cn(
                    "group overflow-hidden rounded-xl border border-[#E5E5E5] bg-white transition-all duration-200 hover:shadow-md",
                    !menu.isActive && "opacity-[0.92]"
                  )}
                >
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[#F5F5F5]">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={menu.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-[#D1D5DB]" />
                    )}
                    {!menu.isActive && (
                      <div className="absolute left-2 top-2 z-[1]">
                        <Badge variant="outline" className="border-[#D1D5DB] bg-white/95 text-[#6B7280]">
                          Désactivé
                        </Badge>
                      </div>
                    )}
                    {menu.isActive && (
                      <div className="absolute right-2 top-2 z-[1]">
                        <Badge
                          variant="secondary"
                          className="border border-emerald-200/60 bg-emerald-500/10 text-emerald-900"
                        >
                          Actif
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-[#0D0D0D]">{menu.name}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#0D0D0D]">
                      {formatCurrency(menu.price)}
                    </p>
                    <div className="mt-2 flex items-center justify-end">
                      <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={menu.isActive ? "Désactiver" : "Réactiver"}
                          disabled={toggling}
                          onClick={() =>
                            setToggleConfirm({
                              menu,
                              nextActive: !menu.isActive,
                            })
                          }
                        >
                          {menu.isActive ? (
                            <Ban className="h-3.5 w-3.5 text-[#6B7280]" />
                          ) : (
                            <Power className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEdit(menu);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isDirector && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => setPendingDelete(menu)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <PaginationControls
        className="mt-6"
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={filtered.length}
        onPageChange={setCurrentPage}
      />

      <MenuDialog open={open} onClose={() => setOpen(false)} menu={edit} />

      <Dialog
        open={!!toggleConfirm}
        onOpenChange={(v) => {
          if (!v && !toggling) setToggleConfirm(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {toggleConfirm?.nextActive ? "Réactiver le menu" : "Désactiver le menu"}
            </DialogTitle>
            <DialogDescription>
              {toggleConfirm ? (
                toggleConfirm.nextActive ? (
                  <>
                    Voulez-vous réactiver{" "}
                    <span className="font-medium text-[#0D0D0D]">{toggleConfirm.menu.name}</span> ?
                    Il sera à nouveau proposé dans les commandes cuisine.
                  </>
                ) : (
                  <>
                    Voulez-vous désactiver{" "}
                    <span className="font-medium text-[#0D0D0D]">{toggleConfirm.menu.name}</span> ?
                    Il ne sera plus proposé dans les nouvelles commandes.
                  </>
                )
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={toggling} onClick={() => setToggleConfirm(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant={toggleConfirm?.nextActive ? "default" : "destructive"}
              disabled={toggling || !toggleConfirm}
              onClick={commitToggle}
            >
              {toggling
                ? "Enregistrement…"
                : toggleConfirm?.nextActive
                  ? "Réactiver"
                  : "Désactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce menu ?</DialogTitle>
            <DialogDescription>
              Si des commandes y sont liées, désactivez-le plutôt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => pendingDelete && del.mutate(pendingDelete._id)}
            >
              {del.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
