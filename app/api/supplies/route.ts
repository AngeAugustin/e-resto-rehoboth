import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { isValidSupplyLotSize } from "@/lib/supply-lot-sizes";
import Supply from "@/models/Supply";
import Product from "@/models/Product";
import { marketPriceAboveCatalogError } from "@/lib/product-market-price";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const supplies = await Supply.find()
    .populate("product", "name image sellingPrice defaultMarketSellingPrice")
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 });

  return NextResponse.json(supplies);
}

const MAX_BATCH = 25;

type SupplyItemInput = {
  productId: string;
  lotSize: number;
  lotPrice: number;
  numberOfLots: number;
  marketSellingPrice: number;
};

function parseSupplyItem(raw: Record<string, unknown>): SupplyItemInput | null {
  const productId = raw.productId;
  const lotSize = Number(raw.lotSize);
  const lotPrice = Number(raw.lotPrice);
  const numberOfLots = Number(raw.numberOfLots);
  const marketSellingPrice = Number(raw.marketSellingPrice);

  if (
    !productId ||
    typeof productId !== "string" ||
    !Number.isFinite(lotSize) ||
    !isValidSupplyLotSize(lotSize) ||
    !Number.isFinite(lotPrice) ||
    lotPrice < 0 ||
    !Number.isFinite(numberOfLots) ||
    numberOfLots < 1 ||
    !Number.isFinite(marketSellingPrice) ||
    marketSellingPrice < 0
  ) {
    return null;
  }

  return { productId, lotSize, lotPrice, numberOfLots, marketSellingPrice };
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const body = await req.json();

  /** Approvisionnement multiple : { items: [...] } */
  if (Array.isArray(body.items)) {
    if (body.items.length === 0) {
      return NextResponse.json({ error: "Ajoutez au moins une ligne de produit" }, { status: 400 });
    }
    if (body.items.length > MAX_BATCH) {
      return NextResponse.json({ error: `Maximum ${MAX_BATCH} produits par enregistrement` }, { status: 400 });
    }

    const parsed: SupplyItemInput[] = [];
    for (let i = 0; i < body.items.length; i++) {
      const row = parseSupplyItem(body.items[i] as Record<string, unknown>);
      if (!row) {
        return NextResponse.json(
          { error: `Ligne ${i + 1} : champs invalides ou incomplets` },
          { status: 400 }
        );
      }
      parsed.push(row);
    }

    const created: unknown[] = [];
    try {
      for (const item of parsed) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return NextResponse.json(
            { error: `Produit introuvable (${item.productId})` },
            { status: 404 }
          );
        }

        const priceErr = marketPriceAboveCatalogError(Number(product.sellingPrice), item.marketSellingPrice);
        if (priceErr) {
          return NextResponse.json({ error: `${priceErr} (produit ${product.name})` }, { status: 400 });
        }

        const totalUnits = item.lotSize * item.numberOfLots;
        const totalCost = item.lotPrice * item.numberOfLots;

        const supply = new Supply({
          product: item.productId,
          lotSize: item.lotSize,
          lotPrice: item.lotPrice,
          numberOfLots: item.numberOfLots,
          marketSellingPrice: item.marketSellingPrice,
          totalUnits,
          totalCost,
          createdBy: session!.user.id,
        });
        await supply.save();

        await supply.populate("product", "name image sellingPrice defaultMarketSellingPrice");
        await supply.populate("createdBy", "firstName lastName");
        created.push(supply.toJSON());
      }
    } catch (e) {
      console.error(e);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement des approvisionnements" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, supplies: created }, { status: 201 });
  }

  /** Une seule entrée (ancien format) */
  const { productId, lotSize, lotPrice, numberOfLots, marketSellingPrice } = body;

  if (!productId || !lotSize || !lotPrice || !numberOfLots || !marketSellingPrice) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const priceErr = marketPriceAboveCatalogError(Number(product.sellingPrice), Number(marketSellingPrice));
  if (priceErr) {
    return NextResponse.json({ error: priceErr }, { status: 400 });
  }

  const ls = Number(lotSize);
  if (!isValidSupplyLotSize(ls)) {
    return NextResponse.json(
      { error: "Taille du casier invalide : indiquez un nombre entier d’unités entre 1 et 1 000 000" },
      { status: 400 }
    );
  }

  const totalUnits = Number(lotSize) * Number(numberOfLots);
  const totalCost = Number(lotPrice) * Number(numberOfLots);

  const supply = new Supply({
    product: productId,
    lotSize: Number(lotSize),
    lotPrice: Number(lotPrice),
    numberOfLots: Number(numberOfLots),
    marketSellingPrice: Number(marketSellingPrice),
    totalUnits,
    totalCost,
    createdBy: session!.user.id,
  });

  await supply.save();

  await supply.populate("product", "name image sellingPrice defaultMarketSellingPrice");
  await supply.populate("createdBy", "firstName lastName");

  return NextResponse.json(supply, { status: 201 });
}
