import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Waitress from "@/models/Waitress";
import Sale from "@/models/Sale";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const { firstName, lastName, phone } = body;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Prénom et nom requis" }, { status: 400 });
  }

  const waitress = await Waitress.findByIdAndUpdate(
    id,
    {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      phone: phone != null && String(phone).trim() !== "" ? String(phone).trim() : undefined,
    },
    { new: true, runValidators: true }
  );

  if (!waitress) {
    return NextResponse.json({ error: "Serveuse introuvable" }, { status: 404 });
  }

  return NextResponse.json(waitress);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const used = await Sale.exists({ waitress: id });
  if (used) {
    return NextResponse.json(
      { error: "Impossible de supprimer : des ventes sont liées à cette serveuse" },
      { status: 409 }
    );
  }

  const waitress = await Waitress.findByIdAndDelete(id);
  if (!waitress) {
    return NextResponse.json({ error: "Serveuse introuvable" }, { status: 404 });
  }

  return NextResponse.json({ message: "Serveuse supprimée" });
}
