import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import AppSetting from "@/models/AppSetting";
import {
  DEFAULT_LOGO_URL,
  DEFAULT_SOLUTION_NAME,
  GLOBAL_SETTINGS_KEY,
  isAllowedLogoUrl,
  normalizeSolutionName,
} from "@/lib/app-settings";

export async function GET() {
  await connectDB();
  const settings = await AppSetting.findOne({ key: GLOBAL_SETTINGS_KEY })
    .select("logoUrl solutionName")
    .lean();

  const logoUrl =
    typeof settings?.logoUrl === "string" && isAllowedLogoUrl(settings.logoUrl)
      ? settings.logoUrl
      : DEFAULT_LOGO_URL;
  const solutionName =
    typeof settings?.solutionName === "string" && settings.solutionName.trim()
      ? normalizeSolutionName(settings.solutionName)
      : DEFAULT_SOLUTION_NAME;

  return NextResponse.json({ logoUrl, solutionName });
}
