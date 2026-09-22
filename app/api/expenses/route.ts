import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { OPERATIONS_ROLES } from "@/lib/roles";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import Expense from "@/models/Expense";
import "@/models/ExpenseCategory";
import "@/models/ExpensePaymentMethod";
import "@/models/User";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth([...OPERATIONS_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const url = req.nextUrl;
  const category = url.searchParams.get("category");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const extra: Record<string, unknown> = {};
  if (category) extra.category = category;
  if (from || to) {
    const date: Record<string, Date> = {};
    if (from) date.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      date.$lte = end;
    }
    extra.date = date;
  }
  const filter = withExercice(exerciceId, extra);

  const [items, totals] = await Promise.all([
    Expense.find(filter)
      .populate("category", "name")
      .populate("paymentMethod", "name")
      .populate("createdBy", "firstName lastName")
      .sort({ date: -1, createdAt: -1 })
      .lean(),
    Expense.aggregate<{ totalAmount: number; count: number }>([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  return NextResponse.json({
    items,
    stats: {
      totalAmount: totals[0]?.totalAmount ?? 0,
      count: totals[0]?.count ?? 0,
    },
  });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth([...OPERATIONS_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const body = await req.json();
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const amount = Number(body?.amount);
  const date = body?.date ? new Date(body.date) : null;
  const category = body?.category;
  const paymentMethod = body?.paymentMethod;

  if (!label) return NextResponse.json({ error: "Le libellé est requis" }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }
  if (!date || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }
  if (!category || !paymentMethod) {
    return NextResponse.json({ error: "Catégorie et mode de paiement requis" }, { status: 400 });
  }

  const expense = await Expense.create({
    label,
    amount,
    date,
    category: new Types.ObjectId(category),
    paymentMethod: new Types.ObjectId(paymentMethod),
    comment: typeof body?.comment === "string" ? body.comment.trim() : undefined,
    attachmentUrl: typeof body?.attachmentUrl === "string" ? body.attachmentUrl.trim() : undefined,
    exercice: exerciceId,
    createdBy: session!.user.id,
  });
  await expense.populate("category", "name");
  await expense.populate("paymentMethod", "name");
  await expense.populate("createdBy", "firstName lastName");
  return NextResponse.json(expense, { status: 201 });
}
