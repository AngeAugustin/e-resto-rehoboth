import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES } from "@/lib/roles";
import { isVersementCategoryName } from "@/lib/versement-category";
import ExpenseCategory from "@/models/ExpenseCategory";
import Expense from "@/models/Expense";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const current = await ExpenseCategory.findById(id);
  if (!current) return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
  if (isVersementCategoryName(current.name)) {
    return NextResponse.json(
      { error: "La catégorie VERSEMENT est réservée aux immobilisations" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Le nom de la catégorie est requis" }, { status: 400 });
  if (isVersementCategoryName(name)) {
    return NextResponse.json(
      { error: "Le nom VERSEMENT est réservé au système" },
      { status: 403 }
    );
  }

  const duplicate = await ExpenseCategory.findOne({ name, _id: { $ne: id } });
  if (duplicate) {
    return NextResponse.json({ error: "Cette catégorie existe déjà" }, { status: 409 });
  }

  const category = await ExpenseCategory.findByIdAndUpdate(id, { name }, { new: true, runValidators: true });
  if (!category) return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
  return NextResponse.json(category);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const current = await ExpenseCategory.findById(id);
  if (!current) return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
  if (isVersementCategoryName(current.name)) {
    return NextResponse.json(
      { error: "La catégorie VERSEMENT est réservée aux immobilisations" },
      { status: 403 }
    );
  }

  const used = await Expense.exists({ category: id });
  if (used) {
    return NextResponse.json(
      { error: "Impossible de supprimer : des dépenses sont liées à cette catégorie" },
      { status: 409 }
    );
  }

  const category = await ExpenseCategory.findByIdAndDelete(id);
  if (!category) return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
  return NextResponse.json({ message: "Catégorie supprimée" });
}
