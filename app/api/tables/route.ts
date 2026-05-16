import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import RestaurantTable from "@/models/RestaurantTable";
import Sale from "@/models/Sale";
import { saleTableIdsFromPayload } from "@/lib/sale-tables";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const tables = await RestaurantTable.find().sort({ number: 1 }).lean();

  const pendingSales = await Sale.find({ status: "PENDING" }).select("table tables").lean();
  const tableIdToSaleId = new Map<string, string>();
  for (const s of pendingSales) {
    for (const tid of saleTableIdsFromPayload(s)) {
      if (!tableIdToSaleId.has(tid)) {
        tableIdToSaleId.set(tid, s._id.toString());
      }
    }
  }

  const enriched = tables.map((t) => ({
    ...t,
    occupiedByPendingSaleId: tableIdToSaleId.get(t._id.toString()) ?? null,
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const body = await req.json();
  const { number, name, capacity } = body;

  if (!number) {
    return NextResponse.json({ error: "Le numéro de table est requis" }, { status: 400 });
  }

  const num = Number(number);
  if (Number.isNaN(num) || num < 1) {
    return NextResponse.json({ error: "Numéro de table invalide" }, { status: 400 });
  }

  const taken = await RestaurantTable.findOne({ number: num });
  if (taken) {
    return NextResponse.json({ error: "Ce numéro de table est déjà utilisé" }, { status: 409 });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Le nom de la table est requis" }, { status: 400 });
  }

  const cap = Number(capacity);
  if (Number.isNaN(cap) || cap < 1) {
    return NextResponse.json({ error: "La capacité est requise (minimum 1)" }, { status: 400 });
  }

  const table = await RestaurantTable.create({
    number: num,
    name: name.trim(),
    capacity: cap,
  });
  return NextResponse.json(table, { status: 201 });
}
