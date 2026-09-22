import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import Sale from "@/models/Sale";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import Waitress from "@/models/Waitress";
import {
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

export async function GET(request: Request) {
  const { error } = await requireAuth(["directeur","directrice"]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();

  const period = resolvePeriod(new URL(request.url).searchParams);
  const productColl = Product.collection.name;
  const waitressColl = Waitress.collection.name;
  const completedPeriodMatch = withExercice(exerciceId, {
    status: "COMPLETED",
    createdAt: { $gte: period.start, $lte: period.end },
  });

  const [suppliesRows, salesRows, productProfits] = await Promise.all([
    Supply.aggregate<{
      _id: Types.ObjectId;
      createdAt: Date;
      productName: string;
      totalUnits: number;
      totalCost: number;
    }>([
      { $match: withExercice(exerciceId, { createdAt: { $gte: period.start, $lte: period.end } }) },
      {
        $lookup: {
          from: productColl,
          localField: "product",
          foreignField: "_id",
          as: "p",
        },
      },
      { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          productName: { $ifNull: ["$p.name", "Inconnu"] },
          totalUnits: 1,
          totalCost: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]),
    Sale.aggregate<{
      _id: Types.ObjectId;
      createdAt: Date;
      totalAmount: number;
      amountPaid?: number;
      change?: number;
      waitressName: string;
      itemsCount: number;
      saleItems: Array<{ productName: string; quantity: number }>;
    }>([
      { $match: completedPeriodMatch },
      {
        $lookup: {
          from: waitressColl,
          localField: "waitress",
          foreignField: "_id",
          as: "w",
        },
      },
      {
        $lookup: {
          from: productColl,
          localField: "items.product",
          foreignField: "_id",
          as: "saleProducts",
        },
      },
      { $unwind: { path: "$w", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          totalAmount: 1,
          amountPaid: 1,
          change: 1,
          itemsCount: { $sum: "$items.quantity" },
          saleItems: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                productName: {
                  $let: {
                    vars: {
                      productMatch: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$saleProducts",
                              as: "p",
                              cond: { $eq: ["$$p._id", "$$item.product"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: { $ifNull: ["$$productMatch.name", "Produit inconnu"] },
                  },
                },
                quantity: "$$item.quantity",
              },
            },
          },
          waitressName: {
            $trim: {
              input: {
                $concat: [{ $ifNull: ["$w.firstName", ""] }, " ", { $ifNull: ["$w.lastName", ""] }],
              },
            },
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]),
    Sale.aggregate<{ _id: Types.ObjectId; name: string; units: number; revenue: number; profit: number }>([
      { $match: completedPeriodMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          units: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.total" },
          profit: {
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
          units: 1,
          revenue: 1,
          profit: 1,
        },
      },
      { $sort: { units: -1 } },
    ]),
  ]);

  const suppliesCount = suppliesRows.length;
  const suppliesUnits = suppliesRows.reduce((sum, row) => sum + (row.totalUnits ?? 0), 0);
  const suppliesTotalCost = suppliesRows.reduce((sum, row) => sum + (row.totalCost ?? 0), 0);
  const salesCount = salesRows.length;
  const salesRevenue = salesRows.reduce((sum, row) => sum + (row.totalAmount ?? 0), 0);
  const topSellingProduct = productProfits[0]
    ? {
        name: productProfits[0].name,
        units: productProfits[0].units,
        revenue: productProfits[0].revenue,
        profit: productProfits[0].profit,
      }
    : null;

  return NextResponse.json({
    period: {
      filter: period.filter,
      startDate: format(period.start, "yyyy-MM-dd"),
      endDate: format(period.end, "yyyy-MM-dd"),
      label: period.label,
    },
    summary: {
      suppliesCount,
      suppliesUnits,
      suppliesTotalCost,
      salesCount,
      salesRevenue,
    },
    supplies: suppliesRows.map((row) => ({
      date: format(row.createdAt, "dd/MM/yyyy"),
      productName: row.productName,
      totalUnits: row.totalUnits,
      totalCost: row.totalCost,
    })),
    sales: salesRows.map((row) => ({
      date: format(row.createdAt, "dd/MM/yyyy"),
      totalAmount: row.totalAmount,
      amountPaid: row.amountPaid ?? 0,
      change: row.change ?? 0,
      waitressName: row.waitressName || "Inconnue",
      itemsCount: row.itemsCount ?? 0,
      saleItems: row.saleItems ?? [],
    })),
    productProfits: productProfits.map((row) => ({
      name: row.name,
      units: row.units,
      revenue: row.revenue,
      profit: row.profit,
    })),
    topSellingProduct,
    generatedAt: new Date().toISOString(),
  });
}
