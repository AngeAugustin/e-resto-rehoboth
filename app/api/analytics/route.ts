import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Sale from "@/models/Sale";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import {
  addMonths,
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from "date-fns";
import type { Types } from "mongoose";

type AnalyticsFilter = "today" | "yesterday" | "week" | "month" | "semester" | "year" | "custom";

interface ResolvedPeriod {
  filter: AnalyticsFilter;
  start: Date;
  end: Date;
  label: string;
}

function toDateAtDayStart(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function resolvePeriod(params: URLSearchParams): ResolvedPeriod {
  const now = new Date();
  const currentYear = now.getFullYear();
  const rawFilter = params.get("filter");
  const filter: AnalyticsFilter =
    rawFilter === "today" ||
    rawFilter === "yesterday" ||
    rawFilter === "week" ||
    rawFilter === "month" ||
    rawFilter === "semester" ||
    rawFilter === "custom" ||
    rawFilter === "year"
      ? rawFilter
      : "today";

  const yearRaw = Number(params.get("year"));
  const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : currentYear;
  const monthRaw = Number(params.get("month"));
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getMonth() + 1;
  const semesterRaw = Number(params.get("semester"));
  const semester = semesterRaw === 1 || semesterRaw === 2 ? semesterRaw : now.getMonth() < 6 ? 1 : 2;

  if (filter === "today") {
    const start = startOfDay(now);
    const end = endOfDay(now);
    return { filter, start, end, label: "Aujourd'hui" };
  }

  if (filter === "yesterday") {
    const yesterday = subDays(now, 1);
    const start = startOfDay(yesterday);
    const end = endOfDay(yesterday);
    return { filter, start, end, label: "Hier" };
  }

  if (filter === "week") {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfDay(endOfWeek(now, { weekStartsOn: 1 }));
    return { filter, start, end, label: "Semaine en cours" };
  }

  if (filter === "month") {
    const base = new Date(year, month - 1, 1);
    const start = startOfMonth(base);
    const end = endOfDay(endOfMonth(base));
    return {
      filter,
      start,
      end,
      label: base.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    };
  }

  if (filter === "semester") {
    const startMonth = semester === 1 ? 0 : 6;
    const start = startOfMonth(new Date(year, startMonth, 1));
    const end = endOfDay(endOfMonth(new Date(year, startMonth + 5, 1)));
    return {
      filter,
      start,
      end,
      label: `Semestre ${semester} ${year}`,
    };
  }

  if (filter === "custom") {
    const from = toDateAtDayStart(params.get("from"));
    const to = toDateAtDayStart(params.get("to"));
    if (from && to && from <= to) {
      return {
        filter,
        start: from,
        end: endOfDay(to),
        label: `${format(from, "dd/MM/yyyy")} - ${format(to, "dd/MM/yyyy")}`,
      };
    }
  }

  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfDay(endOfYear(new Date(year, 0, 1)));
  return { filter: "year", start, end, label: `Année ${year}` };
}

function buildBucketKeys(start: Date, end: Date, byMonth: boolean): string[] {
  const keys: string[] = [];
  if (byMonth) {
    let cursor = startOfMonth(start);
    const lastMonth = startOfMonth(end);
    while (cursor <= lastMonth) {
      keys.push(format(cursor, "yyyy-MM"));
      cursor = addMonths(cursor, 1);
    }
    return keys;
  }
  let cursor = startOfDay(start);
  const lastDay = startOfDay(end);
  while (cursor <= lastDay) {
    keys.push(format(cursor, "yyyy-MM-dd"));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

export async function GET(request: Request) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();

  const params = new URL(request.url).searchParams;
  const period = resolvePeriod(params);
  const daysInPeriod = differenceInCalendarDays(period.end, period.start) + 1;
  const compareEnd = endOfDay(subDays(period.start, 1));
  const compareStart = startOfDay(subDays(period.start, daysInPeriod));
  const bucketByMonth = period.filter === "year" || period.filter === "semester";
  const bucketFormat = bucketByMonth ? "%Y-%m" : "%Y-%m-%d";
  const productColl = Product.collection.name;

  const [
    revenueCostByBucket,
    salesByBucket,
    currentRevenueCostTotals,
    currentSalesTotals,
    previousRevenueCostTotals,
    previousSalesTotals,
    productRevenueAgg,
    suppliedRows,
    soldRows,
  ] = await Promise.all([
    Sale.aggregate<{ _id: string; revenue: number; cost: number }>([
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: period.start, $lte: period.end },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $dateToString: { format: bucketFormat, date: "$createdAt" } },
          revenue: { $sum: "$items.total" },
          cost: { $sum: { $multiply: [{ $ifNull: ["$items.unitCost", 0] }, "$items.quantity"] } },
        },
      },
    ]),
    Sale.aggregate<{ _id: string; sales: number }>([
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: period.start, $lte: period.end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: bucketFormat, date: "$createdAt" } },
          sales: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate<{ _id: null; revenue: number; cost: number }>([
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: period.start, $lte: period.end },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.total" },
          cost: { $sum: { $multiply: [{ $ifNull: ["$items.unitCost", 0] }, "$items.quantity"] } },
        },
      },
    ]),
    Sale.aggregate<{ _id: null; sales: number }>([
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: period.start, $lte: period.end },
        },
      },
      { $group: { _id: null, sales: { $sum: 1 } } },
    ]),
    Sale.aggregate<{ _id: null; revenue: number; cost: number }>([
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: compareStart, $lte: compareEnd },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.total" },
          cost: { $sum: { $multiply: [{ $ifNull: ["$items.unitCost", 0] }, "$items.quantity"] } },
        },
      },
    ]),
    Sale.aggregate<{ _id: null; sales: number }>([
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: compareStart, $lte: compareEnd },
        },
      },
      { $group: { _id: null, sales: { $sum: 1 } } },
    ]),
    Sale.aggregate<{
      _id: Types.ObjectId;
      name: string;
      image: string;
      price: number;
      revenue: number;
      units: number;
      margin: number;
    }>([
      { $match: { status: "COMPLETED", createdAt: { $gte: period.start, $lte: period.end } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          revenue: { $sum: "$items.total" },
          units: { $sum: "$items.quantity" },
          margin: {
            $sum: {
              $subtract: [
                "$items.total",
                { $multiply: [{ $ifNull: ["$items.unitCost", 0] }, "$items.quantity"] },
              ],
            },
          },
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
          image: { $ifNull: ["$p.image", ""] },
          price: { $ifNull: ["$p.marketSellingPrice", 0] },
          revenue: 1,
          units: 1,
          margin: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Supply.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $group: { _id: "$product", total: { $sum: "$totalUnits" } } },
    ]),
    Sale.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { status: "COMPLETED", createdAt: { $gte: period.start, $lte: period.end } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", total: { $sum: "$items.quantity" } } },
    ]),
  ]);

  const revenueMap = new Map(revenueCostByBucket.map((d) => [d._id, d]));
  const salesMap = new Map(salesByBucket.map((d) => [d._id, d.sales]));
  const bucketKeys = buildBucketKeys(period.start, period.end, bucketByMonth);
  const revenueEvolution = bucketKeys.map((key) => {
    const row = revenueMap.get(key);
    const revenue = row?.revenue ?? 0;
    const cost = row?.cost ?? 0;
    const grossProfit = revenue - cost;
    const date = bucketByMonth
      ? format(new Date(`${key}-01T00:00:00`), "MM/yyyy")
      : format(new Date(`${key}T00:00:00`), "dd/MM");
    return {
      date,
      revenue,
      cost,
      grossProfit,
      marginRate: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      sales: salesMap.get(key) ?? 0,
    };
  });

  const currentRevenue = currentRevenueCostTotals[0]?.revenue ?? 0;
  const currentCost = currentRevenueCostTotals[0]?.cost ?? 0;
  const currentProfit = currentRevenue - currentCost;
  const currentSales = currentSalesTotals[0]?.sales ?? 0;
  const previousRevenue = previousRevenueCostTotals[0]?.revenue ?? 0;
  const previousCost = previousRevenueCostTotals[0]?.cost ?? 0;
  const previousProfit = previousRevenue - previousCost;

  const revenueDeltaPct =
    previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : currentRevenue > 0 ? 100 : 0;
  const profitDeltaPct =
    previousProfit > 0 ? ((currentProfit - previousProfit) / previousProfit) * 100 : currentProfit > 0 ? 100 : 0;

  const productRevenue = productRevenueAgg.map((r) => ({
    name: r.name,
    image: typeof r.image === "string" ? r.image : "",
    price: r.price ?? 0,
    revenue: r.revenue,
    units: r.units,
    margin: r.margin ?? 0,
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
    period: {
      filter: period.filter,
      startDate: format(period.start, "yyyy-MM-dd"),
      endDate: format(period.end, "yyyy-MM-dd"),
      label: period.label,
    },
    summary: {
      totalRevenue: currentRevenue,
      totalCost: currentCost,
      totalGrossProfit: currentProfit,
      totalSales: currentSales,
      marginRate: currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0,
      averageTicket: currentSales > 0 ? currentRevenue / currentSales : 0,
      revenueDeltaPct,
      profitDeltaPct,
    },
    revenueEvolution,
    productRevenue,
    categoryDistribution,
    topProductsRadar,
  });
}
