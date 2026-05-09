import * as XLSX from "xlsx";
import { normalizeImportedCategory, type ProductCategory } from "@/lib/product-categories";

export interface ProductImportRow {
  rowNumber: number;
  name: string;
  category: ProductCategory | null;
  marketSellingPrice: number | null;
  /** Optionnel : colonne Quantité_standard_pack */
  quantiteStandardPack: number | null;
  /** Optionnel : colonne Prix_casier */
  prixCasier: number | null;
  image: string;
  valid: boolean;
  error?: string;
}

/** Normalise les en-têtes Excel (casse, accents, `_` / espaces). Ex. `Quantité_standard_pack` → `quantitestandardpack`, `Prix_casier` → `prixcasier`. */
function normalizeHeader(header: string): string {
  return String(header ?? "")
    .replace(/\ufeff/g, "")
    .replace(/[\u200b-\u200d]/g, "")
    .replace(/\u00a0/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Colonne optionnelle : en-tête attendu dans le fichier `Quantité_standard_pack` (ou équivalent accentué / espacé). */
function findQuantiteStandardPackColumnIndex(headers: string[]): number {
  const i = headers.findIndex((h) => h === "quantitestandardpack");
  if (i >= 0) return i;
  return headers.findIndex(
    (h) =>
      h.includes("quantitestandardpack") ||
      (h.includes("quantite") && h.includes("standard") && h.includes("pack"))
  );
}

/** Colonne optionnelle : en-tête attendu `Prix_casier`. */
function findPrixCasierColumnIndex(headers: string[]): number {
  const i = headers.findIndex((h) => h === "prixcasier");
  if (i >= 0) return i;
  return headers.findIndex((h) => h.includes("prixcasier"));
}

type OptionalPackQty = number | null | "invalid";

function parseOptionalPackQuantity(value: unknown): OptionalPackQty {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return "invalid";
  const raw = String(value).trim();
  if (raw === "") return null;
  const n = typeof value === "number" ? value : Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return "invalid";
  const int = Math.round(n);
  if (Math.abs(n - int) > 1e-9 || int < 1) return "invalid";
  return int;
}

function parseOptionalPrixCasier(value: unknown): number | null | "invalid" {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return "invalid";
  const raw = String(value).trim();
  if (raw === "") return null;
  const p = parsePrice(value);
  if (p === null) return "invalid";
  return p;
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 ? value : null;
  }
  if (value == null || typeof value === "boolean") return null;
  const cleaned = String(value)
    .trim()
    .replace(/[^\d,.\-]/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function findMarketPriceColumnIndex(headers: string[]): number {
  const patterns = [
    "prixdeventeunitairemarche",
    "prixdeventeunitaire",
    "prixventeunitairemarche",
    "prixunitairemarche",
    "prixventemarche",
    "prixmarche",
  ];
  for (const p of patterns) {
    const idx = headers.findIndex((h) => h.includes(p));
    if (idx >= 0) return idx;
  }
  return headers.findIndex((h) => h.includes("marche") && h.includes("prix"));
}

function parseImageUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : "";
}

function parseExcelRows(buffer: Buffer): ProductImportRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  if (rows.length <= 1) return [];

  const headers = (rows[0] as unknown[]).map((cell) => normalizeHeader(String(cell ?? "")));
  const productIndex = headers.findIndex((h) => h === "produit" || h.includes("produit"));
  const categoryIndex = headers.findIndex((h) => h === "categorie" || h.includes("categorie"));
  const marketPriceIndex = findMarketPriceColumnIndex(headers);
  const imageIndex = headers.findIndex((h) => h.includes("lienimage") || h === "image" || h.includes("lien"));
  const qtyPackIndex = findQuantiteStandardPackColumnIndex(headers);
  const prixCasierIndex = findPrixCasierColumnIndex(headers);

  return rows.slice(1).map((cellsRaw, idx) => {
    const cells = (cellsRaw as unknown[]) ?? [];
    const name = String(cells[productIndex] ?? "").trim();
    const categoryRaw = String(cells[categoryIndex] ?? "").trim();
    const category = normalizeImportedCategory(categoryRaw);
    const marketSellingPrice = marketPriceIndex >= 0 ? parsePrice(cells[marketPriceIndex]) : null;
    const image = imageIndex >= 0 ? parseImageUrl(cells[imageIndex]) : "";

    let quantiteStandardPack: number | null = null;
    let prixCasier: number | null = null;

    const errors: string[] = [];
    if (!name) errors.push("Nom manquant");
    if (!category) errors.push("Catégorie invalide");
    if (marketSellingPrice === null || !Number.isFinite(marketSellingPrice) || marketSellingPrice <= 0) {
      errors.push("Prix marché invalide");
    }
    if (qtyPackIndex >= 0) {
      const q = parseOptionalPackQuantity(cells[qtyPackIndex]);
      if (q === "invalid") errors.push("Quantité standard pack invalide");
      else quantiteStandardPack = q;
    }
    if (prixCasierIndex >= 0) {
      const pc = parseOptionalPrixCasier(cells[prixCasierIndex]);
      if (pc === "invalid") errors.push("Prix casier invalide");
      else prixCasier = pc;
    }

    return {
      rowNumber: idx + 2,
      name,
      category,
      marketSellingPrice,
      quantiteStandardPack,
      prixCasier,
      image,
      valid: errors.length === 0,
      ...(errors.length > 0 && { error: errors.join(" · ") }),
    };
  });
}

const PDF_CATEGORY_HINTS = [
  "Boissons Panaché",
  "Boisson Panaché",
  "Boissons gazeuses",
  "Boisson gazeuse",
  "Eaux thermales gazeifiées",
  "Eau thermale gazéifiée",
  "Eaux aromatisées",
  "Eau aromatisée",
  "Jus d'ananas",
  "Alcool Mix",
  "Alcool mix",
  "Bières",
  "Bière",
  "Eaux",
  "Eau",
];

function findCategoryAndProductFromPdfChunk(source: string): { name: string; category: ProductCategory | null } {
  const trimmed = source.trim();
  if (!trimmed) return { name: "", category: null };

  for (const hint of PDF_CATEGORY_HINTS.sort((a, b) => b.length - a.length)) {
    const normalizedHint = normalizeHeader(hint);
    const normalizedSource = normalizeHeader(trimmed);
    if (!normalizedSource.endsWith(normalizedHint)) continue;

    const name = trimmed.slice(0, trimmed.length - hint.length).trim();
    const category = normalizeImportedCategory(hint);
    return { name, category };
  }

  return { name: trimmed, category: null };
}

function parsePdfRows(text: string): ProductImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const mapped: (ProductImportRow | null)[] = lines.map((line, idx) => {
    if (idx === 0 && /produit/i.test(line) && /categorie/i.test(line) && /prix/i.test(line)) {
      return null;
    }

    const urlMatch = line.match(/https?:\/\/\S+$/i);
    const image = urlMatch ? urlMatch[0] : "";
    const lineWithoutUrl = urlMatch ? line.slice(0, line.length - image.length).trim() : line;

    const priceMatch = lineWithoutUrl.match(/(\d[\d\s.,]*)$/);
    const priceRaw = priceMatch ? priceMatch[1] : "";
    const marketSellingPrice = parsePrice(priceRaw);
    const beforePrice = priceMatch
      ? lineWithoutUrl.slice(0, lineWithoutUrl.length - priceRaw.length).trim()
      : lineWithoutUrl;

    const { name, category } = findCategoryAndProductFromPdfChunk(beforePrice);
    const errors: string[] = [];
    if (!name) errors.push("Nom manquant");
    if (!category) errors.push("Catégorie invalide");
    if (marketSellingPrice === null || !Number.isFinite(marketSellingPrice) || marketSellingPrice <= 0) {
      errors.push("Prix marché invalide");
    }

    return {
      rowNumber: idx + 1,
      name,
      category,
      marketSellingPrice,
      quantiteStandardPack: null,
      prixCasier: null,
      image,
      valid: errors.length === 0,
      ...(errors.length > 0 && { error: errors.join(" · ") }),
    } satisfies ProductImportRow;
  });

  return mapped.filter((row): row is ProductImportRow => row !== null);
}

export async function parseProductImportFile(input: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<ProductImportRow[]> {
  const fileName = input.fileName.toLowerCase();
  const mime = input.mimeType.toLowerCase();

  if (
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  ) {
    return parseExcelRows(input.buffer);
  }

  if (fileName.endsWith(".pdf") || mime.includes("pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(input.buffer) });
    try {
      const textResult = await parser.getText();
      return parsePdfRows(textResult.text ?? "");
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  throw new Error("Format non supporté. Utilisez un fichier Excel (.xlsx/.xls) ou PDF.");
}
