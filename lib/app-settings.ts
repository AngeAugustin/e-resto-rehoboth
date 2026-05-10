export const GLOBAL_SETTINGS_KEY = "global";

/** Tag `next/cache` pour invalider le thème SSR quand la couleur primaire change. */
export const PRIMARY_THEME_CACHE_TAG = "app-settings-primary-theme";
export const DEFAULT_SOLUTION_NAME = "Rehoboth - Fleur de Dieu";

export const PRIMARY_COLOR_PALETTE = [
  "#1F1F1F", // Noir professionnel
  "#4472C4", // Bleu Office
  "#ED7D31", // Orange Office
  "#A5A5A5", // Gris Office
  "#FFC000", // Or Office
  "#5B9BD5", // Bleu clair Office
  "#70AD47", // Vert Office
  "#264478", // Bleu marine
  "#9E480E", // Brun cuivré
  "#636363", // Gris anthracite
  "#997300", // Or foncé
  "#43682B", // Vert forêt
] as const;

export const DEFAULT_PRIMARY_COLOR = PRIMARY_COLOR_PALETTE[0];
export const DEFAULT_LOGO_URL = "/Logo.png";

/** Nombre d’unités (inclus) en dessous duquel le stock est considéré comme bas (alerte email, indicateurs). */
export const DEFAULT_LOW_STOCK_ALERT_THRESHOLD = 5;

/**
 * Délai (jours calendaires) indiqué sur le ticket lorsque le reliquat n’a pas encore été remis au client à la clôture.
 * Passé ce délai, le ticket précise que la somme n’est plus remboursable.
 */
export const SALE_CHANGE_PICKUP_DEADLINE_DAYS: number = 7;

const LOW_STOCK_THRESHOLD_MIN = 0;
const LOW_STOCK_THRESHOLD_MAX = 999;

export function normalizeLowStockAlertThreshold(input: unknown): number {
  let n: number;
  if (typeof input === "number" && Number.isFinite(input)) {
    n = Math.trunc(input);
  } else if (typeof input === "string" && /^\d+$/.test(input.trim())) {
    n = Number.parseInt(input.trim(), 10);
  } else {
    return DEFAULT_LOW_STOCK_ALERT_THRESHOLD;
  }
  return Math.min(LOW_STOCK_THRESHOLD_MAX, Math.max(LOW_STOCK_THRESHOLD_MIN, n));
}

export function isAllowedPrimaryColor(color: string): boolean {
  return normalizeHexColor(color) !== null;
}

export function normalizeHexColor(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return null;
  return withHash.toUpperCase();
}

export function isAllowedLogoUrl(url: string): boolean {
  return url === DEFAULT_LOGO_URL || /^\/uploads\/branding\/[a-zA-Z0-9._-]+$/.test(url);
}

export function normalizeSolutionName(input: unknown): string {
  if (typeof input !== "string") return DEFAULT_SOLUTION_NAME;
  const cleaned = input.trim().replace(/\s+/g, " ");
  if (!cleaned) return DEFAULT_SOLUTION_NAME;
  return cleaned.slice(0, 80);
}

export function normalizeEmailList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const unique = new Set<string>();

  for (const value of input) {
    if (typeof value !== "string") continue;
    const email = value.trim().toLowerCase();
    if (!email) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    unique.add(email);
  }

  return Array.from(unique);
}

export function hexToHslTriplet(hexColor: string): string | null {
  const clean = hexColor.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;

  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h /= 6;

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyPrimaryColorToDocument(hexColor: string): boolean {
  if (typeof document === "undefined") return false;
  const hslTriplet = hexToHslTriplet(hexColor);
  if (!hslTriplet) return false;
  document.documentElement.style.setProperty("--primary", hslTriplet);
  document.documentElement.style.setProperty("--ring", hslTriplet);
  return true;
}
