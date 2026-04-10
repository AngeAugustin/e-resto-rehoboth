import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Sale from "@/models/Sale";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import "@/models/Waitress";
import "@/models/RestaurantTable";
import { startOfDay, subDays, format } from "date-fns";
import type { Types } from "mongoose";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const today = startOfDay(new Date());
  const weekStart = startOfDay(subDays(new Date(), 6));
  const productColl = Product.collection.name;

  const [
    todayStats,
    weekByDay,
    topProductsRaw,
    suppliedRows,
    soldRows,
    productIds,
    recentSales,
  ] = await Promise.all([
    Sale.aggregate<{ revenue: number; count: number }>([
      { $match: { status: "COMPLETED", createdAt: { $gte: today } } },
      { $group: { _id: null, revenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate<{ _id: string; revenue: number }>([
      { $match: { status: "COMPLETED", createdAt: { $gte: weekStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
        },
      },
    ]),
    Sale.aggregate<{ name: string; sold: number; revenue: number }>([
      { $match: { status: "COMPLETED" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          sold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.total" },
        },
      },
      { $sort: { sold: -1 } },
      { $limit: 5 },
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
          _id: 0,
          name: { $ifNull: ["$p.name", "Inconnu"] },
          sold: 1,
          revenue: 1,
        },
      },
    ]),
    Supply.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $group: { _id: "$product", total: { $sum: "$totalUnits" } } },
    ]),
    Sale.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { status: "COMPLETED" } },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", total: { $sum: "$items.quantity" } } },
    ]),
    Product.find({}, { _id: 1 }).lean(),
    Sale.find()
      .populate("waitress", "firstName lastName")
      .populate("table", "number name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const todayRevenue = todayStats[0]?.revenue ?? 0;
  const todaySalesCount = todayStats[0]?.count ?? 0;

  const weekMap = new Map(weekByDay.map((d) => [d._id, d.revenue]));
  const weeklyRevenue = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(subDays(new Date(), 6 - i));
    const key = format(day, "yyyy-MM-dd");
    return { date: format(day, "dd/MM"), revenue: weekMap.get(key) ?? 0 };
  });

  const suppliedMap = new Map(suppliedRows.map((r) => [r._id.toString(), r.total]));
  const soldMap = new Map(soldRows.map((r) => [r._id.toString(), r.total]));
  let lowStockCount = 0;
  for (const p of productIds) {
    const supplied = suppliedMap.get(p._id.toString()) ?? 0;
    const sold = soldMap.get(p._id.toString()) ?? 0;
    if (supplied - sold < 5) lowStockCount++;
  }

  return NextResponse.json({
    todayRevenue,
    todaySalesCount,
    lowStockCount,
    totalProducts: productIds.length,
    weeklyRevenue,
    topProducts: topProductsRaw,
    recentSales,
  });
}
