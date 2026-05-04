"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn, formatCurrency, formatSalePaymentLabel } from "@/lib/utils";
import type { ISale, SalePaymentMethod } from "@/types";

export function CloseSaleDialog({
  sale,
  onClose,
}: {
  sale: ISale | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("CASH");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  /** Si monnaie à rendre : l’opérateur doit indiquer s’il l’a remise avant de confirmer la clôture */
  const [changeReturnedChoice, setChangeReturnedChoice] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    if (!sale) return;
    setShowConfirm(false);
    setAmountPaid("");
    setPaymentMethod("CASH");
    setChangeReturnedChoice(null);
  }, [sale?._id]);

  if (!sale) return null;

  const change =
    amountPaid && !Number.isNaN(parseFloat(amountPaid))
      ? parseFloat(amountPaid) - sale.totalAmount
      : null;

  const goToConfirm = () => {
    if (!amountPaid || parseFloat(amountPaid) < sale.totalAmount) return;
    setChangeReturnedChoice(null);
    setShowConfirm(true);
  };

  const submitClose = async () => {
    if (!amountPaid || parseFloat(amountPaid) < sale.totalAmount) return;
    const paid = parseFloat(amountPaid);
    const changeDue = paid - sale.totalAmount;
    if (changeDue > 0 && changeReturnedChoice !== "yes") return;
    setIsSubmitting(true);

    const changeReturnedAck = changeDue <= 0 || changeReturnedChoice === "yes";

    const res = await fetch(`/api/sales/${sale._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        amountPaid: paid,
        paymentMethod,
        changeReturnedAck,
      }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const err = await res.json();
      toast({ variant: "destructive", title: "Erreur", description: err.error });
      return;
    }

    toast({ variant: "success", title: "Vente clôturée" });
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["tables"] });
    qc.invalidateQueries({ queryKey: ["sale", String(sale._id)] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["products-stock"] });
    setAmountPaid("");
    setShowConfirm(false);
    setChangeReturnedChoice(null);
    onClose();
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setShowConfirm(false);
      setChangeReturnedChoice(null);
      onClose();
    }
  };

  const mustAcknowledgeChange = change !== null && change > 0;
  const canConfirmClose =
    !mustAcknowledgeChange || changeReturnedChoice === "yes";

  return (
    <Dialog open={!!sale} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-sm">
        {!showConfirm ? (
          <>
            <DialogHeader>
              <DialogTitle>Clôturer la vente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-[#F5F5F5] rounded-xl p-4">
                <div className="flex justify-between mb-3">
                  <span className="text-sm text-[#6B7280]">Montant total</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(sale.totalAmount)}</span>
                </div>
                {(sale.items as Array<{ product: { name: string }; quantity: number; total: number }>).map(
                  (item, i) => (
                    <div key={i} className="flex justify-between text-sm text-[#374151] mb-1">
                      <span>{(item.product as { name: string })?.name} × {item.quantity}</span>
                      <span>{formatCurrency(item.total)}</span>
                    </div>
                  )
                )}
              </div>

              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                      paymentMethod === "CASH"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-[#E5E5E5] bg-white text-[#374151] hover:border-primary/25 hover:bg-[#F5F5F5]"
                    )}
                  >
                    Espèces
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("MOBILE_MONEY")}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                      paymentMethod === "MOBILE_MONEY"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-[#E5E5E5] bg-white text-[#374151] hover:bg-[#F5F5F5] hover:border-primary/25"
                    )}
                  >
                    Mobile Money
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Montant remis par le client (FCFA)</Label>
                <Input
                  type="number"
                  placeholder={sale.totalAmount.toString()}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  min={sale.totalAmount}
                />
              </div>

              {change !== null && (
                <div className={`flex justify-between p-3 rounded-lg ${change >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                  <span className="text-sm font-medium">Reliquat</span>
                  <span className={`font-bold text-lg ${change >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {formatCurrency(change)}
                  </span>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={goToConfirm}
                  disabled={!amountPaid || parseFloat(amountPaid) < sale.totalAmount}
                >
                  Clôturer
                </Button>
              </DialogFooter>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirmer la clôture</DialogTitle>
              <DialogDescription>
                Vous allez clôturer définitivement cette vente. Le stock sera mis à jour et vous ne pourrez plus la
                modifier.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4 text-sm">
              <div className="flex justify-between text-[#6B7280]">
                <span>Montant total</span>
                <span className="font-semibold text-primary">{formatCurrency(sale.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-[#6B7280]">
                <span>Mode de paiement</span>
                <span className="font-semibold text-primary">{formatSalePaymentLabel(paymentMethod)}</span>
              </div>
              <div className="flex justify-between text-[#6B7280]">
                <span>Montant remis</span>
                <span className="font-semibold text-primary">{formatCurrency(parseFloat(amountPaid))}</span>
              </div>
              {change !== null && change > 0 && (
                <div className="flex justify-between border-t border-[#E5E5E5] pt-3 font-medium text-green-800">
                  <span>Monnaie à rendre</span>
                  <span>{formatCurrency(change)}</span>
                </div>
              )}
            </div>

            {mustAcknowledgeChange ? (
              <div className="space-y-2">
                <Label className="text-sm">Avez-vous remis la monnaie au client ?</Label>
                <p className="text-xs text-[#6B7280]">
                  La clôture n&apos;est possible qu&apos;après confirmation de la remise de la monnaie.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChangeReturnedChoice("yes")}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                      changeReturnedChoice === "yes"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-[#E5E5E5] bg-white text-[#374151] hover:border-primary/25 hover:bg-[#F5F5F5]"
                    )}
                  >
                    Oui, monnaie remise
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangeReturnedChoice("no")}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                      changeReturnedChoice === "no"
                        ? "border-amber-600 bg-amber-50 text-amber-900"
                        : "border-[#E5E5E5] bg-white text-[#374151] hover:border-amber-200 hover:bg-amber-50/50"
                    )}
                  >
                    Non, pas encore
                  </button>
                </div>
                {changeReturnedChoice === "no" ? (
                  <p className="text-xs font-medium text-amber-800">
                    Remettez d&apos;abord la monnaie au client, puis choisissez « Oui, monnaie remise » pour clôturer.
                  </p>
                ) : null}
              </div>
            ) : null}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowConfirm(false);
                  setChangeReturnedChoice(null);
                }}
                disabled={isSubmitting}
              >
                Retour
              </Button>
              <Button type="button" onClick={submitClose} disabled={isSubmitting || !canConfirmClose}>
                {isSubmitting ? "Clôture…" : "Confirmer la clôture"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
