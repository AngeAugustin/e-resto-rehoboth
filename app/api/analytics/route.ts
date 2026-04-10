import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Sale from "@/models/Sale";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import { startOfDay, subDays, format } from "date-fns";
import type { Types } from "mongoose";

export async function GET() {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();

  const monthStart = startOfDay(subDays(new Date(), 29));
  const productColl = Product.collection.name;

  const [monthByDay, productRevenueAgg, suppliedRows, soldRows] = await Promise.all([
    Sale.aggregate<{ _id: string; revenue: number; sales: number }>([
      { $match: { status: "COMPLETED", createdAt: { $gte: monthStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
          sales: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate<{ _id: Types.ObjectId; name: string; revenue: number; units: number }>([
      { $match: { status: "COMPLETED" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          revenue: { $sum: "$items.total" },
          units: { $sum: "$items.quantity" },
        },
      },
      {
        $lookup: {
          from: productColl,
          localField: "_id",
          foreignField: "_id",
          as: "p",
        },
      },
      { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: { $ifNull: ["$p.name", "Inconnu"] },
          revenue: 1,
          units: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Supply.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $group: { _id: "$product", total: { $sum: "$totalUnits" } } },
    ]),
    Sale.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { status: "COMPLETED" } },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", total: { $sum: "$items.quantity" } } },
    ]),
  ]);

  const dayMap = new Map(monthByDay.map((d) => [d._id, d]));
  const revenueEvolution = Array.from({ length: 30 }, (_, i) => {
    const day = startOfDay(subDays(new Date(), 29 - i));
    const key = format(day, "yyyy-MM-dd");
    const row = dayMap.get(key);
    return {
      date: format(day, "dd/MM"),
      revenue: row?.revenue ?? 0,
      sales: row?.sales ?? 0,
    };
  });

  const productRevenue = productRevenueAgg.map((r) => ({
    name: r.name,
    revenue: r.revenue,
    units: r.units,
  }));

  const categoryDistribution = productRevenue.slice(0, 8).map((p) => ({
    name: p.name,
    value: p.revenue,
  }));

  const suppliedMap = new Map(suppliedRows.map((r) => [r._id.toString(), r.total]));
  const soldMap = new Map(soldRows.map((r) => [r._id.toString(), r.total]));

  const topProductsRadar = productRevenueAgg.slice(0, 5).map((p) => {
    const pid = p._id.toString();
    const totalSupplied = suppliedMap.get(pid) ?? 0;
    const totalSold = soldMap.get(pid) ?? 0;
    return {
      product: p.name,
      sales: p.units,
      revenue: Math.round(p.revenue / 1000),
      stock: Math.max(0, totalSupplied - totalSold),
    };
  });

  return NextResponse.json({
    revenueEvolution,
    productRevenue,
    categoryDistribution,
    topProductsRadar,
  });
}
