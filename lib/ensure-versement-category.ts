import ExpenseCategory from "@/models/ExpenseCategory";
import { VERSEMENT_CATEGORY_NAME } from "@/lib/versement-category";

export async function ensureVersementCategory() {
  const existing = await ExpenseCategory.findOne({ name: VERSEMENT_CATEGORY_NAME });
  if (existing) return existing;
  return ExpenseCategory.create({ name: VERSEMENT_CATEGORY_NAME });
}
