/** Corps JSON / formulaire : nombre valide, ou absent / vide → null (pas 0 par défaut côté client). */
export function parsePriceBodyField(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Prix de vente marché produit : strictement positif. */
export function parsePositiveMarketPrice(value: unknown): number | null {
  const n = parsePriceBodyField(value);
  if (n == null || n <= 0) return null;
  return n;
}
