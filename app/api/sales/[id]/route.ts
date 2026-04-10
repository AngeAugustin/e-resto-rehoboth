import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Sale from "@/models/Sale";
import Supply from "@/models/Supply";
import Product from "@/models/Product";
import "@/models/Waitress";
import "@/models/RestaurantTable";
import "@/models/User";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const sale = await Sale.findById(id)
    .populate("waitress", "firstName lastName")
    .populate("table", "number name")
    .populate("items.product", "name image sellingPrice")
    .populate("createdBy", "firstName lastName")
    .lean();

  if (!sale) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  }

  return NextResponse.json(sale);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const body = await req.json();

  const sale = await Sale.findById(id);
  if (!sale) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  }

  if (sale.status === "COMPLETED") {
    return NextResponse.json({ error: "Impossible de modifier une vente clôturée" }, { status: 400 });
  }

  // Handle close/complete action
  if (body.action === "complete") {
    const { amountPaid, paymentMethod } = body;
    if (paymentMethod !== "CASH" && paymentMethod !== "MOBILE_MONEY") {
      return NextResponse.json(
        { error: "Indiquez le mode de paiement : espèces ou Mobile Money" },
        { status: 400 }
      );
    }
    if (amountPaid === undefined || amountPaid < sale.totalAmount) {
      return NextResponse.json(
        { error: "Montant payé insuffisant" },
        { status: 400 }
      );
    }

    // Re-validate stock before completing
    for (const item of sale.items) {
      const productId = item.product.toString();
      const supplies = await Supply.find({ product: productId });
      const totalSupplied = supplies.reduce((sum: number, s: { totalUnits: number }) => sum + s.totalUnits, 0);

      const completedSales = await Sale.find({
        _id: { $ne: id },
        "items.product": productId,
        status: "COMPLETED",
      });
      const totalSold = completedSales.reduce((sum: number, s: { items: Array<{ product: { toString: () => string }; quantity: number }> }) => {
        const si = s.items.find((i) => i.product.toString() === productId);
        return sum + (si?.quantity ?? 0);
      }, 0);

      if (item.quantity > totalSupplied - totalSold) {
        const product = await Product.findById(productId);
        return NextResponse.json(
          { error: `Stock insuffisant pour ${product?.name}` },
          { status: 400 }
        );
      }
    }

    sale.amountPaid = Number(amountPaid);
    sale.change = Number(amountPaid) - sale.totalAmount;
    sale.paymentMethod = paymentMethod;
    sale.status = "COMPLETED";
    await sale.save();
  } else {
    // Update pending sale (waitress, table, items)
    const { waitressId, tableId, items } = body;
    const nextTableId = (tableId ?? sale.table.toString()) as string;
    const tableConflict = await Sale.findOne({
      status: "PENDING",
      table: nextTableId,
      _id: { $ne: id },
    });
    if (tableConflict) {
      return NextResponse.json(
        {
          error:
            "Cette table a déjà une commande en attente. Clôturez-la ou choisissez une autre table.",
        },
        { status: 409 }
      );
    }

    if (waitressId) sale.waitress = waitressId;
    if (tableId) sale.table = tableId;

    if (items && items.length > 0) {
      for (const item of items as Array<{ productId: string; quantity: number }>) {
        const { productId, quantity } = item;
        const supplies = await Supply.find({ product: productId });
        const totalSupplied = supplies.reduce((sum: number, s: { totalUnits: number }) => sum + s.totalUnits, 0);

        const completedSales = await Sale.find({
          "items.product": productId,
          status: "COMPLETED",
        });
        const totalSold = completedSales.reduce(
          (sum: number, s: { items: Array<{ product: { toString: () => string }; quantity: number }> }) => {
            const saleItem = s.items.find((i) => i.product.toString() === productId);
            return sum + (saleItem?.quantity ?? 0);
          },
          0
        );

        const availableStock = totalSupplied - totalSold;
        if (quantity > availableStock) {
          const product = await Product.findById(productId);
          return NextResponse.json(
            { error: `Stock insuffisant pour ${product?.name ?? "ce produit"}. Disponible: ${availableStock}` },
            { status: 400 }
          );
        }
      }

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
      sale.items = saleItems;
      sale.totalAmount = saleItems.reduce((sum, item) => sum + item.total, 0);
    }

    await sale.save();
  }

  const fresh = await Sale.findById(id)
    .populate("waitress", "firstName lastName")
    .populate("table", "number name")
    .populate("items.product", "name image sellingPrice")
    .populate("createdBy", "firstName lastName")
    .lean();

  if (!fresh) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  }

  return NextResponse.json(fresh);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const sale = await Sale.findById(id);
  if (!sale) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  }

  if (sale.status === "COMPLETED") {
    return NextResponse.json({ error: "Impossible de supprimer une vente clôturée" }, { status: 400 });
  }

  await sale.deleteOne();
  return NextResponse.json({ message: "Vente supprimée" });
}
