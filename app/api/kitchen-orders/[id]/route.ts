import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { DIRECTION_ROLES, OPERATIONS_ROLES } from "@/lib/roles";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";
import KitchenOrder from "@/models/KitchenOrder";
import Menu from "@/models/Menu";
import Cook from "@/models/Cook";
import KitchenWaitress from "@/models/KitchenWaitress";
import { resolveDefaultKitchenCookId } from "@/lib/kitchen-staff";
import "@/models/KitchenPlate";
import "@/models/User";

async function loadPopulated(id: string, exerciceId: Types.ObjectId) {
  return KitchenOrder.findOne(withExercice(exerciceId, { _id: id }))
    .populate("cook", "firstName lastName photo")
    .populate("kitchenWaitress", "firstName lastName phone")
    .populate("plate", "number")
    .populate("items.menu", "name image price")
    .populate("createdBy", "firstName lastName")
    .lean();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const order = await loadPopulated(id, exerciceId);
  if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...OPERATIONS_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;
  const body = await req.json();

  const order = await KitchenOrder.findOne(withExercice(exerciceId, { _id: id }));
  if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  if (order.status !== "PENDING") {
    return NextResponse.json(
      { error: "Seules les commandes en attente peuvent être modifiées" },
      { status: 400 }
    );
  }

  if (body.action === "complete") {
    const { amountPaid, paymentMethod } = body;
    if (paymentMethod !== "CASH" && paymentMethod !== "MOBILE_MONEY") {
      return NextResponse.json(
        { error: "Indiquez le mode de paiement : espèces ou Mobile Money" },
        { status: 400 }
      );
    }
    if (amountPaid === undefined || Number(amountPaid) < order.totalAmount) {
      return NextResponse.json({ error: "Montant payé insuffisant" }, { status: 400 });
    }

    const paidNum = Number(amountPaid);
    const changeDue = paidNum - order.totalAmount;
    if (changeDue > 0 && typeof body.changeReturnedAck !== "boolean") {
      return NextResponse.json(
        {
          error:
            "Une monnaie est à rendre : indiquez si vous l’avez déjà remise au client ou non avant de clôturer la commande.",
        },
        { status: 400 }
      );
    }

    order.amountPaid = paidNum;
    order.change = changeDue;
    order.paymentMethod = paymentMethod;
    order.changeReturnedAck = changeDue > 0 ? body.changeReturnedAck === true : undefined;
    order.status = "COMPLETED";
    await order.save();

    const fresh = await loadPopulated(id, exerciceId);
    return NextResponse.json(fresh);
  }

  const { kitchenWaitressId, plateId, items } = body as {
    kitchenWaitressId?: string;
    plateId?: string;
    items?: Array<{ menuId: string; quantity: number }>;
  };

  if (kitchenWaitressId) {
    const kitchenWaitress = await KitchenWaitress.findById(kitchenWaitressId)
      .select("isActive")
      .lean<{ isActive?: boolean } | null>();
    if (!kitchenWaitress || kitchenWaitress.isActive === false) {
      return NextResponse.json(
        { error: "Serveuse-cuisinière introuvable ou désactivée" },
        { status: 400 }
      );
    }
    order.kitchenWaitress = new Types.ObjectId(kitchenWaitressId);
  }

  const defaultCookId = await resolveDefaultKitchenCookId();
  if (!defaultCookId) {
    return NextResponse.json(
      { error: "Aucune cuisinière active enregistrée. Ajoutez une cuisinière dans l'équipe cuisine." },
      { status: 400 }
    );
  }
  const defaultCook = await Cook.findById(defaultCookId).select("isActive").lean<{ isActive?: boolean } | null>();
  if (!defaultCook || defaultCook.isActive === false) {
    return NextResponse.json({ error: "Cuisinière introuvable ou désactivée" }, { status: 400 });
  }
  order.cook = new Types.ObjectId(defaultCookId);

  if (plateId) {
    const conflict = await KitchenOrder.findOne(
      withExercice(exerciceId, {
        plate: plateId,
        status: "PENDING",
        _id: { $ne: id },
      })
    );
    if (conflict) {
      return NextResponse.json(
        { error: "Cette plaquette a déjà une commande en attente." },
        { status: 409 }
      );
    }
    order.plate = new Types.ObjectId(plateId);
  }

  if (items && items.length > 0) {
    const orderItems = [];
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!item.menuId || !Number.isFinite(qty) || qty < 1) {
        return NextResponse.json({ error: "Quantité de menu invalide" }, { status: 400 });
      }
      const menu = await Menu.findById(item.menuId);
      if (!menu) {
        return NextResponse.json({ error: "Un des menus est introuvable" }, { status: 400 });
      }
      orderItems.push({
        menu: new Types.ObjectId(item.menuId),
        quantity: qty,
        unitPrice: menu.price,
        total: menu.price * qty,
      });
    }
    order.items = orderItems;
    order.totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0);
  }

  await order.save();
  const fresh = await loadPopulated(id, exerciceId);
  if (!fresh) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  return NextResponse.json(fresh);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth([...DIRECTION_ROLES]);
  if (error) return error;

  await connectDB();
  const exerciceId = await getActiveExerciceId();
  const { id } = await params;

  const order = await KitchenOrder.findOne(withExercice(exerciceId, { _id: id }));
  if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  if (order.status === "COMPLETED") {
    return NextResponse.json({ error: "Impossible d'annuler une commande clôturée" }, { status: 400 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ message: "Commande déjà annulée" });
  }

  order.status = "CANCELLED";
  await order.save();
  return NextResponse.json({ message: "Commande annulée", order });
}
