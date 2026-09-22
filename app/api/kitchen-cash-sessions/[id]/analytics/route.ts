import { NextResponse } from "next/server";
import { format } from "date-fns";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES } from "@/lib/roles";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import { kitchenCashSessionFilter } from "@/lib/cash-session";
import CashSession from "@/models/CashSession";
import KitchenOrder from "@/models/KitchenOrder";
import Menu from "@/models/Menu";
import Cook from "@/models/Cook";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;

  const cashSession = await CashSession.findOne({
    _id: id,
    ...kitchenCashSessionFilter(exerciceId),
  }).lean<{
    _id: Types.ObjectId;
    name: string;
    kind?: string;
    createdAt: Date;
    closedAt?: Date;
  } | null>();

  if (!cashSession || cashSession.kind !== "KITCHEN") {
    return NextResponse.json({ error: "Session introuvable." }, { status: 404 });
  }

  const start = new Date(cashSession.createdAt);
  const end = cashSession.closedAt ? new Date(cashSession.closedAt) : new Date();
  const menuColl = Menu.collection.name;
  const cookColl = Cook.collection.name;

  const [salesRows, productProfits] = await Promise.all([
    KitchenOrder.aggregate<{
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
        $match: withExercice(exerciceId, {
          status: "COMPLETED",
          createdAt: { $gte: start, $lte: end },
        }),
      },
      {
        $lookup: {
          from: cookColl,
          localField: "cook",
          foreignField: "_id",
          as: "c",
        },
      },
      {
        $lookup: {
          from: menuColl,
          localField: "items.menu",
          foreignField: "_id",
          as: "saleProducts",
        },
      },
      { $unwind: { path: "$c", preserveNullAndEmptyArrays: true } },
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
                              cond: { $eq: ["$$p._id", "$$item.menu"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: { $ifNull: ["$$productMatch.name", "Menu inconnu"] },
                  },
                },
                quantity: "$$item.quantity",
              },
            },
          },
          waitressName: {
            $trim: {
              input: {
                $concat: [{ $ifNull: ["$c.firstName", ""] }, " ", { $ifNull: ["$c.lastName", ""] }],
              },
            },
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]),
    KitchenOrder.aggregate<{ _id: Types.ObjectId; name: string; units: number; revenue: number; profit: number }>([
      {
        $match: withExercice(exerciceId, {
          status: "COMPLETED",
          createdAt: { $gte: start, $lte: end },
        }),
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.menu",
          units: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.total" },
          profit: { $sum: "$items.total" },
        },
      },
      {
        $lookup: {
          from: menuColl,
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
      suppliesCount: 0,
      suppliesUnits: 0,
      suppliesTotalCost: 0,
      salesCount,
      salesRevenue,
    },
    supplies: [],
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
