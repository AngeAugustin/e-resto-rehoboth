import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import Sale from "@/models/Sale";
import { DEFAULT_PRODUCT_CATEGORY } from "@/lib/product-categories";

// Returns all products with their current stock level (single round-trip style: 1 find + 2 aggregates)
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const [products, suppliedRows, soldRows, latestSupplyByProduct] = await Promise.all([
    Product.find().sort({ name: 1 }).lean(),
    Supply.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $group: { _id: "$product", total: { $sum: "$totalUnits" } } },
    ]),
    Sale.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { status: "COMPLETED" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          total: { $sum: "$items.quantity" },
        },
      },
    ]),
    Supply.aggregate<{
      _id: Types.ObjectId;
      marketSellingPrice: number;
      totalCost: number;
      totalUnits: number;
    }>([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$product",
          marketSellingPrice: { $first: "$marketSellingPrice" },
          totalCost: { $first: "$totalCost" },
          totalUnits: { $first: "$totalUnits" },
        },
      },
    ]),
  ]);

  const suppliedMap = new Map(suppliedRows.map((r) => [r._id.toString(), r.total]));
  const soldMap = new Map(soldRows.map((r) => [r._id.toString(), r.total]));
  const latestMap = new Map(latestSupplyByProduct.map((r) => [r._id.toString(), r]));

  const productsWithStock = products.map((p) => {
    const id = p._id.toString();
    const totalSupplied = suppliedMap.get(id) ?? 0;
    const totalSold = soldMap.get(id) ?? 0;
    const latest = latestMap.get(id);
    const hasLatest = latest && latest.totalUnits > 0;
    const marketSellingPrice = hasLatest ? latest.marketSellingPrice : p.sellingPrice;
    const purchaseUnitCost = hasLatest ? latest.totalCost / latest.totalUnits : 0;
    return {
      ...p,
      category: p.category ?? DEFAULT_PRODUCT_CATEGORY,
      stock: totalSupplied - totalSold,
      marketSellingPrice,
      purchaseUnitCost,
    };
  });

  return NextResponse.json(productsWithStock);
}
