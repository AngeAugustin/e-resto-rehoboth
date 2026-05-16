import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Product from "@/models/Product";
import { isValidProductCategory } from "@/lib/product-categories";
import { parsePositiveMarketPrice } from "@/lib/product-market-price";
import { parseQuantiteStandardPack, parsePrixCasier } from "@/lib/product-pack-fields";

type ImportRowPayload = {
  name: string;
  category: string;
  marketSellingPrice: number | string | null;
  image?: string;
  quantiteStandardPack?: number | string | null;
  prixCasier?: number | string | null;
};

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const body = (await req.json()) as { rows?: ImportRowPayload[] };
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "Aucune ligne à importer." }, { status: 400 });
  }

  const sanitized = rows
    .map((row) => {
      const name = String(row.name ?? "").trim();
      const category = String(row.category ?? "").trim();
      const market = parsePositiveMarketPrice(row.marketSellingPrice);
      if (market == null) return null;
      const qs = parseQuantiteStandardPack(row.quantiteStandardPack);
      const pc = parsePrixCasier(row.prixCasier);
      return {
        name,
        category,
        marketSellingPrice: market,
        image: typeof row.image === "string" ? row.image.trim() : "",
        ...(qs !== undefined ? { quantiteStandardPack: qs } : {}),
        ...(pc !== undefined ? { prixCasier: pc } : {}),
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> =>
        row !== null && row.name !== "" && isValidProductCategory(row.category)
    );

  if (sanitized.length === 0) {
    return NextResponse.json({ error: "Aucune ligne valide à importer." }, { status: 400 });
  }

  const names = sanitized.map((r) => r.name);
  const existing = await Product.find({ name: { $in: names } }).select("name").lean();
  const existingSet = new Set(existing.map((e) => String(e.name).trim().toLowerCase()));

  const uniqueRows: typeof sanitized = [];
  const localSeen = new Set<string>();

  for (const row of sanitized) {
    const key = row.name.toLowerCase();
    if (existingSet.has(key) || localSeen.has(key)) continue;
    localSeen.add(key);
    uniqueRows.push(row);
  }

  if (uniqueRows.length > 0) {
    await Product.insertMany(uniqueRows, { ordered: false });
  }

  return NextResponse.json({
    importedCount: uniqueRows.length,
    skippedCount: sanitized.length - uniqueRows.length,
    totalRequested: rows.length,
  });
}
