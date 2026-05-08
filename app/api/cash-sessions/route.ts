import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import CashSession from "@/models/CashSession";
import Sale from "@/models/Sale";
import { buildCashSessionName } from "@/lib/cash-session";

export async function GET() {
  const { error } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const sessions = await CashSession.find()
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();

  const sessionsWithSummary = await Promise.all(
    sessions.map(async (s) => {
      const start = new Date(s.createdAt);
      const end = s.closedAt ? new Date(s.closedAt) : new Date();

      const sales = await Sale.find({
        status: "COMPLETED",
        createdAt: { $gte: start, $lte: end },
      })
        .select("totalAmount paymentMethod")
        .lean<Array<{ totalAmount?: number; paymentMethod?: "CASH" | "MOBILE_MONEY" }>>();

      const salesCount = sales.length;
      const revenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount ?? 0), 0);
      const cashRevenue = sales.reduce(
        (sum, sale) => sum + (sale.paymentMethod === "CASH" ? Number(sale.totalAmount ?? 0) : 0),
        0
      );
      const mobileMoneyRevenue = sales.reduce(
        (sum, sale) => sum + (sale.paymentMethod === "MOBILE_MONEY" ? Number(sale.totalAmount ?? 0) : 0),
        0
      );

      return {
        ...s,
        financialSummary: {
          salesCount,
          revenue,
          cashRevenue,
          mobileMoneyRevenue,
          expectedCashOnHand: Number(s.openingFloat ?? 0) + cashRevenue,
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
  const body = await req.json();

  const openingFloat = Number(body?.openingFloat);
  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    return NextResponse.json({ error: "Fond de caisse invalide." }, { status: 400 });
  }

  const active = await CashSession.findOne({ status: "OPEN" }).select("_id").lean();
  if (active) {
    return NextResponse.json(
      { error: "Une session est déjà ouverte. Clôturez-la avant d'en ouvrir une nouvelle." },
      { status: 409 }
    );
  }

  const now = new Date();
  const cashSession = await CashSession.create({
    name: buildCashSessionName(now),
    sessionDate: now,
    openingFloat,
    status: "OPEN",
    createdBy: session!.user.id,
  });

  return NextResponse.json(cashSession, { status: 201 });
}
