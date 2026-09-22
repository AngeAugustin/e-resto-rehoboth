import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES } from "@/lib/roles";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import { getVersedTotalsByImmobilisation } from "@/lib/immobilisations";
import Immobilisation from "@/models/Immobilisation";
import "@/models/User";

export async function GET() {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const items = await Immobilisation.find(withExercice(exerciceId))
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();

  const totals = await getVersedTotalsByImmobilisation(items.map((row) => row._id));
  const enriched = items.map((row) => {
    const paid = totals.get(String(row._id)) ?? 0;
    return {
      ...row,
      paidAmount: paid,
      remainingAmount: Math.max(0, row.amount - paid),
    };
  });

  const stats = enriched.reduce(
    (acc, row) => {
      acc.totalAmount += row.amount;
      acc.totalPaid += row.paidAmount;
      acc.totalRemaining += row.remainingAmount;
      return acc;
    },
    { totalAmount: 0, totalPaid: 0, totalRemaining: 0, count: enriched.length }
  );

  return NextResponse.json({ items: enriched, stats });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const amount = Number(body?.amount);

  if (!name) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  const immobilisation = await Immobilisation.create({
    name,
    amount,
    exercice: exerciceId,
    createdBy: session!.user.id,
  });
  await immobilisation.populate("createdBy", "firstName lastName");

  return NextResponse.json(
    {
      ...immobilisation.toObject(),
      paidAmount: 0,
      remainingAmount: amount,
    },
    { status: 201 }
  );
}
