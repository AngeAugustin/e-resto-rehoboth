import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES } from "@/lib/roles";
import { getExerciceById, serializeExercice, withExercice } from "@/lib/exercice";
import { getVersedTotalsByImmobilisation } from "@/lib/immobilisations";
import Sale from "@/models/Sale";
import Supply from "@/models/Supply";
import Expense from "@/models/Expense";
import Payroll from "@/models/Payroll";
import KitchenOrder from "@/models/KitchenOrder";
import CashSession from "@/models/CashSession";
import Immobilisation from "@/models/Immobilisation";
import Product from "@/models/Product";
import "@/models/Waitress";
import "@/models/RestaurantTable";
import "@/models/User";
import "@/models/ExpenseCategory";
import "@/models/ExpensePaymentMethod";
import "@/models/Cook";
import "@/models/KitchenWaitress";
import "@/models/KitchenPlate";
import "@/models/Menu";

const LIST_LIMIT = 100;

function personName(row: unknown): string {
  if (!row || typeof row !== "object") return "—";
  const r = row as { firstName?: string; lastName?: string; name?: string };
  if (r.firstName || r.lastName) return `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "—";
  return r.name ?? "—";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const exercice = await getExerciceById(id);
  if (!exercice) {
    return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });
  }

  const exerciceId = exercice._id;
  const filter = withExercice(exerciceId);

  const [
    salesStats,
    sales,
    suppliesStats,
    supplies,
    expensesStats,
    expenses,
    payrollStats,
    payroll,
    kitchenStats,
    kitchenOrders,
    cashSessions,
    immobilisations,
    suppliedRows,
    soldRows,
    products,
  ] = await Promise.all([
    Sale.aggregate<{ revenue: number; count: number; completed: number; pending: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$totalAmount", 0] },
          },
          completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
        },
      },
    ]),
    Sale.find(filter)
      .populate("waitress", "firstName lastName")
      .populate("tables", "number name")
      .populate("items.product", "name")
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .lean(),
    Supply.aggregate<{ totalCost: number; totalUnits: number; count: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalCost: { $sum: "$totalCost" },
          totalUnits: { $sum: "$totalUnits" },
        },
      },
    ]),
    Supply.find(filter)
      .populate("product", "name")
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .lean(),
    Expense.aggregate<{ totalAmount: number; count: number }>([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Expense.find(filter)
      .populate("category", "name")
      .populate("paymentMethod", "name")
      .sort({ date: -1 })
      .limit(LIST_LIMIT)
      .lean(),
    Payroll.aggregate<{ totalAmount: number; count: number }>([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Payroll.find(filter)
      .populate("waitress", "firstName lastName")
      .populate("kitchenWaitress", "firstName lastName")
      .populate("cook", "firstName lastName")
      .populate("user", "firstName lastName")
      .sort({ paidAt: -1 })
      .limit(LIST_LIMIT)
      .lean(),
    KitchenOrder.aggregate<{ revenue: number; count: number; completed: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$totalAmount", 0] },
          },
          completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
        },
      },
    ]),
    KitchenOrder.find(filter)
      .populate("cook", "firstName lastName")
      .populate("kitchenWaitress", "firstName lastName")
      .populate("plate", "number")
      .populate("items.menu", "name")
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .lean(),
    CashSession.find(filter).sort({ createdAt: -1 }).limit(LIST_LIMIT).lean(),
    Immobilisation.find(filter).sort({ createdAt: -1 }).limit(LIST_LIMIT).lean(),
    Supply.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: filter },
      { $group: { _id: "$product", total: { $sum: "$totalUnits" } } },
    ]),
    Sale.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: withExercice(exerciceId, { status: "COMPLETED" }) },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", total: { $sum: "$items.quantity" } } },
    ]),
    Product.find({}, { name: 1 }).lean(),
  ]);

  const suppliedMap = new Map(suppliedRows.map((r) => [String(r._id), r.total]));
  const soldMap = new Map(soldRows.map((r) => [String(r._id), r.total]));
  const stock = products
    .map((p) => {
      const qty = (suppliedMap.get(String(p._id)) ?? 0) - (soldMap.get(String(p._id)) ?? 0);
      return { productId: String(p._id), name: p.name, stock: qty };
    })
    .filter((row) => row.stock !== 0 || suppliedMap.has(row.productId))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const immoTotals = await getVersedTotalsByImmobilisation(
    immobilisations.map((row) => row._id),
    exerciceId
  );
  const immobilisationsEnriched = immobilisations.map((row) => {
    const paid = immoTotals.get(String(row._id)) ?? 0;
    return {
      _id: String(row._id),
      name: row.name,
      amount: row.amount,
      paidAmount: paid,
      remainingAmount: Math.max(0, row.amount - paid),
      createdAt: row.createdAt,
    };
  });

  const ss = salesStats[0];
  const su = suppliesStats[0];
  const ex = expensesStats[0];
  const py = payrollStats[0];
  const ko = kitchenStats[0];

  return NextResponse.json({
    exercice: serializeExercice(exercice),
    readOnly: !exercice.isActive,
    summary: {
      openingBalance: exercice.openingBalance,
      salesRevenue: ss?.revenue ?? 0,
      salesCount: ss?.count ?? 0,
      salesCompleted: ss?.completed ?? 0,
      salesPending: ss?.pending ?? 0,
      suppliesCost: su?.totalCost ?? 0,
      suppliesUnits: su?.totalUnits ?? 0,
      suppliesCount: su?.count ?? 0,
      expensesTotal: ex?.totalAmount ?? 0,
      expensesCount: ex?.count ?? 0,
      payrollTotal: py?.totalAmount ?? 0,
      payrollCount: py?.count ?? 0,
      kitchenRevenue: ko?.revenue ?? 0,
      kitchenCount: ko?.count ?? 0,
      cashSessionsCount: cashSessions.length,
      immobilisationsCount: immobilisationsEnriched.length,
      immobilisationsAmount: immobilisationsEnriched.reduce((s, r) => s + r.amount, 0),
      stockProductsCount: stock.length,
    },
    sales: sales.map((row) => ({
      _id: String(row._id),
      createdAt: row.createdAt,
      status: row.status,
      totalAmount: row.totalAmount,
      waitress: personName(row.waitress),
      itemsCount: row.items?.length ?? 0,
    })),
    supplies: supplies.map((row) => ({
      _id: String(row._id),
      createdAt: row.createdAt,
      product: (row.product as { name?: string } | undefined)?.name ?? "—",
      totalUnits: row.totalUnits,
      totalCost: row.totalCost,
    })),
    expenses: expenses.map((row) => ({
      _id: String(row._id),
      date: row.date,
      label: row.label,
      amount: row.amount,
      category: (row.category as { name?: string } | undefined)?.name ?? "—",
      paymentMethod: (row.paymentMethod as { name?: string } | undefined)?.name ?? "—",
    })),
    payroll: payroll.map((row) => ({
      _id: String(row._id),
      paidAt: row.paidAt,
      amount: row.amount,
      beneficiaryType: row.beneficiaryType,
      beneficiary:
        personName(row.waitress) !== "—"
          ? personName(row.waitress)
          : personName(row.kitchenWaitress) !== "—"
            ? personName(row.kitchenWaitress)
            : personName(row.cook) !== "—"
              ? personName(row.cook)
              : personName(row.user),
      isPaid: Boolean(row.isPaid),
    })),
    kitchenOrders: kitchenOrders.map((row) => ({
      _id: String(row._id),
      createdAt: row.createdAt,
      status: row.status,
      totalAmount: row.totalAmount,
      cook: personName(row.cook),
      plate: (row.plate as { number?: number } | undefined)?.number ?? "—",
    })),
    cashSessions: cashSessions.map((row) => ({
      _id: String(row._id),
      name: row.name,
      kind: row.kind ?? "BAR",
      status: row.status,
      sessionDate: row.sessionDate,
      openingFloat: row.openingFloat,
      closedAt: row.closedAt,
    })),
    immobilisations: immobilisationsEnriched,
    stock,
    limits: { list: LIST_LIMIT },
  });
}
