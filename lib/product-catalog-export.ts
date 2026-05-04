import { formatCurrency, formatDateTime } from "@/lib/utils";

export type ProductCatalogExportRow = {
  _id: string;
  name: string;
  category?: string;
  image?: string;
  sellingPrice: number;
  defaultMarketSellingPrice?: number;
  marketSellingPrice: number;
  stock: number;
  isActive?: boolean;
  purchaseUnitCost?: number;
  createdAt?: string;
  updatedAt?: string;
};

function formatMoney(n: number): string {
  return formatCurrency(n).replace(/[\u202F\u00A0]/g, " ");
}

function catalogStatusLabel(p: ProductCatalogExportRow): string {
  return p.isActive === false ? "Désactivé" : "Actif";
}

function formatOptionalMoney(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n === 0) return "—";
  return formatMoney(n);
}

export function toAbsoluteImageUrl(origin: string, image?: string): string | null {
  const t = image?.trim();
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("//")) return `https:${t}`;
  const base = origin.replace(/\/$/, "");
  if (t.startsWith("/")) return `${base}${t}`;
  return `${base}/${t}`;
}

const EXPORT_THUMB_MAX_EDGE = 112;
const EXPORT_JPEG_QUALITY = 0.78;
/** Évite de saturer le navigateur / le serveur avec trop de requêtes simultanées */
const EXPORT_IMAGE_CONCURRENCY = 6;

export type CatalogExportProgress = {
  phase: "images" | "document";
  done: number;
  total: number;
};

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/** Réduit le poids des fichiers et le temps passé dans jsPDF / ExcelJS. */
function resizeImageBlobToJpegDataUrl(blob: Blob, maxEdge: number, quality: number): Promise<string | null> {
  return new Promise((resolve) => {
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w <= 0 || h <= 0) {
          URL.revokeObjectURL(objUrl);
          resolve(null);
          return;
        }
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objUrl);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        URL.revokeObjectURL(objUrl);
        resolve(dataUrl);
      } catch {
        URL.revokeObjectURL(objUrl);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve(null);
    };
    img.src = objUrl;
  });
}

async function fetchThumbnailDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors", credentials: "same-origin" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    const jpeg = await resizeImageBlobToJpegDataUrl(blob, EXPORT_THUMB_MAX_EDGE, EXPORT_JPEG_QUALITY);
    if (jpeg) return jpeg;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

async function runPool<T>(items: readonly T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  const n = Math.max(1, Math.min(concurrency, items.length));
  let next = 0;
  const runWorker = async () => {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) break;
      await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: n }, () => runWorker()));
}

function dataUrlToJspdfImage(dataUrl: string): { data: string; format: "JPEG" | "PNG" | "WEBP" | "GIF" } | null {
  const m = /^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  const data = m[2];
  if (ext === "jpg" || ext === "jpeg") return { data, format: "JPEG" };
  if (ext === "png") return { data, format: "PNG" };
  if (ext === "webp") return { data, format: "WEBP" };
  if (ext === "gif") return { data, format: "GIF" };
  return null;
}

function slugDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function dataUrlToExcelImage(dataUrl: string): { base64: string; extension: "jpeg" | "png" | "gif" } | null {
  const m = /^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const base64 = m[2];
  if (kind === "png") return { base64, extension: "png" };
  if (kind === "gif") return { base64, extension: "gif" };
  return { base64, extension: "jpeg" };
}

export async function buildProductThumbnailMap(
  products: ProductCatalogExportRow[],
  origin: string,
  onProgress?: (p: CatalogExportProgress) => void
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const total = products.length;
  let done = 0;
  const bump = () => {
    done += 1;
    onProgress?.({ phase: "images", done, total });
  };

  await runPool(products, EXPORT_IMAGE_CONCURRENCY, async (p) => {
    const url = toAbsoluteImageUrl(origin, p.image);
    if (!url) {
      map.set(p._id, null);
      bump();
      return;
    }
    const dataUrl = await fetchThumbnailDataUrl(url);
    map.set(p._id, dataUrl);
    bump();
  });

  return map;
}

