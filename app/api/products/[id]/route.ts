import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import Sale from "@/models/Sale";
import { isValidProductCategory } from "@/lib/product-categories";
import { marketPriceAboveCatalogError, parsePriceBodyField, resolveCatalogPriceForImport } from "@/lib/product-market-price";
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
  const { name, image, sellingPrice, category, defaultMarketSellingPrice, isActive } = body;

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
  if (name) updateDoc.name = name.trim();
  if (category !== undefined) updateDoc.category = category;
  if (image !== undefined) updateDoc.image = image;
  if (isActive !== undefined) updateDoc.isActive = isActive;

  const existingMarket = parsePriceBodyField(existing.defaultMarketSellingPrice ?? null);

  if (defaultMarketSellingPrice !== undefined || sellingPrice !== undefined) {
    const m =
      defaultMarketSellingPrice !== undefined ? parsePriceBodyField(defaultMarketSellingPrice) : existingMarket;
    const s =
      sellingPrice !== undefined ? parsePriceBodyField(sellingPrice) : parsePriceBodyField(existing.sellingPrice);

    if (defaultMarketSellingPrice !== undefined && (m == null || !Number.isFinite(m) || m <= 0)) {
      return NextResponse.json({ error: "Prix de vente marché invalide." }, { status: 400 });
    }

    const resolved = resolveCatalogPriceForImport(s, m);
    if (resolved) {
      updateDoc.sellingPrice = resolved.sellingPrice;
      if (defaultMarketSellingPrice !== undefined) {
        updateDoc.defaultMarketSellingPrice = resolved.defaultMarketSellingPrice;
      }
    } else if (s != null && m != null && Number.isFinite(m) && m > 0) {
      const err = marketPriceAboveCatalogError(s, m);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }
      updateDoc.sellingPrice = s;
      if (defaultMarketSellingPrice !== undefined && m != null) {
        updateDoc.defaultMarketSellingPrice = m;
      }
    } else if (s != null && (m == null || !Number.isFinite(m) || m <= 0)) {
      updateDoc.sellingPrice = s;
    } else {
      return NextResponse.json(
        { error: "Prix SOBEBRA ou prix de vente marché invalide." },
        { status: 400 }
      );
    }
  }

  const product = await Product.findByIdAndUpdate(id, updateDoc, { new: true, runValidators: true });

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
