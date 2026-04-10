import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import Sale from "@/models/Sale";

// Returns all products with their current stock level (single round-trip style: 1 find + 2 aggregates)
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const [products, suppliedRows, soldRows] = await Promise.all([
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
  ]);

  const suppliedMap = new Map(suppliedRows.map((r) => [r._id.toString(), r.total]));
  const soldMap = new Map(soldRows.map((r) => [r._id.toString(), r.total]));

  const productsWithStock = products.map((p) => {
    const id = p._id.toString();
    const totalSupplied = suppliedMap.get(id) ?? 0;
    const totalSold = soldMap.get(id) ?? 0;
    return {
      ...p,
      stock: totalSupplied - totalSold,
    };
  });

  return NextResponse.json(productsWithStock);
}
