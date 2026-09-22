import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import { isValidTicketQuery, normalizeTicketInput, saleTicketDisplayId, ticketMatchFilter } from "@/lib/sale-ticket-id";
import Sale from "@/models/Sale";
import "@/models/Waitress";
import "@/models/RestaurantTable";
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
  const matches = await Sale.find(withExercice(exerciceId, filter))
    .populate("waitress", "firstName lastName")
    .populate("tables", "number name")
    .populate("table", "number name")
    .populate("items.product", "name image marketSellingPrice")
    .populate("createdBy", "firstName lastName")
    .limit(5)
    .lean();

  if (matches.length === 0) {
    return NextResponse.json(
      {
        found: false,
        authentic: false,
        ticket: normalizeTicketInput(raw),
        error: "Aucun ticket bar correspondant. Ce numéro n’est pas authentique dans les ventes.",
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
        error: "Plusieurs ventes correspondent à ce numéro. Contactez la direction.",
      },
      { status: 409 }
    );
  }

  const sale = matches[0];
  return NextResponse.json({
    found: true,
    authentic: true,
    ticket: saleTicketDisplayId(String(sale._id)),
    sale,
  });
}
