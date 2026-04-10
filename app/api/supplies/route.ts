import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Supply from "@/models/Supply";
import Product from "@/models/Product";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const supplies = await Supply.find()
    .populate("product", "name image sellingPrice")
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 });

  return NextResponse.json(supplies);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const body = await req.json();
  const { productId, lotSize, lotPrice, numberOfLots, marketSellingPrice } = body;

  if (!productId || !lotSize || !lotPrice || !numberOfLots || !marketSellingPrice) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const totalUnits = Number(lotSize) * Number(numberOfLots);
  const totalCost = Number(lotPrice) * Number(numberOfLots);

  const supply = new Supply({
    product: productId,
    lotSize: Number(lotSize),
    lotPrice: Number(lotPrice),
    numberOfLots: Number(numberOfLots),
    marketSellingPrice: Number(marketSellingPrice),
    totalUnits,
    totalCost,
    createdBy: session!.user.id,
  });

  await supply.save();

  // Update product selling price to the latest market price
  await Product.findByIdAndUpdate(productId, { sellingPrice: Number(marketSellingPrice) });

  await supply.populate("product", "name image sellingPrice");
  await supply.populate("createdBy", "firstName lastName");

  return NextResponse.json(supply, { status: 201 });
}
