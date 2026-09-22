import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import KitchenOrder from "@/models/KitchenOrder";
import "@/models/Menu";
import "@/models/KitchenPlate";
import "@/models/User";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const orders = await KitchenOrder.find(withExercice(exerciceId, { cook: id }))
    .populate("cook", "firstName lastName photo")
    .populate("plate", "number")
    .populate("items.menu", "name image price")
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(orders);
}
