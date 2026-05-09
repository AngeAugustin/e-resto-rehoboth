/** Quantité standard d’un pack / casier (entier ≥ 1), ou absent. */
export function parseQuantiteStandardPack(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  const int = Math.round(n);
  if (Math.abs(n - int) > 1e-9 || int < 1) return undefined;
  return int;
}

/** Prix d’un casier (≥ 0), ou absent. */
export function parsePrixCasier(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}
