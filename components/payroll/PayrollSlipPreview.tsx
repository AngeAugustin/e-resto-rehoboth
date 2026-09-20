"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Printer, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportElementToA4Pdf } from "@/lib/receipt-pdf";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_LOGO_URL, DEFAULT_SOLUTION_NAME } from "@/lib/app-settings";
import { PAYROLL_TYPE_LABEL, payrollBaseSalary, payrollBonuses } from "@/lib/payroll";
import type { IPayroll } from "@/types";

const LEGACY_PROMOTER_SIGNATURE_SRC = "/signature.jpeg";
const LEGACY_PROMOTER_SIGNATURE_NAME = "Protus Djidjoho DAH ADANLIENCLOUNON";

async function fetchBranding(): Promise<{ logoUrl: string; solutionName: string }> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("settings");
  return res.json();
}

function personName(p: IPayroll): string {
  const n = (o?: { firstName?: string; lastName?: string } | string) =>
    typeof o === "object" && o ? `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() : "";
  if (p.beneficiaryType === "WAITRESS") return n(p.waitress as { firstName?: string; lastName?: string }) || "—";
  if (p.beneficiaryType === "KITCHEN_WAITRESS") return n(p.kitchenWaitress as { firstName?: string; lastName?: string }) || "—";
  if (p.beneficiaryType === "COOK") return n(p.cook as { firstName?: string; lastName?: string }) || "—";
  return n(p.user as { firstName?: string; lastName?: string }) || "—";
}

function promoterDisplay(p: IPayroll): { name: string; signatureUrl?: string } {
  if (p.promoter?.firstName || p.promoter?.lastName) {
    return {
      name: `${p.promoter.firstName ?? ""} ${p.promoter.lastName ?? ""}`.trim(),
      signatureUrl: p.promoter.signatureUrl,
    };
  }
  const createdBy = p.createdBy;
  if (typeof createdBy === "object" && createdBy) {
    const name = `${createdBy.firstName ?? ""} ${createdBy.lastName ?? ""}`.trim();
    if (name) {
      return {
        name,
        signatureUrl: createdBy.signatureUrl,
      };
    }
  }
  return {
    name: LEGACY_PROMOTER_SIGNATURE_NAME,
    signatureUrl: LEGACY_PROMOTER_SIGNATURE_SRC,
  };
}

function slipNumber(id: string): string {
  const digits = id.replace(/[^a-fA-F0-9]/g, "").slice(-8).toUpperCase();
  return digits ? `PAIE-${digits}` : "PAIE";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-slate-200">
      <th className="w-[42%] bg-slate-50 px-4 py-2.5 text-left text-[12px] font-medium text-slate-600">
        {label}
      </th>
      <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-900">{value}</td>
    </tr>
  );
}

export function PayrollSlipPreview({
  payroll,
  onMarkPaid,
  markingPaid,
}: {
  payroll: IPayroll;
  onMarkPaid?: () => void;
  markingPaid?: boolean;
}) {
  const slipRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  const { data: branding } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchBranding,
    staleTime: 5 * 60 * 1000,
  });

  const logoUrl = !logoBroken && branding?.logoUrl ? branding.logoUrl : DEFAULT_LOGO_URL;
  const solutionName = branding?.solutionName?.trim() ? branding.solutionName : DEFAULT_SOLUTION_NAME;

  useEffect(() => {
    if (branding?.logoUrl) setLogoBroken(false);
  }, [branding?.logoUrl]);

  const baseSalary = payrollBaseSalary(payroll);
  const bonuses = payrollBonuses(payroll);
  const promoter = promoterDisplay(payroll);

  const handleDownloadPdf = async () => {
    const el = slipRef.current;
    if (!el) {
      toast({ variant: "destructive", title: "Erreur", description: "Aperçu de la fiche introuvable." });
      return;
    }
    setPdfLoading(true);
    try {
      await exportElementToA4Pdf(el, `fiche-paie-${personName(payroll).replace(/\s+/g, "-")}`);
      toast({ title: "Téléchargement", description: "La fiche de paie a été enregistrée au format PDF." });
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de générer le PDF." });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">Aperçu document</span>
        <div className="flex flex-wrap items-center gap-2">
          {!payroll.isPaid && onMarkPaid ? (
            <Button
              type="button"
              size="sm"
              className="h-9 flex-1 gap-2 rounded-lg sm:flex-none"
              onClick={onMarkPaid}
              disabled={markingPaid}
            >
              {markingPaid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
              Payer
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-2 rounded-lg sm:flex-none"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            <span className="sm:inline">Imprimer</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-2 rounded-lg sm:flex-none"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
          >
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="truncate">PDF</span>
          </Button>
        </div>
      </div>

      <div className="min-w-0 overflow-x-auto overscroll-x-contain rounded-lg [-webkit-overflow-scrolling:touch]">
      <div
        ref={slipRef}
        id="payroll-slip-print"
        className="mx-auto w-full min-w-[640px] max-w-[794px] bg-white px-5 py-6 text-slate-900 shadow-md ring-1 ring-slate-200 sm:min-w-0 sm:px-8 sm:py-8"
        style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
      >
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={logoUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full object-contain"
              onError={() => setLogoBroken(true)}
            />
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-snug">{solutionName}</p>
              <p className="mt-1 text-[11px] tracking-wide text-slate-500">Document interne — Paie du personnel</p>
            </div>
          </div>
          <div className="shrink-0 text-right text-[11px] text-slate-600">
            <p className="font-semibold text-slate-900">N° {slipNumber(payroll._id)}</p>
            <p className="mt-1">Édité le {formatDate(new Date().toISOString())}</p>
          </div>
        </header>

        <h1 className="mt-6 text-center text-[20px] font-bold uppercase tracking-[0.18em]">
          Fiche de paie
        </h1>
        {payroll.isPaid ? (
          <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Payée
          </p>
        ) : (
          <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
            À payer
          </p>
        )}

        <section className="mt-6">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Bénéficiaire
          </h2>
          <table className="w-full border border-slate-300 text-left">
            <tbody>
              <Row label="Nom et prénoms" value={personName(payroll)} />
              <Row label="Fonction" value={PAYROLL_TYPE_LABEL[payroll.beneficiaryType]} />
            </tbody>
          </table>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Période et paiement
          </h2>
          <table className="w-full border border-slate-300 text-left">
            <tbody>
              <Row
                label="Période couverte"
                value={`${formatDate(payroll.periodStart)} au ${formatDate(payroll.periodEnd)}`}
              />
              <Row label="Date de paiement" value={formatDate(payroll.paidAt)} />
              <Row label="Mode de paiement" value="En espèces" />
            </tbody>
          </table>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Rémunération
          </h2>
          <table className="w-full border border-slate-300 text-left">
            <tbody>
              <Row label="Salaire" value={formatCurrency(baseSalary)} />
              {bonuses.map((bonus, index) => (
                <Row
                  key={`${bonus.name}-${index}`}
                  label={`Bonus — ${bonus.name}`}
                  value={formatCurrency(bonus.amount)}
                />
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-between border-2 border-slate-900 bg-slate-50 px-4 py-4">
            <span className="text-[13px] font-bold uppercase tracking-wide">Net versé</span>
            <span className="text-[20px] font-bold tabular-nums">{formatCurrency(payroll.amount)}</span>
          </div>
        </section>

        {payroll.comment ? (
          <section className="mt-5">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Observations
            </h2>
            <p className="min-h-[52px] border border-slate-300 px-4 py-3 text-[13px] leading-relaxed text-slate-800">
              {payroll.comment}
            </p>
          </section>
        ) : null}

        <section className="mt-10 grid grid-cols-2 gap-8 text-[12px]">
          <div className="text-center">
            <p className="font-semibold text-slate-800">
              {PAYROLL_TYPE_LABEL[payroll.beneficiaryType]}
            </p>
            <div className="mt-4 flex min-h-[96px] flex-col items-center justify-end">
              <div className="h-24 w-full max-w-[220px]" aria-hidden />
              <p className="mt-3 text-[13px] font-semibold text-slate-900">{personName(payroll)}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-800">Le promoteur</p>
            <div className="mt-4 flex flex-col items-center justify-center">
              {promoter.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={promoter.signatureUrl}
                  alt={`Signature de ${promoter.name}`}
                  className="h-24 w-auto max-w-[220px] object-contain"
                />
              ) : (
                <div className="flex h-24 w-full max-w-[220px] items-center justify-center border border-dashed border-slate-300 text-[11px] text-slate-400">
                  Signature manquante
                </div>
              )}
              <p className="mt-3 text-[13px] font-semibold leading-snug text-slate-900">
                {promoter.name || "—"}
              </p>
            </div>
          </div>
        </section>

        <p className="mt-8 text-center text-[10px] leading-relaxed text-slate-500">
          Document établi à titre de justificatif de versement de salaire.
        </p>
      </div>
      </div>
    </div>
  );
}
