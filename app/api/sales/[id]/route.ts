import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Sale from "@/models/Sale";
import Supply from "@/models/Supply";
import Product from "@/models/Product";
import { getProductStock } from "@/lib/inventory";
import { resolveSaleLinePricing } from "@/lib/sale-pricing";
import { notifyLowStockAfterCompletedSale } from "@/lib/stock-alerts";
import {
  parseTableIdsFromRequestBody,
  pendingSaleUsesAnyTableFilter,
} from "@/lib/sale-tables-server";
import { Types } from "mongoose";
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
    .populate("tables", "number name")
    .populate("table", "number name")
    .populate("items.product", "name image marketSellingPrice")
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

  if (sale.status !== "PENDING") {
    return NextResponse.json({ error: "Seules les ventes en attente peuvent être modifiées" }, { status: 400 });
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

    const paidNum = Number(amountPaid);
    const changeDue = paidNum - sale.totalAmount;
    if (changeDue > 0 && typeof body.changeReturnedAck !== "boolean") {
      return NextResponse.json(
        {
          error:
            "Une monnaie est à rendre : indiquez si vous l’avez déjà remise au client ou non avant de clôturer la vente.",
        },
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

    sale.amountPaid = paidNum;
    sale.change = changeDue;
    sale.paymentMethod = paymentMethod;
    if (changeDue > 0) {
      sale.changeReturnedAck = body.changeReturnedAck === true;
    } else {
      sale.changeReturnedAck = undefined;
    }
    sale.status = "COMPLETED";
    await sale.save();

    const saleId = sale._id.toString();
    const lowStockLines = await Promise.all(
      sale.items.map(async (item) => {
        const productId = item.product.toString();
        const previousStock = await getProductStock(productId, { excludeSaleId: saleId });
        const newStock = previousStock - item.quantity;
        const productDoc = await Product.findById(productId)
          .select("name category image")
          .lean();
        return {
          productName: productDoc?.name ?? "Produit",
          productCategory: productDoc?.category,
          productImage: productDoc?.image,
          stockBeforeSale: previousStock,
          stockAfterSale: newStock,
          quantitySold: item.quantity,
        };
      })
    );
    await notifyLowStockAfterCompletedSale({ saleId, lines: lowStockLines });
  } else {
    // Update pending sale (waitress, tables, items)
    const { waitressId, items } = body;
    const bodyTouchesTables =
      Object.prototype.hasOwnProperty.call(body, "tableIds") ||
      Object.prototype.hasOwnProperty.call(body, "tableId");

    if (bodyTouchesTables) {
      const parsed = parseTableIdsFromRequestBody(body);
      if (!parsed?.length) {
        return NextResponse.json({ error: "Au moins une table est requise" }, { status: 400 });
      }
      const tableConflict = await Sale.findOne(pendingSaleUsesAnyTableFilter(parsed, id));
      if (tableConflict) {
        return NextResponse.json(
          {
            error:
              "Une ou plusieurs tables ont déjà une commande en attente. Clôturez-la ou modifiez la sélection.",
          },
          { status: 409 }
        );
      }
      sale.tables = parsed.map((tid) => new Types.ObjectId(tid));
      sale.set("table", undefined);
    }

    if (waitressId) sale.waitress = waitressId;

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
          const { unitPrice, unitCost } = await resolveSaleLinePricing(item.productId);
          return {
            product: item.productId,
            quantity: item.quantity,
            unitPrice,
            unitCost,
            total: unitPrice * item.quantity,
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
    .populate("tables", "number name")
    .populate("table", "number name")
    .populate("items.product", "name image marketSellingPrice")
    .populate("createdBy", "firstName lastName")
    .lean();

  if (!fresh) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  }

  return NextResponse.json(fresh);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const sale = await Sale.findById(id);
  if (!sale) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  }

  if (sale.status === "COMPLETED") {
    return NextResponse.json({ error: "Impossible d'annuler une vente clôturée" }, { status: 400 });
  }
  if (sale.status === "CANCELLED") {
    return NextResponse.json({ message: "Commande déjà annulée" });
  }

  sale.status = "CANCELLED";
  await sale.save();
  return NextResponse.json({ message: "Commande annulée", sale });
}
