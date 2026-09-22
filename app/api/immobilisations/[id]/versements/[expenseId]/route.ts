import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES } from "@/lib/roles";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import { getVersedTotal } from "@/lib/immobilisations";
import { ensureVersementCategory } from "@/lib/ensure-versement-category";
import Immobilisation from "@/models/Immobilisation";
import Expense from "@/models/Expense";
import "@/models/ExpenseCategory";
import "@/models/ExpensePaymentMethod";
import "@/models/User";

async function loadPopulated(expenseId: string, exerciceId: Types.ObjectId) {
  return Expense.findOne(withExercice(exerciceId, { _id: expenseId }))
    .populate("category", "name")
    .populate("paymentMethod", "name")
    .populate("createdBy", "firstName lastName")
    .lean();
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id, expenseId } = await params;
  const immobilisation = await Immobilisation.findOne(withExercice(exerciceId, { _id: id }));
  if (!immobilisation) {
    return NextResponse.json({ error: "Immobilisation introuvable" }, { status: 404 });
  }

  const expense = await Expense.findOne(
    withExercice(exerciceId, { _id: expenseId, immobilisation: id })
  );
  if (!expense) {
    return NextResponse.json({ error: "Versement introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const amount = Number(body?.amount);
  const date = body?.date ? new Date(body.date) : null;
  const paymentMethod = body?.paymentMethod;

  if (!label) return NextResponse.json({ error: "Le libellé est requis" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }
  if (!date || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }
  if (!paymentMethod) {
    return NextResponse.json({ error: "Mode de paiement requis" }, { status: 400 });
  }

  const paidOthers = (await getVersedTotal(id)) - expense.amount;
  const remaining = immobilisation.amount - paidOthers;
  if (amount > remaining) {
    return NextResponse.json(
      { error: `Le versement dépasse le reste à payer (${remaining})` },
      { status: 400 }
    );
  }

  const category = await ensureVersementCategory();
  expense.label = label;
  expense.amount = amount;
  expense.date = date;
  expense.category = category._id as Types.ObjectId;
  expense.paymentMethod = new Types.ObjectId(paymentMethod);
  expense.comment = typeof body?.comment === "string" ? body.comment.trim() : undefined;
  if (typeof body?.attachmentUrl === "string") {
    expense.attachmentUrl = body.attachmentUrl.trim() || undefined;
  }
  await expense.save();

  const fresh = await loadPopulated(expenseId, exerciceId);
  return NextResponse.json(fresh);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id, expenseId } = await params;
  const expense = await Expense.findOneAndDelete(
    withExercice(exerciceId, { _id: expenseId, immobilisation: id })
  );
  if (!expense) {
    return NextResponse.json({ error: "Versement introuvable" }, { status: 404 });
  }
  return NextResponse.json({ message: "Versement supprimé" });
}
