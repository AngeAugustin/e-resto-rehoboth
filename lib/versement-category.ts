export const VERSEMENT_CATEGORY_NAME = "VERSEMENT";

export function isVersementCategoryName(name: string | undefined | null): boolean {
  return (name ?? "").trim().toUpperCase() === VERSEMENT_CATEGORY_NAME;
}
