import { NextRequest, NextResponse } from "next/server";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Product from "@/models/Product";
import Supply from "@/models/Supply";

const MONTHS = 12;

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId || !Types.ObjectId.isValid(productId)) {
    return NextResponse.json({ error: "productId valide requis" }, { status: 400 });
  }

  await connectDB();
  const product = await Product.findById(productId)
    .select("name marketSellingPrice")
    .lean<{ name: string; marketSellingPrice?: number } | null>();
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const supplies = await Supply.find({ product: productId })
    .select("marketSellingPrice createdAt")
    .sort({ createdAt: 1 })
    .lean<Array<{ marketSellingPrice: number; createdAt: Date }>>();

  const now = new Date();
  const firstMonthStart = startOfMonth(subMonths(now, MONTHS - 1));

  let lastMarket: number | null =
    product.marketSellingPrice != null &&
    Number.isFinite(product.marketSellingPrice) &&
    product.marketSellingPrice > 0
      ? product.marketSellingPrice
      : null;

  let supplyIndex = 0;
  while (
    supplyIndex < supplies.length &&
    new Date(supplies[supplyIndex].createdAt).getTime() < firstMonthStart.getTime()
  ) {
    lastMarket = supplies[supplyIndex].marketSellingPrice;
    supplyIndex++;
  }

  const series: Array<{
    key: string;
    labelShort: string;
    labelFull: string;
    marketPrice: number | null;
  }> = [];

  for (let offset = MONTHS - 1; offset >= 0; offset--) {
    const monthStart = startOfMonth(subMonths(now, offset));
    const monthEnd = endOfMonth(monthStart);

    while (
      supplyIndex < supplies.length &&
      new Date(supplies[supplyIndex].createdAt).getTime() <= monthEnd.getTime()
    ) {
      lastMarket = supplies[supplyIndex].marketSellingPrice;
      supplyIndex++;
    }

    const key = format(monthStart, "yyyy-MM");
    const rawShort = format(monthStart, "LLL", { locale: fr });
    const labelShort = rawShort.charAt(0).toUpperCase() + rawShort.slice(1).replace(/\.$/, "");
    const labelFull = format(monthStart, "MMMM yyyy", { locale: fr });

    series.push({
      key,
      labelShort,
      labelFull,
      marketPrice: lastMarket,
    });
  }

  return NextResponse.json({
    productName: product.name,
    footnote:
      "Pour chaque mois : dernier prix marché enregistré sur un approvisionnement, avec repli sur le prix catalogue produit si aucun appro n’a encore eu lieu sur la période affichée.",
    series,
  });
}
