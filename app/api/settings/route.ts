import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import AppSetting from "@/models/AppSetting";
import {
  DEFAULT_LOGO_URL,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SOLUTION_NAME,
  GLOBAL_SETTINGS_KEY,
  isAllowedPrimaryColor,
  isAllowedLogoUrl,
  normalizeHexColor,
  normalizeSolutionName,
  normalizeEmailList,
} from "@/lib/app-settings";

function toClientPayload(doc: {
  primaryColor?: string;
  logoUrl?: string;
  solutionName?: string;
  lowStockAlertEmails?: unknown;
}) {
  const safeLogoUrl =
    typeof doc.logoUrl === "string" && isAllowedLogoUrl(doc.logoUrl) ? doc.logoUrl : DEFAULT_LOGO_URL;
  const safeSolutionName =
    typeof doc.solutionName === "string" && doc.solutionName.trim()
      ? normalizeSolutionName(doc.solutionName)
      : DEFAULT_SOLUTION_NAME;

  return {
    primaryColor: normalizeHexColor(doc.primaryColor) ?? DEFAULT_PRIMARY_COLOR,
    logoUrl: safeLogoUrl,
    solutionName: safeSolutionName,
    lowStockAlertEmails: normalizeEmailList(doc.lowStockAlertEmails),
  };
}

export async function GET() {
  const { error } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const settings = await AppSetting.findOne({ key: GLOBAL_SETTINGS_KEY }).lean();
  return NextResponse.json(toClientPayload(settings ?? {}));
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requireAuth(["directeur", "gerant"]);
  if (error) return error;

  await connectDB();
  const body = (await req.json()) as {
    primaryColor?: unknown;
    solutionName?: unknown;
    lowStockAlertEmails?: unknown;
  };
  const updates: Record<string, string | string[]> = {};

  if (Object.prototype.hasOwnProperty.call(body, "primaryColor")) {
    if (typeof body.primaryColor !== "string" || !isAllowedPrimaryColor(body.primaryColor)) {
      return NextResponse.json({ error: "Couleur principale invalide" }, { status: 400 });
    }
    updates.primaryColor = normalizeHexColor(body.primaryColor) ?? DEFAULT_PRIMARY_COLOR;
  }

  if (Object.prototype.hasOwnProperty.call(body, "lowStockAlertEmails")) {
    if (session?.user?.role !== "directeur") {
      return NextResponse.json(
        { error: "Seul un directeur peut modifier les destinataires d'alerte" },
        { status: 403 }
      );
    }
    const emails = normalizeEmailList(body.lowStockAlertEmails);
    if (emails.length > 15) {
      return NextResponse.json({ error: "Maximum 15 adresses email" }, { status: 400 });
    }
    updates.lowStockAlertEmails = emails;
  }

  if (Object.prototype.hasOwnProperty.call(body, "solutionName")) {
    if (session?.user?.role !== "directeur") {
      return NextResponse.json(
        { error: "Seul un directeur peut modifier le nom de la solution" },
        { status: 403 }
      );
    }
    updates.solutionName = normalizeSolutionName(body.solutionName);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucun paramètre à mettre à jour" }, { status: 400 });
  }

  const settings = await AppSetting.findOneAndUpdate(
    { key: GLOBAL_SETTINGS_KEY },
    { $set: updates, $setOnInsert: { key: GLOBAL_SETTINGS_KEY } },
    { new: true, upsert: true, strict: false }
  ).lean();

  return NextResponse.json(toClientPayload(settings ?? {}));
}
