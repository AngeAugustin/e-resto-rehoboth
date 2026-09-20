"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
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
  ShoppingCart,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, cn, getInitials } from "@/lib/utils";
import type { IKitchenPlate, IKitchenOrder, IKitchenWaitress, IMenu, IKitchenOrderItem } from "@/types";
import { ProductThumb } from "@/components/sales/ProductThumb";

interface CartItem {
  menuId: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
}

type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; label: string; description: string; icon: typeof User }[] = [
  { n: 1, label: "Menus", description: "Sélection et quantités", icon: UtensilsCrossed },
  { n: 2, label: "Serveuses-Cuisinières", description: "Qui sert", icon: User },
  { n: 3, label: "Plaquette", description: "Support de service", icon: User },
  { n: 4, label: "Validation", description: "Récapitulatif", icon: Receipt },
];

function menuIdFromItem(item: IKitchenOrderItem): string {
  const m = item.menu;
  if (typeof m === "string") return m;
  if (m && typeof m === "object" && "_id" in m) return String((m as { _id: string })._id);
  return "";
}

export default function KitchenOrderWizard({
  mode,
  editOrderId,
}: {
  mode: "create" | "edit";
  editOrderId?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const hydratedRef = useRef(false);
  const [step, setStep] = useState<Step>(1);
  const [kitchenWaitressId, setKitchenWaitressId] = useState("");
  const [plateId, setPlateId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: order,
    isLoading: orderLoading,
    isError: orderError,
  } = useQuery<IKitchenOrder>({
    queryKey: ["kitchen-order", editOrderId],
    queryFn: async () => {
      const r = await fetch(`/api/kitchen-orders/${editOrderId}`);
      if (!r.ok) throw new Error("fetch");
      return r.json();
    },
    enabled: mode === "edit" && Boolean(editOrderId),
  });

  const { data: menus } = useQuery<IMenu[]>({
    queryKey: ["menus", { activeOnly: true }],
    queryFn: async () => (await fetch("/api/menus?activeOnly=1")).json(),
  });

  const filteredMenus = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    if (!q) return menus ?? [];
    return (menus ?? []).filter((menu) => menu.name.toLowerCase().includes(q));
  }, [menus, menuSearch]);

  const { data: kitchenWaitresses } = useQuery<IKitchenWaitress[]>({
    queryKey: ["kitchen-waitresses", { activeOnly: true }],
    queryFn: async () => (await fetch("/api/kitchen-waitresses?activeOnly=1")).json(),
  });

  const { data: plates } = useQuery<IKitchenPlate[]>({
    queryKey: ["kitchen-plates"],
    queryFn: async () => (await fetch("/api/kitchen-plates")).json(),
  });

  const { data: cashSessionState, isLoading: cashSessionLoading } = useQuery<{
    hasSession: boolean;
    canSell: boolean;
  }>({
    queryKey: ["kitchen-cash-session-latest-status"],
    queryFn: async () => (await fetch("/api/kitchen-cash-sessions/latest-status")).json(),
    enabled: mode === "create",
    staleTime: 20_000,
  });

  useEffect(() => {
    hydratedRef.current = false;
  }, [editOrderId]);

  useEffect(() => {
    if (mode !== "edit" || !order) return;
    if (order.status !== "PENDING") {
      router.replace(`/kitchen/${editOrderId}`);
    }
  }, [mode, order, editOrderId, router]);

  useEffect(() => {
    if (mode !== "edit" || !order || hydratedRef.current) return;
    if (order.status !== "PENDING") return;

    const kw = order.kitchenWaitress as { _id?: string };
    const p = order.plate as { _id?: string };
    setKitchenWaitressId(
      typeof order.kitchenWaitress === "string" ? order.kitchenWaitress : (kw._id ?? "")
    );
    setPlateId(typeof order.plate === "string" ? order.plate : (p._id ?? ""));
    setCart(
      order.items.map((item) => {
        const menuId = menuIdFromItem(item);
        const menu = item.menu as { name?: string; image?: string };
        return {
          menuId,
          name: menu?.name ?? "Menu",
          image: menu?.image,
          price: item.unitPrice,
          quantity: item.quantity,
        };
      })
    );
    hydratedRef.current = true;
  }, [mode, order]);

  const totalAmount = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const canCreate = mode === "edit" ? true : Boolean(cashSessionState?.canSell);
  const wizardLocked = mode === "create" && (cashSessionLoading || !canCreate);

  const addToCart = (menu: IMenu) => {
    if (wizardLocked) return;
    setCart((prev) => {
      if (prev.find((i) => i.menuId === menu._id)) return prev;
      return [...prev, { menuId: menu._id, name: menu.name, image: menu.image, price: menu.price, quantity: 1 }];
    });
  };

  const updateQty = (menuId: string, delta: number) => {
    if (wizardLocked) return;
    setCart((prev) =>
      prev.reduce<typeof prev>((acc, i) => {
        if (i.menuId !== menuId) {
          acc.push(i);
          return acc;
        }
        const newQty = i.quantity + delta;
        if (newQty < 1) return acc;
        acc.push({ ...i, quantity: newQty });
        return acc;
      }, [])
    );
  };

  const handleSubmit = async () => {
    if (wizardLocked) return;
    if (!kitchenWaitressId || !plateId || cart.length === 0) return;
    setIsSubmitting(true);

    const payload = {
      kitchenWaitressId,
      plateId,
      items: cart.map((i) => ({ menuId: i.menuId, quantity: i.quantity })),
    };

    const res =
      mode === "create"
        ? await fetch("/api/kitchen-orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/kitchen-orders/${editOrderId}`, {
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
      title: mode === "create" ? "Commande créée" : "Commande mise à jour",
    });
    qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
    qc.invalidateQueries({ queryKey: ["kitchen-plates"] });
    if (mode === "edit" && editOrderId) {
      qc.invalidateQueries({ queryKey: ["kitchen-order", editOrderId] });
    }
    router.push(mode === "create" ? "/kitchen" : `/kitchen/${editOrderId}`);
  };

  const kitchenWaitressName = () => {
    const w = kitchenWaitresses?.find((x) => x._id === kitchenWaitressId);
    if (w) return `${w.firstName} ${w.lastName}`;
    const fromOrder = order?.kitchenWaitress as { firstName?: string; lastName?: string } | undefined;
    if (fromOrder?.firstName || fromOrder?.lastName) {
      return `${fromOrder.firstName ?? ""} ${fromOrder.lastName ?? ""}`.trim();
    }
    return "";
  };

  const plateLabel = () => plates?.find((x) => x._id === plateId)?.number ?? "";

  const isPlateOccupied = (p: IKitchenPlate) => {
    const occ = p.occupiedByPendingOrderId;
    if (occ == null) return false;
    if (mode === "edit" && editOrderId && occ === editOrderId) return false;
    return true;
  };

  if (mode === "edit") {
    if (orderLoading) {
      return (
        <div className="space-y-6 py-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }
    if (orderError || !order) {
      return (
        <div className="py-16 text-center">
          <p className="text-[#6B7280] mb-4">Commande introuvable.</p>
          <Button asChild variant="outline">
            <Link href="/kitchen">Retour à la cuisine</Link>
          </Button>
        </div>
      );
    }
  }

  const backHref = mode === "create" ? "/kitchen" : `/kitchen/${editOrderId}`;

  return (
    <div className="min-h-[calc(100vh-6rem)] min-w-0 max-w-full pb-4 lg:pb-8">
      <div className="mb-6 sm:mb-8">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-2 text-sm text-[#6B7280] transition-colors hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          {mode === "create" ? "Retour à la cuisine" : "Retour à la fiche commande"}
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {mode === "create" ? "Nouvelle commande cuisine" : "Modifier la commande"}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {mode === "create"
              ? "Menus, serveuse-cuisinière, plaquette, puis validation."
              : "Modifiez la commande tant qu’elle est en attente."}
          </p>
        </div>
        {mode === "create" && cashSessionLoading && (
          <div className="mt-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-sm text-[#6B7280]">
            Vérification de la session de caisse cuisine…
          </div>
        )}
        {mode === "create" && !cashSessionLoading && !canCreate && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Aucune session de caisse cuisine ouverte. Ouvrez d&apos;abord la session dans Caisse cuisine.
          </div>
        )}
      </div>

      <div className="mb-10 min-w-0 max-w-full">
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-center lg:gap-3 xl:gap-8 2xl:gap-12">
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
                      "hidden lg:block h-0.5 w-4 xl:w-12 2xl:w-20 shrink-0 rounded-full transition-colors",
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
                    {done ? <span className="text-sm font-bold">✓</span> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 hidden lg:block text-left max-w-[6.5rem] xl:max-w-none">
                    <p
                      className={cn(
                        "text-sm font-semibold truncate xl:whitespace-nowrap",
                        active || done ? "text-primary" : "text-[#9CA3AF]"
                      )}
                    >
                      {s.label}
                    </p>
                    <p className="hidden xl:block text-xs text-[#9CA3AF] whitespace-nowrap">{s.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[#6B7280] mt-4 xl:hidden text-center">
          Étape {step} sur 4 — {STEPS[step - 1].label}
        </p>
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={cn("min-w-0 max-w-full", wizardLocked && "pointer-events-none opacity-[0.52] saturate-[0.65]")}
      >
        {step === 1 && (
          <div className="grid min-w-0 lg:grid-cols-12 gap-8 items-start">
            <div className="min-w-0 lg:col-span-7 space-y-4 order-2 lg:order-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-primary shrink-0">Menus</h2>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <Input
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Rechercher un menu…"
                    className={cn("pl-9", menuSearch && "pr-9")}
                    disabled={wizardLocked}
                  />
                  {menuSearch ? (
                    <button
                      type="button"
                      onClick={() => setMenuSearch("")}
                      disabled={wizardLocked}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[#9CA3AF] transition-colors hover:text-[#0D0D0D] disabled:pointer-events-none"
                      aria-label="Vider la recherche"
                      title="Vider"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="max-h-[22rem] overflow-y-auto pr-1">
                {filteredMenus.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[#9CA3AF]">
                    {menuSearch.trim() ? "Aucun menu ne correspond à la recherche." : "Aucun menu disponible."}
                  </p>
                ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredMenus.map((menu) => {
                    const inCart = cart.find((i) => i.menuId === menu._id);
                    return (
                      <button
                        key={menu._id}
                        type="button"
                        onClick={() => addToCart(menu)}
                        disabled={!!inCart || wizardLocked}
                        className={cn(
                          "flex min-h-[5.25rem] items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                          inCart
                            ? "border-primary bg-primary text-primary-foreground opacity-90 shadow-sm"
                            : "border-primary/25 bg-gradient-to-br from-white to-primary/[0.04] hover:border-primary hover:bg-primary/[0.06]"
                        )}
                      >
                        <ProductThumb
                          imageUrl={menu.image}
                          name={menu.name}
                          sizeClass="h-16 w-16"
                          variant={inCart ? "dark" : "light"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-semibold line-clamp-2", inCart ? "text-primary-foreground" : "text-primary")}>
                            {menu.name}
                          </p>
                          <p className={cn("text-xs mt-1", inCart ? "text-primary-foreground/80" : "text-[#374151]")}>
                            {formatCurrency(menu.price)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
            </div>
            <div className="min-w-0 lg:col-span-5 order-1 lg:order-2">
              <Card className="overflow-hidden border-primary/20 shadow-md ring-1 ring-primary/15">
                <CardHeader className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    <CardTitle className="text-base text-primary-foreground">Panier</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {cart.length === 0 ? (
                    <div className="p-8 text-center text-sm text-[#9CA3AF]">Aucun menu sélectionné</div>
                  ) : (
                    <div className="max-h-[15rem] divide-y divide-[#F5F5F5] overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.menuId} className="flex min-w-0 items-center gap-2 p-4 sm:gap-3">
                          <ProductThumb imageUrl={item.image} name={item.name} sizeClass="h-12 w-12" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-[#6B7280]">{formatCurrency(item.price)}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => updateQty(item.menuId, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F5]">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                            <button type="button" onClick={() => updateQty(item.menuId, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F5]">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button type="button" onClick={() => setCart((prev) => prev.filter((i) => i.menuId !== item.menuId))} className="p-1.5 text-[#9CA3AF] hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {cart.length > 0 && (
                    <div className="flex items-center justify-between border-t border-[#E5E5E5] bg-[#FAFAFA] p-4">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(totalAmount)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
            {(kitchenWaitresses ?? []).map((w) => {
              const selected = kitchenWaitressId === w._id;
              return (
                <button
                  key={w._id}
                  type="button"
                  onClick={() => setKitchenWaitressId(w._id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all",
                    selected ? "border-primary bg-primary/5 shadow-sm" : "border-[#E5E5E5] bg-white hover:border-primary/40"
                  )}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#F5F5F5] text-sm font-semibold">
                    {getInitials(w.firstName, w.lastName)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0D0D0D]">
                      {w.firstName} {w.lastName}
                    </p>
                    <p className="text-xs text-[#6B7280]">{w.phone ?? "—"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-w-4xl">
            {(plates ?? []).map((p) => {
              const occupied = isPlateOccupied(p);
              const selected = plateId === p._id;
              return (
                <button
                  key={p._id}
                  type="button"
                  disabled={occupied || wizardLocked}
                  onClick={() => setPlateId(p._id)}
                  className={cn(
                    "rounded-xl border-2 px-2 py-3 text-sm font-medium min-h-[4.25rem]",
                    selected && !occupied
                      ? "border-primary bg-primary text-primary-foreground"
                      : occupied
                        ? "border-amber-200 bg-amber-50/80 text-amber-900/70 cursor-not-allowed"
                        : "border-[#E5E5E5] bg-white hover:border-primary/40"
                  )}
                >
                  {p.number}
                  {occupied && <span className="block text-[10px] uppercase mt-1">Occupée</span>}
                </button>
              );
            })}
          </div>
        )}

        {step === 4 && (
          <div className="max-w-lg mx-auto">
            <Card className="border-[#E5E5E5] shadow-md overflow-hidden">
              <CardHeader className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <Receipt className="h-5 w-5" />
                  Récapitulatif
                </CardTitle>
                <CardDescription>Vérifiez les informations avant validation.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-[#6B7280]">Serveuse-cuisinière</span>
                  <span className="font-medium text-primary">{kitchenWaitressName()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Plaquette</span>
                  <span className="font-medium text-primary">{plateLabel()}</span>
                </div>
                <div className="border-t border-[#E5E5E5] pt-4 space-y-2">
                  {cart.map((item) => (
                    <div key={item.menuId} className="flex justify-between text-sm">
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#E5E5E5] pt-4 flex items-center justify-between">
                  <span className="font-semibold">Total à payer</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>

      <div className={cn("mt-10 flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-6 border-t border-[#E5E5E5]", wizardLocked && "pointer-events-none opacity-[0.52]")}>
        <div>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto sm:flex-nowrap">
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={wizardLocked || cart.length === 0} className="w-full sm:w-auto sm:min-w-[160px]">
              Continuer
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={wizardLocked || !kitchenWaitressId} className="w-full sm:w-auto sm:min-w-[160px]">
              Continuer
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={() => setStep(4)} disabled={wizardLocked || !plateId} className="w-full sm:w-auto sm:min-w-[160px]">
              Récapitulatif
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 4 && (
            <Button onClick={handleSubmit} disabled={isSubmitting || wizardLocked} size="lg" className="w-full sm:w-auto sm:min-w-[220px]">
              {isSubmitting ? "Enregistrement…" : mode === "create" ? "Créer la commande" : "Enregistrer"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
