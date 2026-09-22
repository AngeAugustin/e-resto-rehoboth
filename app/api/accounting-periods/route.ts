import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { OPERATIONS_ROLES } from "@/lib/roles";
import "@/models/User";
import { getAccountingOpening, setAccountingOpening } from "@/lib/accounting";
import { parseAccountingInstant } from "@/lib/accounting-window";

export async function GET() {
  const { error } = await requireAuth([...OPERATIONS_ROLES]);
  if (error) return error;

  await connectDB();
  const opening = await getAccountingOpening();
  if (!opening) return NextResponse.json(null);

  return NextResponse.json({
    _id: String(opening._id),
    openingBalance: opening.openingBalance,
    openedAt: new Date(opening.openedAt).toISOString(),
    note: opening.note,
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth([...OPERATIONS_ROLES]);
  if (error) return error;

  await connectDB();
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

  return NextResponse.json(
    {
      _id: updated._id,
      openingBalance: updated.openingBalance,
      openedAt: updated.startedAt,
      note: updated.note,
    },
    { status: 201 }
  );
}
