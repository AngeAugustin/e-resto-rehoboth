"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Plus, TruckIcon, Package, DollarSign, Calendar, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
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

const emptyForm = (): SupplyForm => ({
  productId: "",
  lotSize: "",
  lotPrice: "",
  numberOfLots: "",
  marketSellingPrice: "",
});

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
  const [form, setForm] = useState<SupplyForm>(emptyForm);
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
    }
  }, [open, supply]);

  const totalUnits =
    form.lotSize && form.numberOfLots
      ? parseInt(form.lotSize) * parseInt(form.numberOfLots)
      : 0;
  const totalCost =
    form.lotPrice && form.numberOfLots
      ? parseFloat(form.lotPrice) * parseInt(form.numberOfLots)
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      productId: form.productId,
      lotSize: parseInt(form.lotSize, 10),
      lotPrice: parseFloat(form.lotPrice),
      numberOfLots: parseInt(form.numberOfLots, 10),
      marketSellingPrice: parseFloat(form.marketSellingPrice),
    };

    const url = supply ? `/api/supplies/${supply._id}` : "/api/supplies";
    const method = supply ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const err = await res.json();
      toast({ variant: "destructive", title: "Erreur", description: err.error });
      return;
    }

    toast({
      variant: "success",
      title: supply ? "Approvisionnement modifié" : "Approvisionnement enregistré",
    });
    qc.invalidateQueries({ queryKey: ["supplies"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["products-list"] });
    onClose();
    setForm(emptyForm());
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{supply ? "Modifier l’approvisionnement" : "Nouvel approvisionnement"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <Input
                type="number"
                placeholder="6"
                value={form.lotSize}
                onChange={(e) => setForm({ ...form, lotSize: e.target.value })}
                required
                min={1}
              />
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

          {/* Summary */}
          {totalUnits > 0 && (
            <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Total unités</span>
                <span className="font-semibold text-[#0D0D0D]">{totalUnits} unités</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Coût total</span>
                <span className="font-semibold text-[#0D0D0D]">{formatCurrency(totalCost)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting || !form.productId}>
              {isSubmitting ? "Enregistrement..." : supply ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SuppliesPage() {
  const { data: session } = useSession();
  const isDirector = session?.user?.role === "directeur";
  const qc = useQueryClient();
  const { data: supplies, isLoading } = useQuery({
    queryKey: ["supplies"],
    queryFn: fetchSupplies,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
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
                    {supplies?.map((supply) => {
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
