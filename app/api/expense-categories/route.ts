import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES, OPERATIONS_ROLES } from "@/lib/roles";
import { isVersementCategoryName } from "@/lib/versement-category";
import ExpenseCategory from "@/models/ExpenseCategory";

export async function GET() {
  const { error } = await requireAuth([...OPERATIONS_ROLES]);
  if (error) return error;

  await connectDB();
  const categories = await ExpenseCategory.find().sort({ name: 1 }).lean();
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Le nom de la catégorie est requis" }, { status: 400 });
  if (isVersementCategoryName(name)) {
    return NextResponse.json(
      { error: "Le nom VERSEMENT est réservé au système" },
      { status: 403 }
    );
  }

  const existing = await ExpenseCategory.findOne({ name });
  if (existing) {
    return NextResponse.json({ error: "Cette catégorie existe déjà" }, { status: 409 });
  }

  const category = await ExpenseCategory.create({ name });
  return NextResponse.json(category, { status: 201 });
}
