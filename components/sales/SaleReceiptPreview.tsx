"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime, formatSalePaymentLabel } from "@/lib/utils";
import { exportElementToPdf } from "@/lib/receipt-pdf";
import type { ISale } from "@/types";
import { toast } from "@/hooks/use-toast";

const BUSINESS = "E-STOCK";

function ticketId(saleId: string): string {
  const clean = String(saleId).replace(/\s/g, "");
  return clean.length > 10 ? clean.slice(-10).toUpperCase() : clean.toUpperCase();
}

export function SaleReceiptPreview({ sale }: { sale: ISale }) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const waitress = sale.waitress as { firstName?: string; lastName?: string };
  const table = sale.table as { number?: number; name?: string };
  const tableLabel = table?.name?.trim() ? table.name : `Table ${table?.number ?? "—"}`;
  const waitressLabel = [waitress?.firstName, waitress?.lastName].filter(Boolean).join(" ") || "—";

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const el = receiptRef.current;
    if (!el) {
      toast({ variant: "destructive", title: "Erreur", description: "Aperçu du ticket introuvable." });
      return;
    }
    setPdfLoading(true);
    try {
      await exportElementToPdf(el, `ticket-${ticketId(sale._id)}`);
      toast({ title: "Téléchargement", description: "Le ticket a été enregistré au format PDF." });
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de générer le PDF." });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="sale-receipt-aside w-full">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">Aperçu ticket</span>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl border-[#E5E5E5] bg-white shadow-sm text-[#0D0D0D] hover:bg-[#F5F5F5]"
            onClick={handlePrint}
            title="Imprimer le ticket"
            aria-label="Imprimer le ticket"
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl border-[#E5E5E5] bg-white shadow-sm text-[#0D0D0D] hover:bg-[#F5F5F5] disabled:opacity-60"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            title="Télécharger le ticket (PDF)"
            aria-label="Télécharger le ticket en PDF"
          >
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div
        ref={receiptRef}
        id="sale-receipt-print"
        className="mx-auto w-full max-w-[300px] rounded-sm border border-[#D4D0C8] bg-[#FFFCF7] px-4 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]"
        style={{
          fontFamily: 'ui-monospace, "Cascadia Code", "Segoe UI Mono", Consolas, monospace',
        }}
      >
        <div className="text-center">
          <p className="text-[15px] font-extrabold tracking-[0.2em] text-[#0D0D0D]">{BUSINESS}</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-widest text-[#6B7280]">Ticket de caisse</p>
        </div>

        <div className="my-3 border-t border-dashed border-[#0D0D0D]/35" />

        <div className="space-y-1 text-[10px] text-[#374151]">
          <div className="flex justify-between gap-2">
            <span className="text-[#6B7280]">Date</span>
            <span className="text-right font-medium text-[#111]">{formatDateTime(sale.createdAt)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#6B7280]">N° ticket</span>
            <span className="font-semibold tracking-wide text-[#111]">{ticketId(sale._id)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#6B7280]">Table</span>
            <span className="font-medium text-[#111]">{tableLabel}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#6B7280]">Serveuse</span>
            <span className="text-right font-medium text-[#111]">{waitressLabel}</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-[#0D0D0D]/35" />

        <ul className="space-y-2.5">
          {sale.items.map((item, idx) => {
            const prod = item.product as { name?: string };
            const name = prod?.name ?? "Produit";
            return (
              <li key={idx} className="text-[11px] leading-snug">
                <p className="font-semibold text-[#0D0D0D]">{name}</p>
                <div className="mt-0.5 flex justify-between gap-2 text-[10px] text-[#4B5563]">
                  <span>
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-[#111]">{formatCurrency(item.total)}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="my-3 border-t border-dashed border-[#0D0D0D]/35" />

        <div className="space-y-1.5 text-[11px]">
          <div className="flex justify-between font-bold text-[#0D0D0D]">
            <span className="tracking-wide">TOTAL</span>
            <span className="tabular-nums text-[13px]">{formatCurrency(sale.totalAmount)}</span>
          </div>

          {sale.status === "COMPLETED" && sale.amountPaid !== undefined && (
            <>
              {sale.paymentMethod != null && (
                <div className="flex justify-between text-[10px] text-[#4B5563]">
                  <span>Paiement</span>
                  <span className="font-medium text-[#111]">{formatSalePaymentLabel(sale.paymentMethod)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] text-[#4B5563]">
                <span>Montant remis</span>
                <span className="tabular-nums font-medium text-[#111]">{formatCurrency(sale.amountPaid)}</span>
              </div>
              {sale.change !== undefined && sale.change > 0 && (
                <div className="flex justify-between border-t border-dashed border-[#0D0D0D]/20 pt-2 text-[11px] font-bold text-green-800">
                  <span>Monnaie</span>
                  <span className="tabular-nums">{formatCurrency(sale.change)}</span>
                </div>
              )}
            </>
          )}

          {sale.status === "PENDING" && (
            <p className="pt-1 text-center text-[10px] font-medium text-amber-800">Vente en attente — ticket provisoire</p>
          )}
        </div>

        <p className="mt-5 border-t border-dashed border-[#0D0D0D]/35 pt-3 text-center text-[9px] leading-relaxed text-[#6B7280]">
          Merci de votre visite
        </p>
      </div>
    </div>
  );
}
