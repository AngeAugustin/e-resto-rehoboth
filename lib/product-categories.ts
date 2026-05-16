export const PRODUCT_CATEGORIES = [
  "Eau",
  "Bière",
  "Boisson Panaché",
  "Alcool mix",
  "Jus d'ananas",
  "Eau aromatisée",
  "Eau thermale gazéifiée",
  "Boisson gazeuse",
] as const;

export type ProductCategory = string;

export const DEFAULT_PRODUCT_CATEGORY: ProductCategory = PRODUCT_CATEGORIES[0];

export function isValidProductCategory(input: unknown): input is ProductCategory {
  return typeof input === "string" && input.trim().length > 0;
}

function normalizeTextValue(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CATEGORY_ALIAS_TO_CANONICAL: Record<string, string> = {
  eau: "Eau",
  eaux: "Eau",
  biere: "Bière",
  bieres: "Bière",
  "boisson panache": "Boisson Panaché",
  "boissons panache": "Boisson Panaché",
  "alcool mix": "Alcool mix",
  "alcools mix": "Alcool mix",
  "jus d ananas": "Jus d'ananas",
  "jus ananas": "Jus d'ananas",
  "eau aromatisee": "Eau aromatisée",
  "eaux aromatisees": "Eau aromatisée",
  "eau thermale gazeifiee": "Eau thermale gazéifiée",
  "eaux thermales gazeifiees": "Eau thermale gazéifiée",
  "boisson gazeuse": "Boisson gazeuse",
  "boissons gazeuses": "Boisson gazeuse",
};

export function normalizeImportedCategory(input: unknown): ProductCategory | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = normalizeTextValue(trimmed);
  return CATEGORY_ALIAS_TO_CANONICAL[normalized] ?? trimmed;
}
