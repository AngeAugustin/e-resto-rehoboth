"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Minus,
  X,
  ChevronRight,
  User,
  UtensilsCrossed,
  Receipt,
  Package,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import type { IWaitress, IRestaurantTable, ISale, ISaleItem } from "@/types";
import { formatTableIdsWithCatalog, saleTableIdsFromPayload } from "@/lib/sale-tables";
import { ProductThumb } from "@/components/sales/ProductThumb";

interface ProductWithStock {
  _id: string;
  name: string;
  image?: string;
  sellingPrice: number;
  /** Prix unitaire appliqué en vente (dernier appro) */
  marketSellingPrice: number;
  /** Coût d’achat unitaire du dernier appro */
  purchaseUnitCost: number;
  stock: number;
}

interface CartItem {
  productId: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  maxStock: number;
}

type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string; description: string; icon: typeof User }[] = [
  { n: 1, label: "Service", description: "Serveuse et tables", icon: User },
  { n: 2, label: "Commande", description: "Sélection des produits", icon: Package },
  { n: 3, label: "Validation", description: "Récapitulatif", icon: Receipt },
];

function productIdFromItem(item: ISaleItem): string {
  const p = item.product;
  if (typeof p === "string") return p;
  if (p && typeof p === "object" && "_id" in p) return String((p as { _id: string })._id);
  return "";
}

