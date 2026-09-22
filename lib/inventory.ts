import Supply from "@/models/Supply";
import Sale from "@/models/Sale";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import type { Types } from "mongoose";

/**
 * Stock disponible = total approvisionné − ventes COMPLETED (exercice actif).
 * Si `excludeSaleId` est fourni, les lignes de cette vente ne sont pas comptées dans le vendu
 * (utile quand la vente est encore PENDING au moment de la clôture).
 */
export async function getProductStock(
  productId: string,
  opts?: { excludeSaleId?: string; exerciceId?: string | Types.ObjectId }
): Promise<number> {
  const exerciceId = opts?.exerciceId ?? (await getActiveExerciceId());
  const supplies = await Supply.find(withExercice(exerciceId, { product: productId }));
  const totalSupplied = supplies.reduce((sum, s) => sum + s.totalUnits, 0);

  const match: Record<string, unknown> = withExercice(exerciceId, {
    "items.product": productId,
    status: "COMPLETED",
  });
  if (opts?.excludeSaleId) {
    match._id = { $ne: opts.excludeSaleId };
  }

  const completedSales = await Sale.find(match);
  const totalSold = completedSales.reduce((sum, sale) => {
    const line = sale.items.find((i) => i.product.toString() === productId);
    return sum + (line?.quantity ?? 0);
  }, 0);

  return totalSupplied - totalSold;
}
