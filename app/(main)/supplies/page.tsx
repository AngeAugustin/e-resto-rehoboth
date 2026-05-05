"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumTableShell, premiumTableSelectClass } from "@/components/shared/PremiumTableShell";
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
import {
  SUPPLY_LOT_SIZES,
  SUPPLY_LOT_SIZE_SELECT_OTHER,
  isStandardSupplyLotSize,
  isValidLotSizeChoice,
} from "@/lib/supply-lot-sizes";
import type { ISupply } from "@/types";

interface ProductOption {
  _id: string;
  name: string;
  image?: string;
  marketSellingPrice: number;
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

function sortProductsByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

interface SupplyForm {
  productId: string;
  lotSize: string;
  /** « preset » : 6 / 12 / 24 ; « custom » : saisie libre (entier obligatoire) */
  lotSizeMode: "preset" | "custom";
  lotPrice: string;
  numberOfLots: string;
  marketSellingPrice: string;
}

type SupplyDraftLine = SupplyForm & { id: string };

const emptyForm = (): SupplyForm => ({
  productId: "",
  lotSize: "",
  lotSizeMode: "preset",
  lotPrice: "",
  numberOfLots: "",
  marketSellingPrice: "",
});

const newDraftLine = (): SupplyDraftLine => ({
  id: globalThis.crypto?.randomUUID?.() ?? `line-${Date.now()}-${Math.random()}`,
  ...emptyForm(),
});

function isLineComplete(line: SupplyForm, products: ProductOption[] | undefined): boolean {
  if (!line.productId) return false;
  if (products && !products.some((p) => p._id === line.productId)) return false;
  const lotPrice = parseFloat(line.lotPrice);
  const numberOfLots = parseInt(line.numberOfLots, 10);
  const marketSellingPrice = parseFloat(line.marketSellingPrice);
  if (
    !isValidLotSizeChoice(line.lotSize) ||
    !Number.isFinite(lotPrice) ||
    lotPrice < 0 ||
    !Number.isFinite(numberOfLots) ||
    numberOfLots < 1 ||
    !Number.isFinite(marketSellingPrice) ||
    marketSellingPrice <= 0
  ) {
    return false;
  }
  return true;
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

/** Données pour le récap « casiers / taille / prix / total » sur une ligne d’appro */
function supplyLineRecapValues(line: SupplyForm) {
  const nbCasiers = parseInt(line.numberOfLots, 10);
  const taille = parseInt(line.lotSize, 10);
  const prixCasier = parseFloat(line.lotPrice);
  const nOk = Number.isFinite(nbCasiers) && nbCasiers >= 1;
  const tOk = Number.isFinite(taille) && taille >= 1;
  const pOk = Number.isFinite(prixCasier) && prixCasier >= 0;
  return {
    nbCasiers: nOk ? nbCasiers : null,
    taille: tOk ? taille : null,
    prixCasier: pOk ? prixCasier : null,
    montantCasiers: nOk && pOk ? nbCasiers * prixCasier : null,
    totalUnites: nOk && tOk ? nbCasiers * taille : null,
  };
}

function productIdFromSupply(s: ISupply): string {
  const p = s.product;
  if (typeof p === "string") return p;
  if (p && typeof p === "object" && "_id" in p) return String((p as { _id: string })._id);
  return "";
}

/** Aperçu image dans le modal appro : remplit la colonne (hauteur des champs), recouvre en object-cover */
function SupplyLineProductImage({ imageUrl, label }: { imageUrl?: string; label: string }) {
  const [broken, setBroken] = useState(false);
  const onError = useCallback(() => setBroken(true), []);

  useEffect(() => {
    setBroken(false);
  }, [imageUrl]);

  return (
    <div className="relative min-h-[7.5rem] flex-1 overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#F3F4F6]">
      {imageUrl && !broken ? (
        <img
          src={imageUrl}
          alt={label}
          className="absolute inset-0 h-full w-full object-cover"
          onError={onError}
        />
      ) : null}
      {(!imageUrl || broken) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
          <Package className="h-8 w-8 text-[#D1D5DB]" aria-hidden />
          <span className="text-[10px] font-medium text-[#9CA3AF]">Sans image</span>
        </div>
      )}
    </div>
  );
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
        lotSizeMode: isStandardSupplyLotSize(supply.lotSize) ? "preset" : "custom",
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
    sortProductsByName(
      (products ?? []).filter((p) => {
        const takenOnAnotherLine = lines.some(
          (l) => l.id !== lineId && l.productId !== "" && l.productId === p._id
        );
        return !takenOnAnotherLine;
      })
    );

  const createTotals = lines.reduce(
    (acc, line) => {
      if (!isLineComplete(line, products)) return acc;
      const u = parseInt(line.lotSize, 10) * parseInt(line.numberOfLots, 10);
      const c = parseFloat(line.lotPrice) * parseInt(line.numberOfLots, 10);
      return { units: acc.units + u, cost: acc.cost + c };
    },
    { units: 0, cost: 0 }
  );

  const createSubmitDisabled =
    isSubmitting || lines.length === 0 || lines.some((l) => !isLineComplete(l, products));

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
    qc.invalidateQueries({ queryKey: ["products-stock"] });
    qc.invalidateQueries({ queryKey: ["product"] });
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
                <Select
                  value={form.productId}
                  onValueChange={(v) => {
                    const p = products?.find((x) => x._id === v);
                    const pref =
                      p?.marketSellingPrice != null && Number.isFinite(p.marketSellingPrice)
                        ? String(p.marketSellingPrice)
                        : "";
                    setForm({ ...form, productId: v, marketSellingPrice: pref });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un produit" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortProductsByName(products ?? []).map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Taille du casier (unités)</Label>
                  <Select
                    value={
                      form.lotSizeMode === "custom"
                        ? SUPPLY_LOT_SIZE_SELECT_OTHER
                        : form.lotSize === ""
                          ? undefined
                          : form.lotSize
                    }
                    onValueChange={(v) => {
                      if (v === SUPPLY_LOT_SIZE_SELECT_OTHER) {
                        setForm({ ...form, lotSizeMode: "custom", lotSize: "" });
                      } else {
                        setForm({ ...form, lotSizeMode: "preset", lotSize: v });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une taille" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLY_LOT_SIZES.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                      <SelectItem value={SUPPLY_LOT_SIZE_SELECT_OTHER}>Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.lotSizeMode === "custom" ? (
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Nombre d’unités (entier)"
                      value={form.lotSize}
                      onChange={(e) => setForm({ ...form, lotSize: e.target.value })}
                      required
                    />
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Prix du casier (FCFA)</Label>
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
                  <Label>Nombre de casiers</Label>
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
                    placeholder="Prix fiche produit"
                    value={form.marketSellingPrice}
                    onChange={(e) => setForm({ ...form, marketSellingPrice: e.target.value })}
                    required
                    min={0}
                  />
                  <p className="text-[10px] text-[#9CA3AF]">
                    Valeur enregistrée sur la fiche produit (strictement positive). Modifiable ici.
                  </p>
                </div>
              </div>

              {(() => {
                const recapEdit = supplyLineRecapValues(form);
                return (
                  <div className="rounded-lg border border-primary/25 bg-primary px-3 py-2.5">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                      Récapitulatif
                    </p>
                    <p className="text-sm leading-relaxed text-primary-foreground/90">
                      <span className="font-semibold text-primary-foreground">{recapEdit.nbCasiers ?? "—"}</span>{" "}
                      {recapEdit.nbCasiers === 1 ? "casier" : "casiers"} de{" "}
                      <span className="font-semibold text-primary-foreground">{recapEdit.taille ?? "—"}</span>{" "}
                      unité{recapEdit.taille === 1 ? "" : "s"} à{" "}
                      <span className="font-semibold text-primary-foreground">
                        {recapEdit.prixCasier != null ? formatCurrency(recapEdit.prixCasier) : "—"}
                      </span>{" "}
                      par casier, soit{" "}
                      <span className="font-semibold text-primary-foreground">
                        {recapEdit.montantCasiers != null ? formatCurrency(recapEdit.montantCasiers) : "—"}
                      </span>{" "}
                      pour ce produit
                      {recapEdit.totalUnites != null ? (
                        <span className="text-primary-foreground/75">
                          {" "}
                          ({recapEdit.totalUnites} unité{recapEdit.totalUnites > 1 ? "s" : ""} au total)
                        </span>
                      ) : null}
                      .
                    </p>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <div className="space-y-4">
                {lines.map((line, index) => {
                  const selectedProduct = line.productId
                    ? products?.find((p) => p._id === line.productId)
                    : undefined;
                  const recap = supplyLineRecapValues(line);
                  return (
                    <div
                      key={line.id}
                      className="relative rounded-lg border border-[#E5E5E5] bg-[#FAFAFA]/50 p-4"
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

                      <div
                        className={`mt-3 flex gap-4 items-stretch ${selectedProduct ? "" : "flex-col"}`}
                      >
                        {selectedProduct ? (
                          <div className="flex w-[30%] shrink-0 flex-col self-stretch">
                            <SupplyLineProductImage
                              imageUrl={selectedProduct.image}
                              label={selectedProduct.name}
                            />
                          </div>
                        ) : null}

                        <div
                          className={`min-w-0 space-y-3 ${selectedProduct ? "w-[70%] shrink-0" : "w-full"}`}
                        >
                          <div className="space-y-1.5">
                            <Label>Produit</Label>
                            <Select
                              value={line.productId}
                              onValueChange={(v) => {
                                const p = products?.find((x) => x._id === v);
                                const pref =
                                  p?.marketSellingPrice != null && Number.isFinite(p.marketSellingPrice)
                                    ? String(p.marketSellingPrice)
                                    : "";
                                updateLine(line.id, { productId: v, marketSellingPrice: pref });
                              }}
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
                              <Label>Taille du casier (unités)</Label>
                              <Select
                                value={
                                  line.lotSizeMode === "custom"
                                    ? SUPPLY_LOT_SIZE_SELECT_OTHER
                                    : line.lotSize === ""
                                      ? undefined
                                      : line.lotSize
                                }
                                onValueChange={(v) => {
                                  if (v === SUPPLY_LOT_SIZE_SELECT_OTHER) {
                                    updateLine(line.id, { lotSizeMode: "custom", lotSize: "" });
                                  } else {
                                    updateLine(line.id, { lotSizeMode: "preset", lotSize: v });
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choisir une taille" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SUPPLY_LOT_SIZES.map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={SUPPLY_LOT_SIZE_SELECT_OTHER}>Autre</SelectItem>
                                </SelectContent>
                              </Select>
                              {line.lotSizeMode === "custom" ? (
                                <Input
                                  type="number"
                                  min={1}
                                  step={1}
                                  placeholder="Nombre d’unités (entier)"
                                  value={line.lotSize}
                                  onChange={(e) => updateLine(line.id, { lotSize: e.target.value })}
                                  required
                                />
                              ) : null}
                            </div>
                            <div className="space-y-1.5">
                              <Label>Prix du casier (FCFA)</Label>
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
                              <Label>Nombre de casiers</Label>
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
                                placeholder="Défaut fiche produit"
                                value={line.marketSellingPrice}
                                onChange={(e) => updateLine(line.id, { marketSellingPrice: e.target.value })}
                                min={0}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedProduct ? (
                        <div className="mt-3 rounded-lg border border-primary/25 bg-primary px-3 py-2.5">
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                            Récapitulatif
                          </p>
                          <p className="text-sm leading-relaxed text-primary-foreground/90">
                            <span className="font-semibold text-primary-foreground">
                              {recap.nbCasiers ?? "—"}
                            </span>{" "}
                            {recap.nbCasiers === 1 ? "casier" : "casiers"} de{" "}
                            <span className="font-semibold text-primary-foreground">{recap.taille ?? "—"}</span>{" "}
                            unité{recap.taille === 1 ? "" : "s"} à{" "}
                            <span className="font-semibold text-primary-foreground">
                              {recap.prixCasier != null ? formatCurrency(recap.prixCasier) : "—"}
                            </span>{" "}
                            par casier, soit{" "}
                            <span className="font-semibold text-primary-foreground">
                              {recap.montantCasiers != null ? formatCurrency(recap.montantCasiers) : "—"}
                            </span>{" "}
                            pour ce produit
                            {recap.totalUnites != null ? (
                              <span className="text-primary-foreground/75">
                                {" "}
                                ({recap.totalUnites} unité{recap.totalUnites > 1 ? "s" : ""} au total).
                              </span>
                            ) : (
                              "."
                            )}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
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
              disabled={
                supply ? isSubmitting || !isLineComplete(form, products) : createSubmitDisabled
              }
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
  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;
  const { data: session } = useSession();
  const isDirector = session?.user?.role === "directeur";
  const qc = useQueryClient();
  const { data: supplies, isLoading } = useQuery({
    queryKey: ["supplies"],
    queryFn: fetchSupplies,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
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
  const paginatedSupplies = (supplies ?? []).slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil((supplies?.length ?? 0) / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

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
          title="Historique des approvisionnements"
          isLoading={isLoading}
          empty={!isLoading && (supplies?.length === 0)}
          emptyMessage="Aucun approvisionnement enregistré"
          skeletonRows={5}
          tableMinWidthClass="min-w-[980px]"
          skeletonColSpan={isDirector ? 8 : 7}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-950/[0.025] text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <th className="whitespace-nowrap px-6 py-3.5 font-semibold">Date</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Produit</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-center font-semibold">Casiers</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-center font-semibold">Unités reçues</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right font-semibold">Coût total</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right font-semibold">Prix vente</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Enregistré par</th>
                  {isDirector && (
                    <th className="whitespace-nowrap px-6 py-3.5 text-right font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/90">
                {paginatedSupplies.map((supply) => {
                  const product = supply.product as { name: string };
                  const user = supply.createdBy as { firstName: string; lastName: string };
                  return (
                    <tr
                      key={supply._id}
                      className="group transition-colors duration-200 hover:bg-gradient-to-r hover:from-violet-500/[0.04] hover:via-transparent hover:to-cyan-500/[0.03]"
                    >
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/55 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-950/80">
                          {formatDate(supply.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-slate-900">{product?.name}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center rounded-full border border-violet-200/60 bg-violet-500/12 px-2.5 py-0.5 text-xs font-semibold text-violet-900 backdrop-blur-[2px]">
                          {supply.numberOfLots} × {supply.lotSize}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center rounded-full border border-emerald-200/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90">
                          {supply.totalUnits} unités
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">
                        {formatCurrency(supply.totalCost)}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-slate-600">
                        {formatCurrency(supply.marketSellingPrice)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded-full border border-slate-200/60 bg-slate-500/[0.08] px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {user?.firstName} {user?.lastName}
                        </span>
                      </td>
                      {isDirector && (
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex justify-end gap-1 opacity-90 transition group-hover:opacity-100">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-xl border-slate-200/80 bg-white/80 text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-violet-200 hover:bg-violet-500/8 hover:text-violet-900"
                              onClick={() => openEdit(supply)}
                              aria-label="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-xl border-rose-200/60 bg-rose-500/[0.06] text-rose-600 shadow-sm backdrop-blur-sm transition hover:border-rose-300 hover:bg-rose-500/12 hover:text-rose-700"
                              onClick={() => setSupplyToDelete(supply)}
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
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
        </PremiumTableShell>
      </motion.div>

      <PaginationControls
        className="mt-6"
        currentPage={currentPage}
        pageSize={pageSize}
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
