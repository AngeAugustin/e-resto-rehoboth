import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import CashSession from "@/models/CashSession";
import Sale from "@/models/Sale";
import Supply from "@/models/Supply";
import { barCashSessionFilter, buildCashSessionName } from "@/lib/cash-session";

export async function GET() {
  const { error } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const sessions = await CashSession.find(barCashSessionFilter(exerciceId))
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();

  const sessionsWithSummary = await Promise.all(
    sessions.map(async (s) => {
      const start = new Date(s.createdAt);
      const end = s.closedAt ? new Date(s.closedAt) : new Date();

      const createdAt = { $gte: start, $lte: end };
      const [sales, pendingCount] = await Promise.all([
        Sale.find(withExercice(exerciceId, { status: "COMPLETED", createdAt }))
          .select("totalAmount")
          .lean<Array<{ totalAmount?: number }>>(),
        Sale.countDocuments(withExercice(exerciceId, { status: "PENDING", createdAt })),
      ]);

      const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalAmount ?? 0), 0);

      const [suppliesAgg] = await Supply.aggregate<{ total: number }>([
        { $match: withExercice(exerciceId, { createdAt: { $gte: start, $lte: end } }) },
        { $group: { _id: null, total: { $sum: "$totalCost" } } },
      ]);
      const totalSupplies = Number(suppliesAgg?.total ?? 0);

      return {
        ...s,
        financialSummary: {
          totalSales,
          totalSupplies,
          completedCount: sales.length,
          pendingCount,
        },
      };
    })
  );

  return NextResponse.json(sessionsWithSummary);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const body = await req.json();

  const openingFloat = Number(body?.openingFloat);
  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    return NextResponse.json({ error: "Fond de caisse invalide." }, { status: 400 });
  }

  const active = await CashSession.findOne({ ...barCashSessionFilter(exerciceId), status: "OPEN" }).select("_id").lean();
  if (active) {
    return NextResponse.json(
      { error: "Une session est déjà ouverte. Clôturez-la avant d'en ouvrir une nouvelle." },
      { status: 409 }
    );
  }

  const now = new Date();
  const cashSession = await CashSession.create({
    name: buildCashSessionName(now, "BAR"),
    sessionDate: now,
    openingFloat,
    kind: "BAR",
    status: "OPEN",
    exercice: exerciceId,
    createdBy: session!.user.id,
  });

  return NextResponse.json(cashSession, { status: 201 });
}
