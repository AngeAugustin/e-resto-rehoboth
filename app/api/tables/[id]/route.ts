import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import RestaurantTable from "@/models/RestaurantTable";
import Sale from "@/models/Sale";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const { number, name, capacity } = body;

  if (number === undefined || number === null || number === "") {
    return NextResponse.json({ error: "Le numéro de table est requis" }, { status: 400 });
  }

  const num = Number(number);
  if (Number.isNaN(num) || num < 1) {
    return NextResponse.json({ error: "Numéro de table invalide" }, { status: 400 });
  }

  const duplicate = await RestaurantTable.findOne({ number: num, _id: { $ne: id } });
  if (duplicate) {
    return NextResponse.json({ error: "Ce numéro de table est déjà utilisé" }, { status: 409 });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Le nom de la table est requis" }, { status: 400 });
  }

  const cap = Number(capacity);
  if (Number.isNaN(cap) || cap < 1) {
    return NextResponse.json({ error: "La capacité est requise (minimum 1)" }, { status: 400 });
  }

  const table = await RestaurantTable.findByIdAndUpdate(
    id,
    {
      number: num,
      name: name.trim(),
      capacity: cap,
    },
    { new: true, runValidators: true }
  );

  if (!table) {
    return NextResponse.json({ error: "Table introuvable" }, { status: 404 });
  }

  return NextResponse.json(table);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const used = await Sale.exists({ table: id });
  if (used) {
    return NextResponse.json(
      { error: "Impossible de supprimer : des ventes sont liées à cette table" },
      { status: 409 }
    );
  }

  const table = await RestaurantTable.findByIdAndDelete(id);
  if (!table) {
    return NextResponse.json({ error: "Table introuvable" }, { status: 404 });
  }

  return NextResponse.json({ message: "Table supprimée" });
}
