"use client";

import { useState } from "react";
import { FileDown, FileText, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { CatalogExportProgress, ProductCatalogExportRow } from "@/lib/product-catalog-export";
import {
  downloadCatalogFile,
  exportProductCatalogPdf,
  exportProductCatalogXlsx,
} from "@/lib/product-catalog-export";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductCatalogExportRow[];
};

export function ProductCatalogExportDialog({ open, onOpenChange, products }: Props) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function run(kind: "pdf" | "xlsx") {
    if (products.length === 0) {
      toast({
        variant: "destructive",
        title: "Aucun produit à exporter",
        description: "Élargissez les filtres ou la recherche.",
      });
      return;
    }
    setBusy(kind);
    setProgressLabel("Préparation des visuels…");
    setProgressPct(0);
    const onProgress = (p: CatalogExportProgress) => {
      if (p.phase === "images") {
        const t = Math.max(p.total, 1);
        setProgressLabel(`Images ${p.done}/${p.total}`);
        setProgressPct(Math.min(88, Math.round((p.done / t) * 88)));
      } else {
        setProgressLabel("Écriture du fichier…");
        setProgressPct((prev) => Math.max(prev, 92));
      }
    };
    try {
      const blob =
        kind === "pdf"
          ? await exportProductCatalogPdf(products, origin, onProgress)
          : await exportProductCatalogXlsx(products, origin, onProgress);
      setProgressPct(100);
      setProgressLabel("Téléchargement…");
      downloadCatalogFile(blob, kind === "pdf" ? "pdf" : "xlsx");
      toast({
        variant: "success",
        title: "Export généré",
        description: "Le téléchargement du fichier a démarré.",
      });
      onOpenChange(false);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Export impossible",
        description: e instanceof Error ? e.message : "Réessayez dans un instant.",
      });
    } finally {
      setBusy(null);
      setProgressLabel(null);
      setProgressPct(0);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && busy) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-[#0F172A]" />
            Exporter le catalogue
          </DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            Le fichier inclut la liste correspondant à vos filtres actuels ({products.length}{" "}
            produit{products.length !== 1 ? "s" : ""}) : visuels, libellés, catégories, prix de
            vente marché actuel, coût d&apos;achat unitaire (dernier lot), stock, statut
            actif/désactivé, dates et lien image. Les images sont optimisées pour un export plus
            rapide.
          </DialogDescription>
        </DialogHeader>
        {busy && progressLabel ? (
          <div className="space-y-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
            <div className="flex justify-between text-xs text-[#64748B]">
              <span>{progressLabel}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
              <div
                className="h-full rounded-full bg-[#0F172A] transition-[width] duration-200 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-2 py-4 border-[#E2E8F0] hover:bg-[#F8FAFC]"
            disabled={!!busy}
            onClick={() => run("pdf")}
          >
            <FileText className="h-8 w-8 text-[#B91C1C]" />
            <span className="font-semibold">{busy === "pdf" ? "Génération PDF…" : "PDF"}</span>
            <span className="text-xs font-normal text-[#64748B]">Document A4 paysage</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-2 py-4 border-[#E2E8F0] hover:bg-[#F8FAFC]"
            disabled={!!busy}
            onClick={() => run("xlsx")}
          >
            <Sheet className="h-8 w-8 text-[#15803D]" />
            <span className="font-semibold">{busy === "xlsx" ? "Génération Excel…" : "Excel (.xlsx)"}</span>
            <span className="text-xs font-normal text-[#64748B]">Tableau structuré + photos</span>
          </Button>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="ghost" disabled={!!busy} onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
