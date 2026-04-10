import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Waitress from "@/models/Waitress";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const waitresses = await Waitress.find().sort({ firstName: 1 });
  return NextResponse.json(waitresses);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const body = await req.json();
  const { firstName, lastName, phone } = body;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Prénom et nom requis" }, { status: 400 });
  }

  const waitress = await Waitress.create({
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    phone: phone != null && String(phone).trim() !== "" ? String(phone).trim() : undefined,
  });
  return NextResponse.json(waitress, { status: 201 });
}
