import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Sale from "@/models/Sale";
import Supply from "@/models/Supply";
import Product from "@/models/Product";
import CashSession from "@/models/CashSession";
import { resolveSaleLinePricing } from "@/lib/sale-pricing";
import {
  parseTableIdsFromRequestBody,
  pendingSaleUsesAnyTableFilter,
} from "@/lib/sale-tables-server";
import { Types } from "mongoose";
import "@/models/Waitress";
import "@/models/RestaurantTable";
import "@/models/User";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const sales = await Sale.find()
    .populate("waitress", "firstName lastName")
    .populate("tables", "number name")
    .populate("table", "number name")
    .populate("items.product", "name image marketSellingPrice")
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 });

  return NextResponse.json(sales);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const body = await req.json();
  const { waitressId, items } = body;
  const tableIds = parseTableIdsFromRequestBody(body);

  const latestCashSession = await CashSession.findOne().sort({ createdAt: -1 }).select("status").lean<{
    status: "OPEN" | "CLOSED";
  } | null>();
  if (!latestCashSession || latestCashSession.status !== "OPEN") {
    return NextResponse.json(
      {
        error:
          "Aucune session de caisse ouverte. Ouvrez d'abord la session du jour dans Caisse avant d'enregistrer une vente.",
      },
      { status: 409 }
    );
  }

  if (!waitressId || !tableIds || !items || items.length === 0) {
    return NextResponse.json(
      { error: "Serveuse, au moins une table et des produits sont requis" },
      { status: 400 }
    );
  }

  const pendingConflict = await Sale.findOne(pendingSaleUsesAnyTableFilter(tableIds));
  if (pendingConflict) {
    return NextResponse.json(
      {
        error:
          "Une ou plusieurs tables ont déjà une commande en attente. Clôturez-la ou modifiez la sélection.",
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

  // Prix marché + coût unitaire (dernier appro), sinon prix catalogue produit
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

  const totalAmount = saleItems.reduce((sum, item) => sum + item.total, 0);

  const sale = await Sale.create({
    waitress: waitressId,
    tables: tableIds.map((tid) => new Types.ObjectId(tid)),
    items: saleItems,
    totalAmount,
    status: "PENDING",
    createdBy: session!.user.id,
  });

  await sale.populate("waitress", "firstName lastName");
  await sale.populate("tables", "number name");
  await sale.populate("table", "number name");
  await sale.populate("items.product", "name image marketSellingPrice");

  return NextResponse.json(sale, { status: 201 });
}
