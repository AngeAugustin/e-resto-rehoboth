import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Product from "@/models/Product";
import { isValidProductCategory } from "@/lib/product-categories";

type ImportRowPayload = {
  name: string;
  category: string;
  sellingPrice: number;
  image?: string;
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
    .map((row) => ({
      name: String(row.name ?? "").trim(),
      category: row.category,
      sellingPrice: Number(row.sellingPrice),
      image: typeof row.image === "string" ? row.image.trim() : "",
    }))
    .filter((row) => row.name && isValidProductCategory(row.category) && Number.isFinite(row.sellingPrice));

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
