import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES } from "@/lib/roles";
import "@/models/User";
import { getActiveExercice, updateActiveExerciceOpening } from "@/lib/exercice";
import { setAccountingOpening } from "@/lib/accounting";
import { parseAccountingInstant } from "@/lib/accounting-window";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const active = await getActiveExercice();
  if (String(active._id) !== id) {
    return NextResponse.json({ error: "Seul l’exercice actif peut être modifié ici" }, { status: 404 });
  }

  const body = await req.json();
  const openingBalance = Number(body?.openingBalance);
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    return NextResponse.json({ error: "Solde d’ouverture invalide" }, { status: 400 });
  }

  let openedAt: Date | undefined;
  try {
    if (typeof body?.openedAt === "string" && body.openedAt) {
      openedAt = parseAccountingInstant(body.openedAt);
    }
  } catch {
    return NextResponse.json({ error: "Date d’ouverture invalide" }, { status: 400 });
  }

  const updated = await setAccountingOpening({
    openingBalance,
    openedAt,
    note: typeof body?.note === "string" ? body.note.trim() : undefined,
  });

  return NextResponse.json({
    _id: updated._id,
    openingBalance: updated.openingBalance,
    openedAt: updated.startedAt,
    note: updated.note,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const active = await getActiveExercice();
  if (String(active._id) !== id) {
    return NextResponse.json({ error: "Solde d’ouverture introuvable" }, { status: 404 });
  }

  const updated = await updateActiveExerciceOpening({ openingBalance: 0, note: "" });
  return NextResponse.json({
    message: "Solde d’ouverture réinitialisé",
    _id: String(updated._id),
    openingBalance: updated.openingBalance,
  });
}
