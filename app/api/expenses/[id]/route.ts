import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES, OPERATIONS_ROLES } from "@/lib/roles";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import Expense from "@/models/Expense";
import "@/models/ExpenseCategory";
import "@/models/ExpensePaymentMethod";
import "@/models/User";

async function loadPopulated(id: string, exerciceId: Types.ObjectId) {
  return Expense.findOne(withExercice(exerciceId, { _id: id }))
    .populate("category", "name")
    .populate("paymentMethod", "name")
    .populate("createdBy", "firstName lastName")
    .lean();
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...OPERATIONS_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const body = await req.json();
  const expense = await Expense.findOne(withExercice(exerciceId, { _id: id }));
  if (!expense) return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });

  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const amount = Number(body?.amount);
  const date = body?.date ? new Date(body.date) : null;
  if (!label) return NextResponse.json({ error: "Le libellé est requis" }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }
  if (!date || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }
  if (!body?.category || !body?.paymentMethod) {
    return NextResponse.json({ error: "Catégorie et mode de paiement requis" }, { status: 400 });
  }

  expense.label = label;
  expense.amount = amount;
  expense.date = date;
  expense.category = new Types.ObjectId(body.category);
  expense.paymentMethod = new Types.ObjectId(body.paymentMethod);
  expense.comment = typeof body?.comment === "string" ? body.comment.trim() : undefined;
  expense.attachmentUrl = typeof body?.attachmentUrl === "string" ? body.attachmentUrl.trim() : undefined;
  await expense.save();

  const fresh = await loadPopulated(id, exerciceId);
  return NextResponse.json(fresh);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const expense = await Expense.findOneAndDelete(withExercice(exerciceId, { _id: id }));
  if (!expense) return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
  return NextResponse.json({ message: "Dépense supprimée" });
}
