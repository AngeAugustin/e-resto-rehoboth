import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Sale from "@/models/Sale";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import "@/models/Waitress";
import "@/models/RestaurantTable";
import AppSetting from "@/models/AppSetting";
import { GLOBAL_SETTINGS_KEY, normalizeLowStockAlertThreshold } from "@/lib/app-settings";
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
    productsLite,
    recentSales,
    settingsDoc,
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
    Product.find({}, { _id: 1, name: 1, image: 1, marketSellingPrice: 1 }).lean(),
    Sale.find()
      .populate("waitress", "firstName lastName")
      .populate("tables", "number name")
      .populate("table", "number name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    AppSetting.findOne({ key: GLOBAL_SETTINGS_KEY }).select("lowStockAlertThreshold").lean(),
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
  const lowStockThreshold = normalizeLowStockAlertThreshold(
    settingsDoc?.lowStockAlertThreshold
  );
  let lowStockCount = 0;
  const lowStockProducts: Array<{ id: string; name: string; image?: string; stock: number; marketSellingPrice: number }> =
    [];
  for (const p of productsLite) {
    const supplied = suppliedMap.get(p._id.toString()) ?? 0;
    const sold = soldMap.get(p._id.toString()) ?? 0;
    const stock = supplied - sold;
    if (stock <= lowStockThreshold) {
      lowStockCount++;
      lowStockProducts.push({
        id: p._id.toString(),
        name: (p as { name?: string }).name ?? "Produit",
        image: (p as { image?: string }).image ?? "",
        stock,
        marketSellingPrice: Number((p as { marketSellingPrice?: number }).marketSellingPrice ?? 0),
      });
    }
  }
  lowStockProducts.sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "fr"));

  return NextResponse.json({
    todayRevenue,
    todaySalesCount,
    lowStockCount,
    totalProducts: productsLite.length,
    weeklyRevenue,
    topProducts: topProductsRaw,
    lowStockProducts: lowStockProducts.slice(0, 5),
    recentSales,
  });
}
