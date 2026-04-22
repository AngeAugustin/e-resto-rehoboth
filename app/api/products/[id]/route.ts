import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Product from "@/models/Product";
import Supply from "@/models/Supply";
import Sale from "@/models/Sale";
import { isValidProductCategory } from "@/lib/product-categories";
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
  const { name, image, sellingPrice, category } = body;

  if (category !== undefined && !isValidProductCategory(category)) {
    return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
  }

  const product = await Product.findByIdAndUpdate(
    id,
    {
      ...(name && { name: name.trim() }),
      ...(category !== undefined && { category }),
      ...(image !== undefined && { image }),
      ...(sellingPrice !== undefined && { sellingPrice: Number(sellingPrice) }),
    },
    { new: true, runValidators: true }
  );

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
