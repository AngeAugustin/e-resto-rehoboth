import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { OPERATIONS_ROLES } from "@/lib/roles";
import { getActiveExerciceId } from "@/lib/exercice";
import CashSession from "@/models/CashSession";
import { kitchenCashSessionFilter } from "@/lib/cash-session";

export async function GET() {
  const { error } = await requireAuth([...OPERATIONS_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const latest = await CashSession.findOne(kitchenCashSessionFilter(exerciceId))
    .sort({ createdAt: -1 })
    .select("status name createdAt")
    .lean<{
      _id: unknown;
      status: "OPEN" | "CLOSED";
      name: string;
      createdAt: Date;
    } | null>();

  if (!latest) {
    return NextResponse.json({ hasSession: false, canSell: false });
  }

  return NextResponse.json({
    hasSession: true,
    canSell: latest.status === "OPEN",
    latest: {
      status: latest.status,
      name: latest.name,
      createdAt: latest.createdAt,
    },
  });
}
