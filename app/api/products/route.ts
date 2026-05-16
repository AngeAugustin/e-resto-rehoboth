import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Product from "@/models/Product";
import { isValidProductCategory } from "@/lib/product-categories";
import { parsePositiveMarketPrice } from "@/lib/product-market-price";
import { parseQuantiteStandardPack, parsePrixCasier } from "@/lib/product-pack-fields";

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
  const { name, image, category, marketSellingPrice, quantiteStandardPack, prixCasier } = body;
  const normalizedCategory = typeof category === "string" ? category.trim() : category;

  if (!name || !normalizedCategory) {
    return NextResponse.json({ error: "Nom et catégorie requis" }, { status: 400 });
  }

  const market = parsePositiveMarketPrice(marketSellingPrice);
  if (market == null) {
    return NextResponse.json(
      { error: "Prix de vente marché requis (valeur strictement positive)." },
      { status: 400 }
    );
  }

  if (!isValidProductCategory(normalizedCategory)) {
    return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
  }

  const qs = parseQuantiteStandardPack(quantiteStandardPack);
  const pc = parsePrixCasier(prixCasier);
  if (quantiteStandardPack !== undefined && quantiteStandardPack !== null && quantiteStandardPack !== "" && qs === undefined) {
    return NextResponse.json({ error: "Quantité standard pack invalide (entier ≥ 1)." }, { status: 400 });
  }
  if (prixCasier !== undefined && prixCasier !== null && prixCasier !== "" && pc === undefined) {
    return NextResponse.json({ error: "Prix casier invalide (nombre ≥ 0)." }, { status: 400 });
  }

  const existing = await Product.findOne({ name: name.trim() });
  if (existing) {
    return NextResponse.json({ error: "Un produit avec ce nom existe déjà" }, { status: 409 });
  }

  const product = await Product.create({
    name: name.trim(),
    category: normalizedCategory,
    image: image || "",
    marketSellingPrice: market,
    ...(qs !== undefined ? { quantiteStandardPack: qs } : {}),
    ...(pc !== undefined ? { prixCasier: pc } : {}),
  });

  return NextResponse.json(product, { status: 201 });
}
