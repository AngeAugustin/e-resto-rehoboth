import Product from "@/models/Product";
import Supply from "@/models/Supply";

export interface SaleLinePricing {
  /** Prix unitaire marché : fiche produit */
  unitPrice: number;
  /** Coût d'achat réel unitaire : `totalCost / totalUnits` du dernier appro, sinon 0 */
  unitCost: number;
}

/**
 * Détermine le prix de vente et le coût unitaire pour une ligne de vente.
 */
export async function resolveSaleLinePricing(productId: string): Promise<SaleLinePricing> {
  const latest = await Supply.findOne({ product: productId })
    .sort({ createdAt: -1 })
    .select("totalCost totalUnits")
    .lean<{ totalCost: number; totalUnits: number } | null>();

  const product = await Product.findById(productId)
    .select("marketSellingPrice")
    .lean<{ marketSellingPrice?: number } | null>();

  const unitPrice =
    product?.marketSellingPrice != null && Number.isFinite(product.marketSellingPrice) && product.marketSellingPrice > 0
      ? product.marketSellingPrice
      : 0;

  if (!latest || !latest.totalUnits || latest.totalUnits <= 0) {
    return { unitPrice, unitCost: 0 };
  }

  return {
    unitPrice,
    unitCost: latest.totalCost / latest.totalUnits,
  };
}
