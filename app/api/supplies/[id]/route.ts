import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Supply from "@/models/Supply";
import Product from "@/models/Product";

async function syncProductSellingPriceFromLatestSupply(productId: string) {
  const latest = await Supply.findOne({ product: productId }).sort({ createdAt: -1 }).lean();
  if (latest) {
    await Product.findByIdAndUpdate(productId, { sellingPrice: latest.marketSellingPrice });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const { productId, lotSize, lotPrice, numberOfLots, marketSellingPrice } = body;

  if (!productId || lotSize === undefined || lotPrice === undefined || numberOfLots === undefined || marketSellingPrice === undefined) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

  const supply = await Supply.findById(id);
  if (!supply) {
    return NextResponse.json({ error: "Approvisionnement introuvable" }, { status: 404 });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const oldProductId = supply.product.toString();

  supply.product = productId;
  supply.lotSize = Number(lotSize);
  supply.lotPrice = Number(lotPrice);
  supply.numberOfLots = Number(numberOfLots);
  supply.marketSellingPrice = Number(marketSellingPrice);
  await supply.save();

  const newProductId = supply.product.toString();
  if (oldProductId !== newProductId) {
    await syncProductSellingPriceFromLatestSupply(oldProductId);
  }
  await syncProductSellingPriceFromLatestSupply(newProductId);

  await supply.populate("product", "name image sellingPrice");
  await supply.populate("createdBy", "firstName lastName");

  return NextResponse.json(supply);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const supply = await Supply.findById(id);
  if (!supply) {
    return NextResponse.json({ error: "Approvisionnement introuvable" }, { status: 404 });
  }

  const productId = supply.product.toString();
  await Supply.findByIdAndDelete(id);
  await syncProductSellingPriceFromLatestSupply(productId);

  return NextResponse.json({ message: "Approvisionnement supprimé" });
}
