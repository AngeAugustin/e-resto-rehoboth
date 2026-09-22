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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const immobilisation = await Immobilisation.findOne(withExercice(exerciceId, { _id: id })).lean();
  if (!immobilisation) {
    return NextResponse.json({ error: "Immobilisation introuvable" }, { status: 404 });
  }

  const items = await Expense.find(withExercice(exerciceId, { immobilisation: new Types.ObjectId(id) }))
    .populate("category", "name")
    .populate("paymentMethod", "name")
    .populate("createdBy", "firstName lastName")
    .sort({ date: -1, createdAt: -1 })
    .lean();

  const paidAmount = items.reduce((sum, row) => sum + row.amount, 0);

  return NextResponse.json({
    immobilisation: {
      ...immobilisation,
      paidAmount,
      remainingAmount: Math.max(0, immobilisation.amount - paidAmount),
    },
    items,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const immobilisation = await Immobilisation.findOne(withExercice(exerciceId, { _id: id }));
  if (!immobilisation) {
    return NextResponse.json({ error: "Immobilisation introuvable" }, { status: 404 });
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

  const paid = await getVersedTotal(id);
  const remaining = immobilisation.amount - paid;
  if (amount > remaining) {
    return NextResponse.json(
      { error: `Le versement dépasse le reste à payer (${remaining})` },
      { status: 400 }
    );
  }

  const category = await ensureVersementCategory();
  const expense = await Expense.create({
    label,
    amount,
    date,
    category: category._id,
    paymentMethod: new Types.ObjectId(paymentMethod),
    comment: typeof body?.comment === "string" ? body.comment.trim() : undefined,
    attachmentUrl: typeof body?.attachmentUrl === "string" ? body.attachmentUrl.trim() : undefined,
    immobilisation: new Types.ObjectId(String(immobilisation._id)),
    exercice: exerciceId,
    createdBy: session!.user.id,
  });

  if (!expense.immobilisation) {
    expense.immobilisation = new Types.ObjectId(String(immobilisation._id));
    await expense.save();
  }

  await expense.populate("category", "name");
  await expense.populate("paymentMethod", "name");
  await expense.populate("createdBy", "firstName lastName");

  return NextResponse.json(expense, { status: 201 });
}