export async function exportProductCatalogPdf(
  products: ProductCatalogExportRow[],
  origin: string,
  onProgress?: (p: CatalogExportProgress) => void
): Promise<Blob> {
  const imageMap = await buildProductThumbnailMap(products, origin, onProgress);
  onProgress?.({ phase: "document", done: 0, total: 1 });

  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableModule as { default: (doc: unknown, options: Record<string, unknown>) => void }).default;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = 297;
  const pageH = 210;
  const margin = 12;
  const primary: [number, number, number] = [15, 23, 42];
  const border: [number, number, number] = [226, 232, 240];
  const muted: [number, number, number] = [100, 116, 139];
  const accent: [number, number, number] = [30, 64, 175];

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setDrawColor(...border);
  doc.line(0, 22, pageW, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...primary);
  doc.text("Catalogue produits", margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`Généré le ${formatDateTime(new Date())} · ${products.length} référence(s)`, margin, 19);

  const tableBody = products.map((p) => [
    "",
    p.name,
    p.category ?? "—",
    formatMoney(p.marketSellingPrice),
    formatOptionalMoney(p.purchaseUnitCost),
    String(p.stock),
    catalogStatusLabel(p),
  ]);

  const head = [[
    "Visuel",
    "Nom",
    "Catégorie",
    "Prix vente marché (actuel)",
    "Coût d'achat unitaire",
    "Stock",
    "Statut catalogue",
  ]];

  autoTable(doc, {
    startY: 26,
    margin: { top: margin, right: margin, bottom: 16, left: margin },
    head,
    body: tableBody,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: border,
      lineWidth: 0.15,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: primary,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 18, minCellHeight: 16, halign: "center" },
      1: { cellWidth: 44 },
      2: { cellWidth: 32 },
      3: { cellWidth: 36, halign: "right" },
      4: { cellWidth: 32, halign: "right" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 28, halign: "center" },
    },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    didDrawCell: (data: {
      section: string;
      column: { index: number };
      row: { index: number };
      cell: { x: number; y: number; width: number; height: number };
    }) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const p = products[data.row.index];
      if (!p) return;
      const dataUrl = imageMap.get(p._id);
      const parsed = dataUrl ? dataUrlToJspdfImage(dataUrl) : null;
      const pad = 1.2;
      const maxW = data.cell.width - pad * 2;
      const maxH = data.cell.height - pad * 2;
      const cx = data.cell.x + data.cell.width / 2;
      const cy = data.cell.y + data.cell.height / 2;
      if (parsed && maxW > 2 && maxH > 2) {
        const ratio = Math.min(maxW / 14, maxH / 14, 1);
        const w = 14 * ratio;
        const h = 14 * ratio;
        try {
          doc.addImage(parsed.data, parsed.format, cx - w / 2, cy - h / 2, w, h);
        } catch {
          doc.setFontSize(7);
          doc.setTextColor(...muted);
          doc.text("—", cx, cy, { align: "center", baseline: "middle" });
        }
      } else {
        doc.setFontSize(7);
        doc.setTextColor(...muted);
        doc.text("—", cx, cy, { align: "center", baseline: "middle" });
      }
    },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...accent);
    doc.text("e-stock · Catalogue produits", margin, pageH - 6);
    doc.text(`Page ${i}/${pages}`, pageW - margin, pageH - 6, { align: "right" });
  }

  onProgress?.({ phase: "document", done: 1, total: 1 });
  return doc.output("blob") as Blob;
}

export async function exportProductCatalogXlsx(
  products: ProductCatalogExportRow[],
  origin: string,
  onProgress?: (p: CatalogExportProgress) => void
): Promise<Blob> {
  const thumbMap = await buildProductThumbnailMap(products, origin, onProgress);
  onProgress?.({ phase: "document", done: 0, total: 1 });

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "e-stock";
  wb.created = new Date();
  const ws = wb.addWorksheet("Catalogue", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  const colCount = 9;
  ws.mergeCells(1, 1, 1, colCount);
  const title = ws.getCell(1, 1);
  title.value = "Catalogue produits";
  title.font = { size: 18, bold: true, color: { argb: "FF0F172A" } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, colCount);
  const sub = ws.getCell(2, 1);
  sub.value = `Généré le ${formatDateTime(new Date())}  ·  ${products.length} référence(s)`;
  sub.font = { size: 11, color: { argb: "FF64748B" } };
  sub.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 22;

  ws.getRow(3).height = 6;

  const headers = [
    "Photo",
    "Nom",
    "Catégorie",
    "Prix vente marché (actuel)",
    "Coût d'achat unitaire",
    "Stock",
    "Statut catalogue",
    "Créé le",
    "Lien image",
  ];
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  });
  headerRow.height = 36;

  ws.columns = [
    { width: 14 },
    { width: 30 },
    { width: 24 },
    { width: 22 },
    { width: 20 },
    { width: 10 },
    { width: 18 },
    { width: 16 },
    { width: 44 },
  ];

  for (let i = 0; i < products.length; i += 1) {
    const p = products[i];
    const excelRowIndex = 5 + i;
    const row = ws.getRow(excelRowIndex);
    row.height = 78;

    const absUrl = toAbsoluteImageUrl(origin, p.image) ?? "";
    row.getCell(1).value = "";
    row.getCell(2).value = p.name;
    row.getCell(3).value = p.category ?? "—";
    row.getCell(4).value = p.marketSellingPrice;
    row.getCell(4).numFmt = "#,##0";
    row.getCell(5).value = p.purchaseUnitCost && p.purchaseUnitCost > 0 ? p.purchaseUnitCost : null;
    row.getCell(5).numFmt = "#,##0";
    row.getCell(6).value = p.stock;
    row.getCell(6).numFmt = "#,##0";
    row.getCell(7).value = catalogStatusLabel(p);
    row.getCell(8).value = p.createdAt ? formatDateTime(p.createdAt) : "—";
    row.getCell(9).value = absUrl || "—";

    for (let c = 1; c <= colCount; c += 1) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      const hAlign: "left" | "right" | "center" =
        c >= 4 && c <= 6 ? "right" : c === 7 ? "center" : "left";
      cell.alignment = { vertical: "middle", wrapText: c === 2 || c === 9, horizontal: hAlign };
    }

    const thumb = thumbMap.get(p._id);
    if (thumb) {
      const img = dataUrlToExcelImage(thumb);
      if (img) {
        const imageId = wb.addImage({
          base64: img.base64,
          extension: img.extension,
        });
        ws.addImage(imageId, {
          tl: { col: 0, row: excelRowIndex - 1 },
          ext: { width: 88, height: 88 },
        });
      }
    }
  }

  onProgress?.({ phase: "document", done: 1, total: 1 });
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadCatalogFile(blob: Blob, extension: "pdf" | "xlsx"): void {
  const stamp = slugDate(new Date());
  const name = extension === "pdf" ? `catalogue-produits-${stamp}.pdf` : `catalogue-produits-${stamp}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
