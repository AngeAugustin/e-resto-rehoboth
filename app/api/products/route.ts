import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Product from "@/models/Product";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const products = await Product.find().sort({ createdAt: -1 });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();

  const body = await req.json();
  const { name, image, sellingPrice } = body;

  if (!name || sellingPrice === undefined) {
    return NextResponse.json({ error: "Nom et prix requis" }, { status: 400 });
  }

  const existing = await Product.findOne({ name: name.trim() });
  if (existing) {
    return NextResponse.json({ error: "Un produit avec ce nom existe déjà" }, { status: 409 });
  }

  const product = await Product.create({
    name: name.trim(),
    image: image || "",
    sellingPrice: Number(sellingPrice),
  });

  return NextResponse.json(product, { status: 201 });
}
