import { getActiveExercice, serializeExercice, updateActiveExerciceOpening } from "@/lib/exercice";
import Supply from "@/models/Supply";
import Expense from "@/models/Expense";
import "@/models/Product";
import "@/models/ExpenseCategory";
import "@/models/User";
import { startOfLocalDay } from "@/lib/accounting-window";
import type { AccountingFilter, IAccountingMovement, IAccountingSnapshot } from "@/types";

export { parseAccountingInstant, resolveAccountingWindow } from "@/lib/accounting-window";

function productName(product: unknown): string {
  if (product && typeof product === "object" && "name" in product) {
    const name = (product as { name?: string }).name;
    if (name) return name;
  }
  return "Approvisionnement";
}

function categoryName(category: unknown): string {
  if (category && typeof category === "object" && "name" in category) {
    const name = (category as { name?: string }).name;
    if (name) return name;
  }
  return "";
}

function toMovements(
  supplies: Array<{ _id: { toString(): string }; createdAt: Date; totalCost: number; product?: unknown }>,
  expenses: Array<{ _id: { toString(): string }; date: Date; amount: number; label: string; category?: unknown }>
): IAccountingMovement[] {
  const supplyMovements: IAccountingMovement[] = supplies.map((row) => ({
    kind: "SUPPLY",
    id: String(row._id),
    date: new Date(row.createdAt).toISOString(),
    label: productName(row.product),
    amount: Number(row.totalCost ?? 0),
  }));
  const expenseMovements: IAccountingMovement[] = expenses.map((row) => {
    const cat = categoryName(row.category);
    return {
      kind: "EXPENSE" as const,
      id: String(row._id),
      date: new Date(row.date).toISOString(),
      label: cat ? `${row.label} (${cat})` : row.label,
      amount: Number(row.amount ?? 0),
    };
  });
  return [...supplyMovements, ...expenseMovements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

function sumAmount(rows: Array<{ totalCost?: number; amount?: number }>, field: "totalCost" | "amount"): number {
  return rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

export async function getAccountingOpening(): Promise<{
  _id: { toString(): string };
  openingBalance: number;
  openedAt: Date;
  note?: string;
} | null> {
  const exercice = await getActiveExercice();
  return {
    _id: exercice._id,
    openingBalance: exercice.openingBalance,
    openedAt: exercice.startedAt,
    note: exercice.note,
  };
}

export async function setAccountingOpening(input: {
  openingBalance: number;
  openedAt?: Date;
  note?: string;
}) {
  const updated = await updateActiveExerciceOpening(input);
  return serializeExercice(updated);
}

export async function buildAccountingSnapshot(window: {
  filter: AccountingFilter;
  from: Date;
  to: Date;
  label: string;
}): Promise<IAccountingSnapshot> {
  const period = await getAccountingOpening();
  const exercice = await getActiveExercice();
  const serializedPeriod = period
    ? {
        _id: String(period._id),
        openingBalance: period.openingBalance,
        openedAt: new Date(period.openedAt).toISOString(),
        note: period.note,
      }
    : null;

  const empty = (active: boolean, startBalance = 0): IAccountingSnapshot => ({
    filter: window.filter,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    label: window.label,
    generatedAt: new Date().toISOString(),
    period: serializedPeriod,
    active,
    openingBalance: period?.openingBalance ?? 0,
    startBalance,
    suppliesTotal: 0,
    expensesTotal: 0,
    remaining: startBalance,
    movements: [],
  });

  if (!period) return empty(false);
  if (window.to.getTime() < new Date(period.openedAt).getTime()) return empty(false);

  const openedAt = new Date(period.openedAt);
  const windowStart = openedAt.getTime() > window.from.getTime() ? openedAt : window.from;
  const expensePeriodFrom = startOfLocalDay(windowStart);
  const exerciceFilter = { exercice: exercice._id };

  const supplySelect = { createdAt: 1, totalCost: 1, product: 1 };
  const expenseSelect = { date: 1, amount: 1, label: 1, category: 1 };

  const [suppliesBefore, expensesBefore, supplies, expenses] = await Promise.all([
    Supply.find({ ...exerciceFilter, createdAt: { $gte: openedAt, $lt: windowStart } })
      .select(supplySelect)
      .lean<Array<{ totalCost: number }>>(),
    Expense.find({
      ...exerciceFilter,
      date: { $gte: startOfLocalDay(openedAt), $lt: startOfLocalDay(windowStart) },
    })
      .select("amount")
      .lean<Array<{ amount: number }>>(),
    Supply.find({ ...exerciceFilter, createdAt: { $gte: windowStart, $lte: window.to } })
      .populate("product", "name")
      .select(supplySelect)
      .lean<Array<{ _id: { toString(): string }; createdAt: Date; totalCost: number; product?: unknown }>>(),
    Expense.find({ ...exerciceFilter, date: { $gte: expensePeriodFrom, $lte: window.to } })
      .populate("category", "name")
      .select(expenseSelect)
      .lean<Array<{ _id: { toString(): string }; date: Date; amount: number; label: string; category?: unknown }>>(),
  ]);

  const startBalance =
    period.openingBalance - sumAmount(suppliesBefore, "totalCost") - sumAmount(expensesBefore, "amount");
  const movements = toMovements(supplies, expenses);
  const suppliesTotal = movements.filter((row) => row.kind === "SUPPLY").reduce((sum, row) => sum + row.amount, 0);
  const expensesTotal = movements.filter((row) => row.kind === "EXPENSE").reduce((sum, row) => sum + row.amount, 0);

  return {
    filter: window.filter,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    label: window.label,
    generatedAt: new Date().toISOString(),
    period: serializedPeriod,
    active: true,
    openingBalance: period.openingBalance,
    startBalance,
    suppliesTotal,
    expensesTotal,
    remaining: startBalance - suppliesTotal - expensesTotal,
    movements,
  };
}
