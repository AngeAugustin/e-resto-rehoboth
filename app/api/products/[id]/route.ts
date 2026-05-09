import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import Sale from "@/models/Sale";
import { isValidProductCategory } from "@/lib/product-categories";
import { parsePositiveMarketPrice } from "@/lib/product-market-price";
import { parseQuantiteStandardPack, parsePrixCasier } from "@/lib/product-pack-fields";
import "@/models/User";
import "@/models/Waitress";
import "@/models/RestaurantTable";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const product = await Product.findById(id);
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  // Fetch supply history
  const supplies = await Supply.find({ product: id })
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 });

  // Fetch sales that include this product
  const sales = await Sale.find({ "items.product": id, status: "COMPLETED" })
    .populate("waitress", "firstName lastName")
    .populate("tables", "number name")
    .populate("table", "number name")
    .sort({ createdAt: -1 })
    .limit(50);

  // Calculate stock: total supplied - total sold
  const totalSupplied = supplies.reduce((sum, s) => sum + s.totalUnits, 0);

  const totalSold = sales.reduce((sum, sale) => {
    const item = sale.items.find((i) => i.product.toString() === id);
    return sum + (item?.quantity ?? 0);
  }, 0);

  const stock = totalSupplied - totalSold;

  return NextResponse.json({
    product: { ...product.toObject(), stock },
    supplies,
    sales,
    stock,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const { name, image, category, marketSellingPrice, isActive, quantiteStandardPack, prixCasier } = body;

  if (category !== undefined && !isValidProductCategory(category)) {
    return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive doit être un booléen." }, { status: 400 });
  }

  const existing = await Product.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const updateDoc: Record<string, unknown> = {};
  const unsetDoc: Record<string, 1> = {};
  if (name) updateDoc.name = name.trim();
  if (category !== undefined) updateDoc.category = category;
  if (image !== undefined) updateDoc.image = image;
  if (isActive !== undefined) updateDoc.isActive = isActive;

  if (marketSellingPrice !== undefined) {
    const m = parsePositiveMarketPrice(marketSellingPrice);
    if (m == null) {
      return NextResponse.json({ error: "Prix de vente marché invalide." }, { status: 400 });
    }
    updateDoc.marketSellingPrice = m;
  }

  if (quantiteStandardPack !== undefined) {
    if (quantiteStandardPack === null || quantiteStandardPack === "") {
      unsetDoc.quantiteStandardPack = 1;
    } else {
      const qs = parseQuantiteStandardPack(quantiteStandardPack);
      if (qs === undefined) {
        return NextResponse.json({ error: "Quantité standard pack invalide (entier ≥ 1)." }, { status: 400 });
      }
      updateDoc.quantiteStandardPack = qs;
    }
  }

  if (prixCasier !== undefined) {
    if (prixCasier === null || prixCasier === "") {
      unsetDoc.prixCasier = 1;
    } else {
      const pc = parsePrixCasier(prixCasier);
      if (pc === undefined) {
        return NextResponse.json({ error: "Prix casier invalide (nombre ≥ 0)." }, { status: 400 });
      }
      updateDoc.prixCasier = pc;
    }
  }

  const hasSet = Object.keys(updateDoc).length > 0;
  const hasUnset = Object.keys(unsetDoc).length > 0;
  const mongoUpdate: Record<string, unknown> =
    hasSet && hasUnset
      ? { $set: updateDoc, $unset: unsetDoc }
      : hasUnset
        ? { $unset: unsetDoc }
        : updateDoc;

  const product = await Product.findByIdAndUpdate(id, mongoUpdate, { new: true, runValidators: true });

  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  return NextResponse.json({ message: "Produit supprimé" });
}
