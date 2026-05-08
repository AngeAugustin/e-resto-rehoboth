import { NextResponse } from "next/server";
import { format } from "date-fns";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import CashSession from "@/models/CashSession";
import Sale from "@/models/Sale";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import Waitress from "@/models/Waitress";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const cashSession = await CashSession.findById(id).lean<{
    _id: Types.ObjectId;
    name: string;
    createdAt: Date;
    closedAt?: Date;
  } | null>();

  if (!cashSession) {
    return NextResponse.json({ error: "Session introuvable." }, { status: 404 });
  }

  const start = new Date(cashSession.createdAt);
  const end = cashSession.closedAt ? new Date(cashSession.closedAt) : new Date();
  const productColl = Product.collection.name;
  const waitressColl = Waitress.collection.name;

  const [suppliesRows, salesRows, productProfits] = await Promise.all([
    Supply.aggregate<{
      _id: Types.ObjectId;
      createdAt: Date;
      productName: string;
      totalUnits: number;
      totalCost: number;
    }>([
      { $match: { createdAt: { $gte: start, $lte: end } } },
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
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: start, $lte: end },
        },
      },
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
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: start, $lte: end },
        },
      },
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
      filter: "custom",
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      label: cashSession.name,
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
