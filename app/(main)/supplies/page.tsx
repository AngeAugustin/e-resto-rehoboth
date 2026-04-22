"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Plus, TruckIcon, Package, DollarSign, Calendar, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { lotSizeSelectOptions, isValidLotSizeChoice } from "@/lib/supply-lot-sizes";
import type { ISupply } from "@/types";

interface ProductOption {
  _id: string;
  name: string;
  sellingPrice: number;
}

async function fetchSupplies(): Promise<ISupply[]> {
  const res = await fetch("/api/supplies");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchProducts(): Promise<ProductOption[]> {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

interface SupplyForm {
  productId: string;
  lotSize: string;
  lotPrice: string;
  numberOfLots: string;
  marketSellingPrice: string;
}

type SupplyDraftLine = SupplyForm & { id: string };

const emptyForm = (): SupplyForm => ({
  productId: "",
  lotSize: "",
  lotPrice: "",
  numberOfLots: "",
  marketSellingPrice: "",
});

const newDraftLine = (): SupplyDraftLine => ({
  id: globalThis.crypto?.randomUUID?.() ?? `line-${Date.now()}-${Math.random()}`,
  ...emptyForm(),
});

function isLineComplete(line: SupplyForm): boolean {
  if (!line.productId) return false;
  const lotPrice = parseFloat(line.lotPrice);
  const numberOfLots = parseInt(line.numberOfLots, 10);
  const marketSellingPrice = parseFloat(line.marketSellingPrice);
  return (
    isValidLotSizeChoice(line.lotSize) &&
    Number.isFinite(lotPrice) &&
    lotPrice >= 0 &&
    Number.isFinite(numberOfLots) &&
    numberOfLots >= 1 &&
    Number.isFinite(marketSellingPrice) &&
    marketSellingPrice >= 0
  );
}

function linePayload(line: SupplyForm) {
  return {
    productId: line.productId,
    lotSize: parseInt(line.lotSize, 10),
    lotPrice: parseFloat(line.lotPrice),
    numberOfLots: parseInt(line.numberOfLots, 10),
    marketSellingPrice: parseFloat(line.marketSellingPrice),
  };
}

function productIdFromSupply(s: ISupply): string {
  const p = s.product;
  if (typeof p === "string") return p;
  if (p && typeof p === "object" && "_id" in p) return String((p as { _id: string })._id);
  return "";
}

function SupplyDialog({
  open,
  onClose,
  supply,
}: {
  open: boolean;
  onClose: () => void;
  supply?: ISupply | null;
}) {
  const qc = useQueryClient();
  const { data: products } = useQuery({ queryKey: ["products-list"], queryFn: fetchProducts });
  const [form, setForm] = useState<SupplyForm>(() => emptyForm());
  const [lines, setLines] = useState<SupplyDraftLine[]>(() => [newDraftLine()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (supply) {
      setForm({
        productId: productIdFromSupply(supply),
        lotSize: String(supply.lotSize),
        lotPrice: String(supply.lotPrice),
        numberOfLots: String(supply.numberOfLots),
        marketSellingPrice: String(supply.marketSellingPrice),
      });
    } else {
      setForm(emptyForm());
      setLines([newDraftLine()]);
    }
  }, [open, supply]);

  const updateLine = (id: string, patch: Partial<SupplyForm>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, newDraftLine()]);
  const removeLine = (id: string) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));

  /** Produit déjà pris sur une autre ligne → masqué dans ce sélecteur */
  const productsForLine = (lineId: string) =>
    (products ?? []).filter((p) => {
      const takenOnAnotherLine = lines.some(
        (l) => l.id !== lineId && l.productId !== "" && l.productId === p._id
      );
      return !takenOnAnotherLine;
    });

  const createTotals = lines.reduce(
    (acc, line) => {
      if (!isLineComplete(line)) return acc;
      const u = parseInt(line.lotSize, 10) * parseInt(line.numberOfLots, 10);
      const c = parseFloat(line.lotPrice) * parseInt(line.numberOfLots, 10);
      return { units: acc.units + u, cost: acc.cost + c };
    },
    { units: 0, cost: 0 }
  );

  const editTotalUnits =
    form.lotSize && form.numberOfLots ? parseInt(form.lotSize, 10) * parseInt(form.numberOfLots, 10) : 0;
  const editTotalCost =
    form.lotPrice && form.numberOfLots
      ? parseFloat(form.lotPrice) * parseInt(form.numberOfLots, 10)
      : 0;

  const createSubmitDisabled =
    isSubmitting || lines.length === 0 || lines.some((l) => !isLineComplete(l));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (supply) {
      const payload = linePayload(form);
      const res = await fetch(`/api/supplies/${supply._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setIsSubmitting(false);
      if (!res.ok) {
        const err = await res.json();
        toast({ variant: "destructive", title: "Erreur", description: err.error });
        return;
      }
      toast({ variant: "success", title: "Approvisionnement modifié" });
    } else {
      const items = lines.map((l) => linePayload(l));
      const res = await fetch("/api/supplies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      setIsSubmitting(false);
      if (!res.ok) {
        const err = await res.json();
        toast({ variant: "destructive", title: "Erreur", description: err.error });
        return;
      }
      const data = await res.json();
      const n = Array.isArray(data.supplies) ? data.supplies.length : items.length;
      toast({
        variant: "success",
        title: n > 1 ? `${n} approvisionnements enregistrés` : "Approvisionnement enregistré",
      });
    }

    qc.invalidateQueries({ queryKey: ["supplies"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["products-list"] });
    onClose();
    setForm(emptyForm());
    setLines([newDraftLine()]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supply ? "Modifier l’approvisionnement" : "Nouvel approvisionnement"}</DialogTitle>
          {!supply && (
            <DialogDescription>
              Ajoutez une ou plusieurs lignes pour enregistrer plusieurs produits dans le même flux.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {supply ? (
            <>
              <div className="space-y-1.5">
                <Label>Produit</Label>
                <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un produit" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Taille du lot (unités)</Label>
                  <Select
                    value={form.lotSize === "" ? undefined : form.lotSize}
                    onValueChange={(v) => setForm({ ...form, lotSize: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une taille" />
                    </SelectTrigger>
                    <SelectContent>
                      {lotSizeSelectOptions(form.lotSize).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prix du lot (FCFA)</Label>
                  <Input
                    type="number"
                    placeholder="5000"
                    value={form.lotPrice}
                    onChange={(e) => setForm({ ...form, lotPrice: e.target.value })}
                    required
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre de lots</Label>
                  <Input
                    type="number"
                    placeholder="4"
                    value={form.numberOfLots}
                    onChange={(e) => setForm({ ...form, numberOfLots: e.target.value })}
                    required
                    min={1}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Prix vente marché (FCFA)</Label>
                  <Input
                    type="number"
                    placeholder="1500"
                    value={form.marketSellingPrice}
                    onChange={(e) => setForm({ ...form, marketSellingPrice: e.target.value })}
                    required
                    min={0}
                  />
                </div>
              </div>

              {editTotalUnits > 0 && (
                <div className="space-y-1 rounded-lg bg-[#F5F5F5] p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Total unités</span>
                    <span className="font-semibold text-[#0D0D0D]">{editTotalUnits} unités</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Coût total</span>
                    <span className="font-semibold text-[#0D0D0D]">{formatCurrency(editTotalCost)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div
                    key={line.id}
                    className="relative space-y-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA]/50 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                        Produit {index + 1}
                      </span>
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => removeLine(line.id)}
                          aria-label="Retirer cette ligne"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Produit</Label>
                      <Select
                        value={line.productId}
                        onValueChange={(v) => updateLine(line.id, { productId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un produit" />
                        </SelectTrigger>
                        <SelectContent>
                          {productsForLine(line.id).map((p) => (
                            <SelectItem key={p._id} value={p._id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Taille du lot (unités)</Label>
                        <Select
                          value={line.lotSize === "" ? undefined : line.lotSize}
                          onValueChange={(v) => updateLine(line.id, { lotSize: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir une taille" />
                          </SelectTrigger>
                          <SelectContent>
                            {lotSizeSelectOptions(line.lotSize).map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Prix du lot (FCFA)</Label>
                        <Input
                          type="number"
                          placeholder="5000"
                          value={line.lotPrice}
                          onChange={(e) => updateLine(line.id, { lotPrice: e.target.value })}
                          min={0}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Nombre de lots</Label>
                        <Input
                          type="number"
                          placeholder="4"
                          value={line.numberOfLots}
                          onChange={(e) => updateLine(line.id, { numberOfLots: e.target.value })}
                          min={1}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Prix vente marché (FCFA)</Label>
                        <Input
                          type="number"
                          placeholder="1500"
                          value={line.marketSellingPrice}
                          onChange={(e) => updateLine(line.id, { marketSellingPrice: e.target.value })}
                          min={0}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" className="w-full border-dashed" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un produit
              </Button>

              {createTotals.units > 0 && (
                <div className="space-y-1 rounded-lg bg-[#F5F5F5] p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Total unités (toutes lignes)</span>
                    <span className="font-semibold text-[#0D0D0D]">{createTotals.units} unités</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Coût total (toutes lignes)</span>
                    <span className="font-semibold text-[#0D0D0D]">{formatCurrency(createTotals.cost)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={supply ? isSubmitting || !isLineComplete(form) : createSubmitDisabled}
            >
              {isSubmitting ? "Enregistrement..." : supply ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SuppliesPage() {
  const PAGE_SIZE = 10;
  const { data: session } = useSession();
  const isDirector = session?.user?.role === "directeur";
  const qc = useQueryClient();
  const { data: supplies, isLoading } = useQuery({
    queryKey: ["supplies"],
    queryFn: fetchSupplies,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editSupply, setEditSupply] = useState<ISupply | null>(null);
  const [supplyToDelete, setSupplyToDelete] = useState<ISupply | null>(null);

  const deleteSupply = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/supplies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      toast({ variant: "success", title: "Approvisionnement supprimé" });
      qc.invalidateQueries({ queryKey: ["supplies"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-list"] });
      setSupplyToDelete(null);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  const openCreate = () => {
    setEditSupply(null);
    setDialogOpen(true);
  };

  const openEdit = (s: ISupply) => {
    setEditSupply(s);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditSupply(null);
  };

  const totalSupplies = supplies?.length ?? 0;
  const totalUnits = supplies?.reduce((s, a) => s + a.totalUnits, 0) ?? 0;
  const totalCost = supplies?.reduce((s, a) => s + a.totalCost, 0) ?? 0;
  const lastSupply = supplies?.[0];
  const paginatedSupplies = (supplies ?? []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil((supplies?.length ?? 0) / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div>
      <PageHeader
        title="Approvisionnements"
        subtitle="Gérez les entrées de stock"
        action={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouvel approvisionnement
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatsCard title="Total entrées" value={totalSupplies} icon={TruckIcon} index={0} />
            <StatsCard title="Unités reçues" value={totalUnits} icon={Package} index={1} />
            <StatsCard title="Coût total achats" value={formatCurrency(totalCost)} icon={DollarSign} variant="dark" index={2} />
            <StatsCard
              title="Dernier approv."
              value={lastSupply ? formatDate(lastSupply.createdAt) : "—"}
              icon={Calendar}
              index={3}
            />
          </>
        )}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique des approvisionnements</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : supplies?.length === 0 ? (
              <p className="text-center py-12 text-[#9CA3AF]">
                Aucun approvisionnement enregistré
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F5F5F5]">
                      <th className="text-left py-3 px-3 text-xs font-medium text-[#9CA3AF]">Date</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-[#9CA3AF]">Produit</th>
                      <th className="text-center py-3 px-3 text-xs font-medium text-[#9CA3AF]">Lots</th>
                      <th className="text-center py-3 px-3 text-xs font-medium text-[#9CA3AF]">Unités reçues</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[#9CA3AF]">Coût total</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[#9CA3AF]">Prix vente</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-[#9CA3AF]">Enregistré par</th>
                      {isDirector && (
                        <th className="text-right py-3 px-3 text-xs font-medium text-[#9CA3AF] w-[100px]">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSupplies.map((supply) => {
                      const product = supply.product as { name: string };
                      const user = supply.createdBy as { firstName: string; lastName: string };
                      return (
                        <tr
                          key={supply._id}
                          className="border-b border-[#FAFAFA] hover:bg-[#FAFAFA] transition-colors"
                        >
                          <td className="py-3 px-3 text-[#6B7280]">{formatDate(supply.createdAt)}</td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-[#0D0D0D]">{product?.name}</span>
                          </td>
                          <td className="py-3 px-3 text-center text-[#374151]">
                            {supply.numberOfLots} × {supply.lotSize}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Badge variant="secondary">{supply.totalUnits} unités</Badge>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-[#0D0D0D]">
                            {formatCurrency(supply.totalCost)}
                          </td>
                          <td className="py-3 px-3 text-right text-[#374151]">
                            {formatCurrency(supply.marketSellingPrice)}
                          </td>
                          <td className="py-3 px-3 text-[#6B7280] text-xs">
                            {user?.firstName} {user?.lastName}
                          </td>
                          {isDirector && (
                            <td className="py-3 px-3 text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEdit(supply)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => setSupplyToDelete(supply)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <PaginationControls
        className="mt-6"
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={supplies?.length ?? 0}
        onPageChange={setCurrentPage}
      />

      <SupplyDialog open={dialogOpen} onClose={closeDialog} supply={editSupply} />

      <Dialog open={!!supplyToDelete} onOpenChange={(open) => !open && setSupplyToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer l’approvisionnement</DialogTitle>
            <DialogDescription>
              {supplyToDelete ? (
                <>
                  Voulez-vous vraiment supprimer cette entrée pour «{" "}
                  {(supplyToDelete.product as { name?: string })?.name ?? "ce produit"} » du{" "}
                  {formatDate(supplyToDelete.createdAt)} ? Les stocks calculés seront mis à jour. Cette
                  action est irréversible.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setSupplyToDelete(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteSupply.isPending}
              onClick={() => supplyToDelete && deleteSupply.mutate(supplyToDelete._id)}
            >
              {deleteSupply.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
