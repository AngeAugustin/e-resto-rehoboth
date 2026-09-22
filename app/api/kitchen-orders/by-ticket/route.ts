import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import { isValidTicketQuery, normalizeTicketInput, saleTicketDisplayId, ticketMatchFilter } from "@/lib/sale-ticket-id";
import KitchenOrder from "@/models/KitchenOrder";
import "@/models/Cook";
import "@/models/KitchenWaitress";
import "@/models/KitchenPlate";
import "@/models/Menu";
import "@/models/User";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const raw = req.nextUrl.searchParams.get("ticket") ?? "";
  if (!isValidTicketQuery(raw)) {
    return NextResponse.json(
      { error: "N° ticket invalide. Saisissez les 10 caractères figurant sur le ticket." },
      { status: 400 }
    );
  }

  const filter = ticketMatchFilter(raw);
  if (!filter) {
    return NextResponse.json({ error: "N° ticket invalide" }, { status: 400 });
  }

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const matches = await KitchenOrder.find(withExercice(exerciceId, filter))
    .populate("cook", "firstName lastName photo")
    .populate("kitchenWaitress", "firstName lastName phone")
    .populate("plate", "number")
    .populate("items.menu", "name image price")
    .populate("createdBy", "firstName lastName")
    .limit(5)
    .lean();

  if (matches.length === 0) {
    return NextResponse.json(
      {
        found: false,
        authentic: false,
        ticket: normalizeTicketInput(raw),
        error: "Aucun ticket cuisine correspondant. Ce numéro n’est pas authentique dans les commandes.",
      },
      { status: 404 }
    );
  }

  if (matches.length > 1) {
    return NextResponse.json(
      {
        found: false,
        authentic: false,
        ticket: normalizeTicketInput(raw),
        error: "Plusieurs commandes correspondent à ce numéro. Contactez la direction.",
      },
      { status: 409 }
    );
  }

  const order = matches[0];
  return NextResponse.json({
    found: true,
    authentic: true,
    ticket: saleTicketDisplayId(String(order._id)),
    order,
  });
}