export default function SaleWizard({
  mode,
  editSaleId,
}: {
  mode: "create" | "edit";
  editSaleId?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const hydratedRef = useRef(false);
  const [step, setStep] = useState<Step>(1);
  const [waitressId, setWaitressId] = useState("");
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: sale,
    isLoading: saleLoading,
    isError: saleError,
  } = useQuery<ISale>({
    queryKey: ["sale", editSaleId],
    queryFn: async () => {
      const r = await fetch(`/api/sales/${editSaleId}`);
      if (!r.ok) throw new Error("fetch");
      return r.json();
    },
    enabled: mode === "edit" && Boolean(editSaleId),
  });

  const { data: waitresses } = useQuery<IWaitress[]>({
    queryKey: ["waitresses"],
    queryFn: async () => (await fetch("/api/waitresses")).json(),
  });

  const { data: tables } = useQuery<IRestaurantTable[]>({
    queryKey: ["tables"],
    queryFn: async () => (await fetch("/api/tables")).json(),
  });

  const { data: products } = useQuery<ProductWithStock[]>({
    queryKey: ["products-stock", { activeOnly: true }],
    queryFn: async () => (await fetch("/api/products/stock?activeOnly=1")).json(),
  });

  useEffect(() => {
    hydratedRef.current = false;
  }, [editSaleId]);

  useEffect(() => {
    if (mode !== "edit" || !sale) return;
    if (sale.status !== "PENDING") {
      router.replace(`/sales/${editSaleId}`);
    }
  }, [mode, sale, editSaleId, router]);

  useEffect(() => {
    if (mode !== "edit" || !sale || !products || hydratedRef.current) return;
    if (sale.status !== "PENDING") return;

    const w = sale.waitress as { _id?: string };
    setWaitressId(typeof sale.waitress === "string" ? sale.waitress : (w._id ?? ""));
    setTableIds(saleTableIdsFromPayload(sale));

    setCart(
      sale.items.map((item) => {
        const productId = productIdFromItem(item);
        const prod = item.product as { name?: string; image?: string };
        const stockP = products.find((p) => p._id === productId);
        return {
          productId,
          name: prod?.name ?? "Produit",
          image: prod?.image,
          price: item.unitPrice,
          quantity: item.quantity,
          maxStock: Math.max(item.quantity, stockP?.stock ?? 0),
        };
      })
    );
    hydratedRef.current = true;
  }, [mode, sale, products]);

  const totalAmount = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const availableProducts = products?.filter((p) => p.stock > 0) ?? [];

  const addToCart = (product: ProductWithStock) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product._id);
      if (existing) return prev;
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          image: product.image,
          price: product.marketSellingPrice,
          quantity: 1,
          maxStock: product.stock,
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const newQty = Math.min(Math.max(1, i.quantity + delta), i.maxStock);
          return { ...i, quantity: newQty };
        })
        .filter((i) => !(i.productId === productId && delta === -1 && i.quantity === 1))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleSubmit = async () => {
    if (!waitressId || tableIds.length === 0 || cart.length === 0) return;
    setIsSubmitting(true);

    const payload = {
      waitressId,
      tableIds,
      items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    };

    const res =
      mode === "create"
        ? await fetch("/api/sales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/sales/${editSaleId}`, {
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

    toast({
      variant: "success",
      title: mode === "create" ? "Vente créée" : "Vente mise à jour",
      description:
        mode === "create"
          ? "La commande est en attente de paiement."
          : "Les modifications ont été enregistrées.",
    });
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["tables"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["products-stock"] });
    if (mode === "edit" && editSaleId) {
      qc.invalidateQueries({ queryKey: ["sale", editSaleId] });
    }
    router.push(mode === "create" ? "/sales" : `/sales/${editSaleId}`);
  };

  const waitressName = () => {
    const w = waitresses?.find((x) => x._id === waitressId);
    return w ? `${w.firstName} ${w.lastName}` : "";
  };

  const tableLabel = () => formatTableIdsWithCatalog(tableIds, tables);

  /** Table réservée par une autre vente en attente (pas la vente en cours d’édition) */
  const isTableOccupiedByOtherSale = (t: IRestaurantTable) => {
    const occ = t.occupiedByPendingSaleId;
    if (occ == null) return false;
    if (mode === "edit" && editSaleId && occ === editSaleId) return false;
    return true;
  };

  if (mode === "edit") {
    if (saleLoading) {
      return (
        <div className="space-y-6 py-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full max-w-4xl" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }
    if (saleError || !sale) {
      return (
        <div className="py-16 text-center">
          <p className="text-[#6B7280] mb-4">Vente introuvable.</p>
          <Button asChild variant="outline">
            <Link href="/sales">Retour aux ventes</Link>
          </Button>
        </div>
      );
    }
  }

  const backHref = mode === "create" ? "/sales" : `/sales/${editSaleId}`;

  return (
    <div className="min-h-[calc(100vh-6rem)] pb-8">
      <div className="mb-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {mode === "create" ? "Retour aux ventes" : "Retour à la fiche vente"}
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {mode === "create" ? "Nouvelle vente" : "Modifier la vente"}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {mode === "create"
              ? "Enregistrez une commande en trois étapes : service, panier, validation."
              : "Modifiez la serveuse, les tables ou les articles tant que la vente est en attente."}
          </p>
        </div>
      </div>

      <div className="mb-10 w-full flex flex-col items-center">
        <div className="flex flex-col items-center gap-12 sm:flex-row sm:items-center sm:justify-center sm:gap-14 md:gap-20 lg:gap-24">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const active = step === s.n;
            const done = step > s.n;
            const prevStep = idx > 0 ? STEPS[idx - 1] : null;
            return (
              <div key={s.n} className="flex items-center justify-center">
                {idx > 0 && prevStep && (
                  <div
                    className={cn(
                      "hidden sm:block h-0.5 w-24 md:w-36 lg:w-44 shrink-0 rounded-full transition-colors",
                      step > prevStep.n ? "bg-primary" : "bg-[#E5E5E5]"
                    )}
                  />
                )}
                <div className="flex items-center gap-3 shrink-0">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-colors",
                      done && "border-primary bg-primary text-primary-foreground",
                      active && !done && "border-primary bg-white text-primary",
                      !active && !done && "border-[#E5E5E5] bg-[#FAFAFA] text-[#9CA3AF]"
                    )}
                  >
                    {done ? (
                      <span className="text-sm font-bold">✓</span>
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 hidden sm:block text-left">
                    <p
                      className={cn(
                        "text-sm font-semibold whitespace-nowrap",
                        active || done ? "text-primary" : "text-[#9CA3AF]"
                      )}
                    >
                      {s.label}
                    </p>
                    <p className="text-xs text-[#9CA3AF] whitespace-nowrap">{s.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[#6B7280] mt-4 sm:hidden text-center">
          Étape {step} sur 3 — {STEPS[step - 1].label}
        </p>
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {step === 1 && (
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
            <Card className="border-[#E5E5E5] shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F5F5]">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-primary">Serveuse</CardTitle>
                    <CardDescription>Qui prend en charge cette commande ?</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Label className="sr-only">Serveuse</Label>
                <Select value={waitressId} onValueChange={setWaitressId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Sélectionner une serveuse" />
                  </SelectTrigger>
                  <SelectContent>
                    {waitresses?.map((w) => (
                      <SelectItem key={w._id} value={w._id}>
                        {w.firstName} {w.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="border-[#E5E5E5] shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F5F5]">
                    <UtensilsCrossed className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-primary">Tables</CardTitle>
                    <CardDescription>Sélectionnez une ou plusieurs tables</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {tables?.map((t) => {
                    const occupied = isTableOccupiedByOtherSale(t);
                    const selected = tableIds.includes(t._id);
                    return (
                      <button
                        key={t._id}
                        type="button"
                        disabled={occupied}
                        onClick={() =>
                          setTableIds((prev) =>
                            prev.includes(t._id) ? prev.filter((id) => id !== t._id) : [...prev, t._id]
                          )
                        }
                        title={occupied ? "Table occupée par une commande en attente" : undefined}
                        className={cn(
                          "rounded-xl border-2 px-2 py-2.5 text-sm font-medium transition-all flex flex-col items-center justify-center min-h-[4.25rem]",
                          selected && !occupied
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : occupied
                              ? "border-amber-200 bg-amber-50/80 text-amber-900/70 cursor-not-allowed opacity-90"
                              : "border-[#E5E5E5] bg-white text-[#374151] hover:border-primary/40"
                        )}
                      >
                        <span className="leading-tight">{t.name ?? `T${t.number}`}</span>
                        {occupied && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide mt-1 text-amber-800">
                            Occupée
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-4 order-2 lg:order-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-primary">Catalogue</h2>
                <span className="text-xs text-[#6B7280]">
                  {availableProducts.length} produit{availableProducts.length !== 1 ? "s" : ""} en stock
                </span>
              </div>
              <div className="max-h-[22rem] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {availableProducts.map((product) => {
                    const inCart = cart.find((i) => i.productId === product._id);
                    return (
                      <button
                        key={product._id}
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={!!inCart}
                        className={cn(
                          "flex min-h-[5.25rem] items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                          inCart
                            ? "border-primary bg-primary text-primary-foreground opacity-90 shadow-sm"
                            : "border-primary/25 bg-gradient-to-br from-white to-primary/[0.04] hover:border-primary hover:bg-primary/[0.06] hover:shadow-md"
                        )}
                      >
                        <ProductThumb
                          imageUrl={product.image}
                          name={product.name}
                          sizeClass="h-16 w-16"
                          variant={inCart ? "dark" : "light"}
                        />
                        <div className="min-w-0 flex-1 flex flex-col items-stretch text-left py-0.5">
                          <p
                            className={cn(
                              "text-sm font-semibold line-clamp-2",
                              inCart ? "text-primary-foreground" : "text-primary"
                            )}
                          >
                            {product.name}
                          </p>
                          <p className={cn("text-xs mt-1", inCart ? "text-primary-foreground/80" : "text-[#374151]")}>
                            {formatCurrency(product.marketSellingPrice)}
                          </p>
                          <p className={cn("text-xs mt-auto pt-1.5", inCart ? "text-primary-foreground/60" : "text-[#9CA3AF]")}>
                            Stock {product.stock}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 order-1 lg:order-2 lg:sticky lg:top-6">
              <Card className="overflow-hidden border-primary/20 shadow-md ring-1 ring-primary/15">
                <CardHeader className="relative border-0 bg-gradient-to-br from-primary to-primary/90 pb-5 pt-6 text-primary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
                  <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(255,255,255,0.14),transparent_55%)]"
                    aria-hidden
                  />
                  <div className="relative flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 shrink-0 opacity-95" />
                    <CardTitle className="text-base text-primary-foreground">Panier</CardTitle>
                  </div>
                  <CardDescription className="relative text-primary-foreground/75">
                    {cart.length === 0
                      ? "Ajoutez des produits depuis le catalogue"
                      : `${cart.length} article${cart.length > 1 ? "s" : ""}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {cart.length === 0 ? (
                    <div className="p-8 text-center text-sm text-[#9CA3AF]">Votre panier est vide</div>
                  ) : (
                    <div className="max-h-[15rem] divide-y divide-[#F5F5F5] overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.productId} className="flex items-center gap-3 p-4">
                          <ProductThumb
                            imageUrl={item.image}
                            name={item.name}
                            sizeClass="h-12 w-12"
                            variant="light"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-primary">{item.name}</p>
                            <p className="text-xs text-[#6B7280]">{formatCurrency(item.price)} / u.</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateQty(item.productId, -1)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F5] hover:bg-[#EBEBEB]"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(item.productId, 1)}
                              disabled={item.quantity >= item.maxStock}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F5] hover:bg-[#EBEBEB] disabled:opacity-40"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="w-24 shrink-0 text-right text-sm font-semibold text-primary">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.productId)}
                            className="p-1.5 text-[#9CA3AF] hover:text-red-500 shrink-0"
                            aria-label="Retirer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {cart.length > 0 && (
                    <div className="flex items-center justify-between border-t border-[#E5E5E5] bg-[#FAFAFA] p-4">
                      <span className="text-sm font-semibold text-primary">Total</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(totalAmount)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-lg mx-auto">
            <Card className="border-[#E5E5E5] shadow-md overflow-hidden">
              <CardHeader className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <Receipt className="h-5 w-5" />
                  Récapitulatif
                </CardTitle>
                <CardDescription>
                  {mode === "create"
                    ? "Vérifiez les informations avant de créer la commande."
                    : "Vérifiez les modifications avant d'enregistrer."}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Serveuse</span>
                  <span className="font-medium text-primary">{waitressName()}</span>
                </div>
                <div className="flex justify-between text-sm gap-4">
                  <span className="text-[#6B7280] shrink-0">Tables</span>
                  <span className="text-right font-medium text-primary">{tableLabel()}</span>
                </div>
                <div className="border-t border-[#E5E5E5] pt-4 space-y-2">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex justify-between text-sm">
                      <span className="text-[#374151]">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="font-medium text-primary">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#E5E5E5] pt-4 flex items-center justify-between">
                  <span className="font-semibold text-primary">Total à payer</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>

      <div className="mt-10 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-6 border-t border-[#E5E5E5]">
        <div>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          )}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          {step === 1 && (
            <Button
              onClick={() => setStep(2)}
              disabled={!waitressId || tableIds.length === 0}
              className="w-full sm:w-auto min-w-[160px]"
            >
              Continuer
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 2 && (
            <Button
              onClick={() => setStep(3)}
              disabled={cart.length === 0}
              className="w-full sm:w-auto min-w-[160px]"
            >
              Récapitulatif
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              size="lg"
              className="w-full min-w-[220px] bg-primary text-base font-semibold text-primary-foreground shadow-md hover:bg-primary/90 sm:w-auto"
            >
              {isSubmitting
                ? mode === "create"
                  ? "Création…"
                  : "Enregistrement…"
                : mode === "create"
                  ? "Créer la commande"
                  : "Enregistrer les modifications"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
