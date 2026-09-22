import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { OPERATIONS_ROLES } from "@/lib/roles";
import { kitchenCashSessionFilter } from "@/lib/cash-session";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import KitchenOrder from "@/models/KitchenOrder";
import Menu from "@/models/Menu";
import Cook from "@/models/Cook";
import KitchenWaitress from "@/models/KitchenWaitress";
import { resolveDefaultKitchenCookId } from "@/lib/kitchen-staff";
import CashSession from "@/models/CashSession";
import "@/models/KitchenPlate";
import "@/models/User";

const LIST_MAX_PAGE_SIZE = 100;
const LIST_DEFAULT_PAGE_SIZE = 10;

function parseListQuery(url: URL): { page: number; pageSize: number } {
  const rawPage = url.searchParams.get("page");
  const rawSize = url.searchParams.get("pageSize");
  let page = Number.parseInt(rawPage ?? "1", 10);
  let pageSize = Number.parseInt(rawSize ?? String(LIST_DEFAULT_PAGE_SIZE), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = LIST_DEFAULT_PAGE_SIZE;
  if (pageSize > LIST_MAX_PAGE_SIZE) pageSize = LIST_MAX_PAGE_SIZE;
  return { page, pageSize };
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { page, pageSize } = parseListQuery(req.nextUrl);
  const skip = (page - 1) * pageSize;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const exerciceFilter = withExercice(exerciceId);

  const [statsAgg, orders] = await Promise.all([
    KitchenOrder.aggregate<{
      totalOrders: number;
      totalRevenue: number;
      pendingOrders: number;
      completedOrders: number;
    }>([
      { $match: exerciceFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$totalAmount", 0] },
          },
          pendingOrders: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
          completedOrders: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
        },
      },
    ]),
    KitchenOrder.find(exerciceFilter)
      .populate("cook", "firstName lastName photo")
      .populate("kitchenWaitress", "firstName lastName phone")
      .populate("plate", "number")
      .populate("items.menu", "name image price")
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
  ]);

  const s = statsAgg[0];
  const total = s?.totalOrders ?? 0;

  return NextResponse.json({
    items: orders,
    total,
    stats: {
      totalRevenue: s?.totalRevenue ?? 0,
      totalOrders: total,
      pendingOrders: s?.pendingOrders ?? 0,
      completedOrders: s?.completedOrders ?? 0,
    },
  });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth([...OPERATIONS_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const body = await req.json();
  const { kitchenWaitressId, plateId, items } = body as {
    kitchenWaitressId?: string;
    plateId?: string;
    items?: Array<{ menuId: string; quantity: number }>;
  };

  const latest = await CashSession.findOne(kitchenCashSessionFilter(exerciceId))
    .sort({ createdAt: -1 })
    .select("status")
    .lean<{ status: "OPEN" | "CLOSED" } | null>();
  if (!latest || latest.status !== "OPEN") {
    return NextResponse.json(
      {
        error:
          "Aucune session de caisse cuisine ouverte. Ouvrez d'abord la session dans Caisse cuisine avant d'enregistrer une commande.",
      },
      { status: 409 }
    );
  }

  if (!kitchenWaitressId || !plateId || !items || items.length === 0) {
    return NextResponse.json(
      { error: "Serveuse-cuisinière, plaquette et menus sont requis" },
      { status: 400 }
    );
  }

  const kitchenWaitress = await KitchenWaitress.findById(kitchenWaitressId)
    .select("isActive")
    .lean<{ isActive?: boolean } | null>();
  if (!kitchenWaitress || kitchenWaitress.isActive === false) {
    return NextResponse.json(
      { error: "Serveuse-cuisinière introuvable ou désactivée" },
      { status: 400 }
    );
  }

  const defaultCookId = await resolveDefaultKitchenCookId();
  if (!defaultCookId) {
    return NextResponse.json(
      { error: "Aucune cuisinière active enregistrée. Ajoutez une cuisinière dans l'équipe cuisine." },
      { status: 400 }
    );
  }

  const cook = await Cook.findById(defaultCookId).select("isActive").lean<{ isActive?: boolean } | null>();
  if (!cook || cook.isActive === false) {
    return NextResponse.json({ error: "Cuisinière introuvable ou désactivée" }, { status: 400 });
  }

  const pendingConflict = await KitchenOrder.findOne(
    withExercice(exerciceId, { plate: plateId, status: "PENDING" })
  );
  if (pendingConflict) {
    return NextResponse.json(
      { error: "Cette plaquette a déjà une commande en attente. Clôturez-la ou choisissez une autre plaquette." },
      { status: 409 }
    );
  }

  const orderItems = [];
  for (const item of items) {
    const qty = Number(item.quantity);
    if (!item.menuId || !Number.isFinite(qty) || qty < 1) {
      return NextResponse.json({ error: "Quantité de menu invalide" }, { status: 400 });
    }
    const menu = await Menu.findById(item.menuId);
    if (!menu || !menu.isActive) {
      return NextResponse.json({ error: "Un des menus est introuvable ou inactif" }, { status: 400 });
    }
    orderItems.push({
      menu: item.menuId,
      quantity: qty,
      unitPrice: menu.price,
      total: menu.price * qty,
    });
  }

  const totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0);

  const order = await KitchenOrder.create({
    cook: new Types.ObjectId(defaultCookId),
    kitchenWaitress: new Types.ObjectId(kitchenWaitressId),
    plate: new Types.ObjectId(plateId),
    items: orderItems,
    totalAmount,
    status: "PENDING",
    exercice: exerciceId,
    createdBy: session!.user.id,
  });

  await order.populate("cook", "firstName lastName photo");
  await order.populate("kitchenWaitress", "firstName lastName phone");
  await order.populate("plate", "number");
  await order.populate("items.menu", "name image price");
  await order.populate("createdBy", "firstName lastName");
  return NextResponse.json(order, { status: 201 });
}
