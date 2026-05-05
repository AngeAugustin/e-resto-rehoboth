import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import Sale from "@/models/Sale";
import Waitress from "@/models/Waitress";
import "@/models/RestaurantTable";
import "@/models/User";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const { id } = await params;

  const waitress = await Waitress.findById(id).select("_id");
  if (!waitress) {
    return NextResponse.json({ error: "Serveuse introuvable" }, { status: 404 });
  }

  const sales = await Sale.find({ waitress: id })
    .populate("waitress", "firstName lastName")
    .populate("tables", "number name")
    .populate("table", "number name")
    .populate("items.product", "name image marketSellingPrice")
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 });

  return NextResponse.json(sales);
}
