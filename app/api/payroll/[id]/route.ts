import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES } from "@/lib/roles";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import { parsePayrollBonuses, payrollBonusTotal } from "@/lib/payroll";
import { resolvePayrollBaseSalary } from "@/lib/payroll-server";
import Payroll from "@/models/Payroll";
import "@/models/Waitress";
import "@/models/KitchenWaitress";
import "@/models/Cook";
import "@/models/User";
import "@/models/JobTitle";

const TYPES = new Set(["WAITRESS", "KITCHEN_WAITRESS", "COOK", "MANAGER"]);

async function loadPopulated(id: string, exerciceId: Types.ObjectId) {
  return Payroll.findOne(withExercice(exerciceId, { _id: id }))
    .populate("waitress", "firstName lastName")
    .populate("kitchenWaitress", "firstName lastName")
    .populate("cook", "firstName lastName")
    .populate("user", "firstName lastName role")
    .populate("jobTitle", "name salary")
    .populate("createdBy", "firstName lastName signatureUrl")
    .lean();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const payroll = await loadPopulated(id, exerciceId);
  if (!payroll) return NextResponse.json({ error: "Fiche de paie introuvable" }, { status: 404 });
  return NextResponse.json(payroll);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const body = await req.json();
  const payroll = await Payroll.findOne(withExercice(exerciceId, { _id: id }));
  if (!payroll) return NextResponse.json({ error: "Fiche de paie introuvable" }, { status: 404 });

  if (body?.action === "mark_paid") {
    if (payroll.isPaid) {
      return NextResponse.json({ error: "Cette fiche est déjà marquée comme payée" }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Fiche de paie introuvable" }, { status: 404 });
    }

    const updateResult = await Payroll.collection.updateOne(
      { _id: new Types.ObjectId(id), exercice: exerciceId },
      { $set: { isPaid: true } }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Fiche de paie introuvable" }, { status: 404 });
    }

    const fresh = await loadPopulated(id, exerciceId);
    if (!fresh) return NextResponse.json({ error: "Fiche de paie introuvable" }, { status: 404 });
    return NextResponse.json({ ...fresh, isPaid: true });
  }

  if (payroll.isPaid) {
    return NextResponse.json(
      { error: "Cette fiche est payée et ne peut plus être modifiée" },
      { status: 400 }
    );
  }

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
  if (!body?.personId) {
    return NextResponse.json({ error: "Le bénéficiaire est requis" }, { status: 400 });
  }

  payroll.beneficiaryType = beneficiaryType;
  payroll.baseSalary = baseSalary;
  payroll.bonuses = bonus.bonuses;
  payroll.bonusName = bonus.bonuses[0]?.name;
  payroll.bonusAmount = bonusTotal;
  payroll.amount = amount;
  payroll.periodStart = periodStart;
  payroll.periodEnd = periodEnd;
  payroll.paidAt = paidAt;
  payroll.comment = typeof body?.comment === "string" ? body.comment.trim() : undefined;
  payroll.attachmentUrl = typeof body?.attachmentUrl === "string" ? body.attachmentUrl.trim() : undefined;
  payroll.jobTitle = body?.jobTitle || undefined;
  payroll.waitress = undefined;
  payroll.kitchenWaitress = undefined;
  payroll.cook = undefined;
  payroll.user = undefined;
  if (beneficiaryType === "WAITRESS") payroll.waitress = new Types.ObjectId(body.personId);
  else if (beneficiaryType === "KITCHEN_WAITRESS") payroll.kitchenWaitress = new Types.ObjectId(body.personId);
  else if (beneficiaryType === "COOK") payroll.cook = new Types.ObjectId(body.personId);
  else payroll.user = new Types.ObjectId(body.personId);

  await payroll.save();
  const fresh = await loadPopulated(id, exerciceId);
  return NextResponse.json(fresh);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const payroll = await Payroll.findOneAndDelete(withExercice(exerciceId, { _id: id }));
  if (!payroll) return NextResponse.json({ error: "Fiche de paie introuvable" }, { status: 404 });
  return NextResponse.json({ message: "Fiche de paie supprimée" });
}
