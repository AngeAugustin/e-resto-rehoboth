import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import { normalizeImportedCategory, type ProductCategory } from "@/lib/product-categories";

export interface ProductImportRow {
  rowNumber: number;
  name: string;
  category: ProductCategory | null;
  sellingPrice: number | null;
  image: string;
  valid: boolean;
  error?: string;
}

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d,.\-]/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
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
  const priceIndex = headers.findIndex((h) => h === "prixvente" || h === "prix" || h.includes("prix"));
  const imageIndex = headers.findIndex((h) => h.includes("lienimage") || h === "image" || h.includes("lien"));

  return rows.slice(1).map((cellsRaw, idx) => {
    const cells = (cellsRaw as unknown[]) ?? [];
    const name = String(cells[productIndex] ?? "").trim();
    const categoryRaw = String(cells[categoryIndex] ?? "").trim();
    const category = normalizeImportedCategory(categoryRaw);
    const sellingPrice = parsePrice(cells[priceIndex]);
    const image = imageIndex >= 0 ? parseImageUrl(cells[imageIndex]) : "";

    const errors: string[] = [];
    if (!name) errors.push("Nom manquant");
    if (!category) errors.push("Catégorie invalide");
    if (sellingPrice === null) errors.push("Prix invalide");

    return {
      rowNumber: idx + 2,
      name,
      category,
      sellingPrice,
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

  return lines
    .map((line, idx) => {
      // Ignore header line if present.
      if (idx === 0 && /produit/i.test(line) && /categorie/i.test(line) && /prix/i.test(line)) {
        return null;
      }

      const urlMatch = line.match(/https?:\/\/\S+$/i);
      const image = urlMatch ? urlMatch[0] : "";
      const lineWithoutUrl = urlMatch ? line.slice(0, line.length - image.length).trim() : line;

      const priceMatch = lineWithoutUrl.match(/(\d[\d\s.,]*)$/);
      const priceRaw = priceMatch ? priceMatch[1] : "";
      const sellingPrice = parsePrice(priceRaw);
      const beforePrice = priceMatch
        ? lineWithoutUrl.slice(0, lineWithoutUrl.length - priceRaw.length).trim()
        : lineWithoutUrl;

      const { name, category } = findCategoryAndProductFromPdfChunk(beforePrice);
      const errors: string[] = [];
      if (!name) errors.push("Nom manquant");
      if (!category) errors.push("Catégorie invalide");
      if (sellingPrice === null) errors.push("Prix invalide");

      return {
        rowNumber: idx + 1,
        name,
        category,
        sellingPrice,
        image,
        valid: errors.length === 0,
        ...(errors.length > 0 && { error: errors.join(" · ") }),
      } satisfies ProductImportRow;
    })
    .filter((row): row is ProductImportRow => row !== null);
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
