import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { isStandardSupplyLotSize, isValidSupplyLotSize } from "@/lib/supply-lot-sizes";
import Supply from "@/models/Supply";
import Product from "@/models/Product";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const { productId, lotSize, lotPrice, numberOfLots, marketSellingPrice } = body;

  if (!productId || lotSize === undefined || lotPrice === undefined || marketSellingPrice === undefined) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

  const supply = await Supply.findById(id);
  if (!supply) {
    return NextResponse.json({ error: "Approvisionnement introuvable" }, { status: 404 });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const m = Number(marketSellingPrice);
  if (!Number.isFinite(m) || m <= 0) {
    return NextResponse.json({ error: "Prix de vente marché invalide." }, { status: 400 });
  }

  const nextLotSize = Number(lotSize);
  if (!Number.isFinite(nextLotSize) || !isValidSupplyLotSize(nextLotSize)) {
    return NextResponse.json(
      { error: "Taille du casier invalide : indiquez un nombre entier d’unités entre 1 et 1 000 000" },
      { status: 400 }
    );
  }
  const nextNumberOfLots = isStandardSupplyLotSize(nextLotSize) ? Number(numberOfLots) : 1;
  if (!Number.isFinite(nextNumberOfLots) || nextNumberOfLots < 1) {
    return NextResponse.json({ error: "Nombre de casiers invalide." }, { status: 400 });
  }

  supply.product = productId;
  supply.lotSize = Number(lotSize);
  supply.lotPrice = Number(lotPrice);
  supply.numberOfLots = nextNumberOfLots;
  supply.marketSellingPrice = m;
  await supply.save();

  await Product.findByIdAndUpdate(productId, { marketSellingPrice: m });

  await supply.populate("product", "name image marketSellingPrice quantiteStandardPack prixCasier");
  await supply.populate("createdBy", "firstName lastName");

  return NextResponse.json(supply);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const supply = await Supply.findById(id);
  if (!supply) {
    return NextResponse.json({ error: "Approvisionnement introuvable" }, { status: 404 });
  }

  await Supply.findByIdAndDelete(id);

  return NextResponse.json({ message: "Approvisionnement supprimé" });
}
