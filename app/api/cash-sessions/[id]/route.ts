import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import CashSession from "@/models/CashSession";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const action = String(body?.action ?? "update");

  const cashSession = await CashSession.findById(id);
  if (!cashSession) {
    return NextResponse.json({ error: "Session introuvable." }, { status: 404 });
  }

  if (action === "close") {
    if (cashSession.status === "CLOSED") {
      return NextResponse.json({ error: "Cette session est déjà clôturée." }, { status: 400 });
    }
    const openingFloatRecovered = body?.openingFloatRecovered === true;
    cashSession.status = "CLOSED";
    cashSession.closedAt = new Date();
    cashSession.openingFloatRecovered = openingFloatRecovered;
    await cashSession.save();
    return NextResponse.json(cashSession);
  }

  if (action === "reopen") {
    if (cashSession.status === "OPEN") {
      return NextResponse.json({ error: "Cette session est déjà ouverte." }, { status: 400 });
    }

    const active = await CashSession.findOne({ status: "OPEN", _id: { $ne: id } }).select("_id").lean();
    if (active) {
      return NextResponse.json(
        { error: "Une autre session est déjà ouverte. Clôturez-la avant de relancer celle-ci." },
        { status: 409 }
      );
    }

    cashSession.status = "OPEN";
    cashSession.closedAt = undefined;
    cashSession.openingFloatRecovered = undefined;
    await cashSession.save();
    return NextResponse.json(cashSession);
  }

  if (cashSession.status === "CLOSED") {
    return NextResponse.json({ error: "Une session clôturée ne peut pas être modifiée." }, { status: 400 });
  }

  const openingFloat = Number(body?.openingFloat);
  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    return NextResponse.json({ error: "Fond de caisse invalide." }, { status: 400 });
  }

  cashSession.openingFloat = openingFloat;
  await cashSession.save();
  return NextResponse.json(cashSession);
}
