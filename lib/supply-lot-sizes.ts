/** Tailles de casier proposées par défaut dans le sélecteur */
export const SUPPLY_LOT_SIZES = [6, 12, 24] as const;

/** Valeur interne du sélecteur pour « Autre » (saisie libre, entier ≥ 1) */
export const SUPPLY_LOT_SIZE_SELECT_OTHER = "__other__" as const;

/** Plafond côté API / formulaire (évite les abus et les débordements) */
export const MAX_SUPPLY_LOT_SIZE = 1_000_000;

export function isStandardSupplyLotSize(n: number): boolean {
  return (SUPPLY_LOT_SIZES as readonly number[]).includes(n);
}

export function isValidSupplyLotSize(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_SUPPLY_LOT_SIZE;
}

export function isValidLotSizeChoice(lotSizeStr: string): boolean {
  const trimmed = lotSizeStr.trim();
  if (trimmed === "") return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= MAX_SUPPLY_LOT_SIZE;
}
