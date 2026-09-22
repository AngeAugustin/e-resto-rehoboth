import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES } from "@/lib/roles";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import { parsePayrollBonuses, payrollBonusTotal } from "@/lib/payroll";
import { resolvePayrollBaseSalary } from "@/lib/payroll-server";
import Payroll from "@/models/Payroll";
import User from "@/models/User";
import "@/models/Waitress";
import "@/models/KitchenWaitress";
import "@/models/Cook";
import "@/models/JobTitle";

const TYPES = new Set(["WAITRESS", "KITCHEN_WAITRESS", "COOK", "MANAGER"]);

export async function GET(req: NextRequest) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const url = req.nextUrl;
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const extra: Record<string, unknown> = {};
  if (type && TYPES.has(type)) extra.beneficiaryType = type;
  else extra.beneficiaryType = { $in: [...TYPES] };
  if (from || to) {
    const paidAt: Record<string, Date> = {};
    if (from) paidAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      paidAt.$lte = end;
    }
    extra.paidAt = paidAt;
  }
  const filter = withExercice(exerciceId, extra);

  const [items, totals] = await Promise.all([
    Payroll.find(filter)
      .populate("waitress", "firstName lastName")
      .populate("kitchenWaitress", "firstName lastName")
      .populate("cook", "firstName lastName")
      .populate("user", "firstName lastName role")
      .populate("jobTitle", "name salary")
      .populate("createdBy", "firstName lastName signatureUrl")
      .sort({ paidAt: -1, createdAt: -1 })
      .lean(),
    Payroll.aggregate<{ totalAmount: number; count: number }>([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  return NextResponse.json({
    items,
    stats: {
      totalAmount: totals[0]?.totalAmount ?? 0,
      count: totals[0]?.count ?? 0,
    },
  });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const body = await req.json();
  const beneficiaryType = body?.beneficiaryType;
  if (!TYPES.has(beneficiaryType)) {
    return NextResponse.json({ error: "Type de personnel invalide" }, { status: 400 });
  }

  let bonus: { bonuses: { name: string; amount: number }[] };
  try {
    bonus = parsePayrollBonuses(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bonus invalide" }, { status: 400 });
  }

  let baseSalary: number;
  try {
    baseSalary = await resolvePayrollBaseSalary(beneficiaryType, body?.jobTitle);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Salaire introuvable" }, { status: 400 });
  }

  const bonusTotal = payrollBonusTotal(bonus.bonuses);
  const amount = baseSalary + bonusTotal;

  const periodStart = body?.periodStart ? new Date(body.periodStart) : null;
  const periodEnd = body?.periodEnd ? new Date(body.periodEnd) : null;
  const paidAt = body?.paidAt ? new Date(body.paidAt) : null;
  if (!periodStart || Number.isNaN(periodStart.getTime()) || !periodEnd || Number.isNaN(periodEnd.getTime())) {
    return NextResponse.json({ error: "Période invalide" }, { status: 400 });
  }
  if (!paidAt || Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: "Date de paiement invalide" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    beneficiaryType,
    baseSalary,
    bonuses: bonus.bonuses,
    bonusName: bonus.bonuses[0]?.name,
    bonusAmount: bonusTotal,
    amount,
    periodStart,
    periodEnd,
    paidAt,
    comment: typeof body?.comment === "string" ? body.comment.trim() : undefined,
    attachmentUrl: typeof body?.attachmentUrl === "string" ? body.attachmentUrl.trim() : undefined,
    jobTitle: body?.jobTitle || undefined,
    exercice: exerciceId,
    createdBy: session!.user.id,
    isPaid: false,
  };

  const me = await User.findById(session!.user.id).select("firstName lastName signatureUrl").lean();
  if (me) {
    payload.promoter = {
      user: session!.user.id,
      firstName: me.firstName,
      lastName: me.lastName,
      signatureUrl: me.signatureUrl || undefined,
    };
  }

  if (beneficiaryType === "WAITRESS") payload.waitress = new Types.ObjectId(body.personId);
  else if (beneficiaryType === "KITCHEN_WAITRESS") payload.kitchenWaitress = new Types.ObjectId(body.personId);
  else if (beneficiaryType === "COOK") payload.cook = new Types.ObjectId(body.personId);
  else payload.user = new Types.ObjectId(body.personId);

  if (!body?.personId) {
    return NextResponse.json({ error: "Le bénéficiaire est requis" }, { status: 400 });
  }

  const payroll = await Payroll.create(payload);
  await payroll.populate("waitress", "firstName lastName");
  await payroll.populate("kitchenWaitress", "firstName lastName");
  await payroll.populate("cook", "firstName lastName");
  await payroll.populate("user", "firstName lastName role");
  await payroll.populate("jobTitle", "name salary");
  await payroll.populate("createdBy", "firstName lastName signatureUrl");
  return NextResponse.json(payroll, { status: 201 });
}
