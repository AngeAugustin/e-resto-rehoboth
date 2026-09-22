import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES } from "@/lib/roles";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import { getVersedTotal } from "@/lib/immobilisations";
import Immobilisation from "@/models/Immobilisation";
import Expense from "@/models/Expense";
import "@/models/User";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const body = await req.json();
  const immobilisation = await Immobilisation.findOne(withExercice(exerciceId, { _id: id }));
  if (!immobilisation) {
    return NextResponse.json({ error: "Immobilisation introuvable" }, { status: 404 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const amount = Number(body?.amount);
  if (!name) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  const paid = await getVersedTotal(id);
  if (amount < paid) {
    return NextResponse.json(
      { error: `Le montant ne peut pas être inférieur aux versements déjà effectués (${paid})` },
      { status: 400 }
    );
  }

  immobilisation.name = name;
  immobilisation.amount = amount;
  await immobilisation.save();
  await immobilisation.populate("createdBy", "firstName lastName");

  return NextResponse.json({
    ...immobilisation.toObject(),
    paidAmount: paid,
    remainingAmount: Math.max(0, amount - paid),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const hasVersements = await Expense.exists(withExercice(exerciceId, { immobilisation: id }));
  if (hasVersements) {
    return NextResponse.json(
      { error: "Impossible de supprimer : des versements sont liés à cette immobilisation" },
      { status: 409 }
    );
  }

  const immobilisation = await Immobilisation.findOneAndDelete(withExercice(exerciceId, { _id: id }));
  if (!immobilisation) {
    return NextResponse.json({ error: "Immobilisation introuvable" }, { status: 404 });
  }
  return NextResponse.json({ message: "Immobilisation supprimée" });
}
