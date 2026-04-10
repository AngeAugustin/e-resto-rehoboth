import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Sale from "@/models/Sale";
import Supply from "@/models/Supply";
import Product from "@/models/Product";
import "@/models/Waitress";
import "@/models/RestaurantTable";
import "@/models/User";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const sales = await Sale.find()
    .populate("waitress", "firstName lastName")
    .populate("table", "number name")
    .populate("items.product", "name image sellingPrice")
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 });

  return NextResponse.json(sales);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const body = await req.json();
  const { waitressId, tableId, items } = body;

  if (!waitressId || !tableId || !items || items.length === 0) {
    return NextResponse.json({ error: "Serveuse, table et produits requis" }, { status: 400 });
  }

  const pendingOnTable = await Sale.findOne({ status: "PENDING", table: tableId });
  if (pendingOnTable) {
    return NextResponse.json(
      {
        error:
          "Cette table a déjà une commande en attente. Clôturez-la ou choisissez une autre table.",
      },
      { status: 409 }
    );
  }

  // Validate stock for each item
  for (const item of items) {
    const { productId, quantity } = item;

    const supplies = await Supply.find({ product: productId });
    const totalSupplied = supplies.reduce((sum: number, s: { totalUnits: number }) => sum + s.totalUnits, 0);

    const completedSales = await Sale.find({
      "items.product": productId,
      status: "COMPLETED",
    });
    const totalSold = completedSales.reduce((sum: number, sale: { items: Array<{ product: { toString: () => string }; quantity: number }> }) => {
      const saleItem = sale.items.find((i) => i.product.toString() === productId);
      return sum + (saleItem?.quantity ?? 0);
    }, 0);

    const availableStock = totalSupplied - totalSold;
    if (quantity > availableStock) {
      const product = await Product.findById(productId);
      return NextResponse.json(
        { error: `Stock insuffisant pour ${product?.name}. Disponible: ${availableStock}` },
        { status: 400 }
      );
    }
  }

  // Build sale items with current prices
  const saleItems = await Promise.all(
    items.map(async (item: { productId: string; quantity: number }) => {
      const product = await Product.findById(item.productId);
      return {
        product: item.productId,
        quantity: item.quantity,
        unitPrice: product!.sellingPrice,
        total: product!.sellingPrice * item.quantity,
      };
    })
  );

  const totalAmount = saleItems.reduce((sum, item) => sum + item.total, 0);

  const sale = await Sale.create({
    waitress: waitressId,
    table: tableId,
    items: saleItems,
    totalAmount,
    status: "PENDING",
    createdBy: session!.user.id,
  });

  await sale.populate("waitress", "firstName lastName");
  await sale.populate("table", "number name");
  await sale.populate("items.product", "name image sellingPrice");

  return NextResponse.json(sale, { status: 201 });
}
