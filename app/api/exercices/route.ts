import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES, OPERATIONS_ROLES } from "@/lib/roles";
import Exercice from "@/models/Exercice";
import "@/models/User";
import {
  ensureActiveExercice,
  getActiveExercice,
  openNewExercice,
  serializeExercice,
} from "@/lib/exercice";
import { parseAccountingInstant } from "@/lib/accounting-window";

export async function GET() {
  const { error } = await requireAuth([...OPERATIONS_ROLES]);
  if (error) return error;

  await connectDB();
  const active = await ensureActiveExercice();
  const items = await Exercice.find()
    .populate("createdBy", "firstName lastName")
    .sort({ startedAt: -1 })
    .lean();

  return NextResponse.json({
    active: serializeExercice(active),
    items: items.map((row) => serializeExercice(row as typeof active)),
  });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  await getActiveExercice();

  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Le nom de l’exercice est requis" }, { status: 400 });
  }

  const openingBalance = Number(body?.openingBalance ?? 0);
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    return NextResponse.json({ error: "Solde d’ouverture invalide" }, { status: 400 });
  }

  let startedAt: Date;
  try {
    startedAt = parseAccountingInstant(typeof body?.startedAt === "string" ? body.startedAt : null);
  } catch {
    startedAt = new Date();
  }

  try {
    const created = await openNewExercice({
      name,
      startedAt,
      openingBalance,
      note: typeof body?.note === "string" ? body.note : undefined,
      createdBy: session!.user.id,
    });
    return NextResponse.json(serializeExercice(created), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Impossible de créer l’exercice" },
      { status: 400 }
    );
  }
}
