import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toaster";
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SOLUTION_NAME,
  GLOBAL_SETTINGS_KEY,
  hexToHslTriplet,
  normalizeHexColor,
} from "@/lib/app-settings";
import { connectDB } from "@/lib/db";
import AppSetting from "@/models/AppSetting";

const aptos = localFont({
  src: [
    {
      path: "../public/Aptos/Aptos-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/Aptos/Aptos-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-aptos",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${DEFAULT_SOLUTION_NAME} — Gestion Restaurant`,
  description: "Système de gestion des stocks et des ventes pour restaurant",
  icons: {
    icon: [{ url: "/Logo.png", type: "image/png" }],
    apple: [{ url: "/Logo.png", type: "image/png" }],
  },
};

type ThemeCssVars = React.CSSProperties & Record<`--${string}`, string>;

async function getInitialThemeVars(): Promise<ThemeCssVars> {
  try {
    await connectDB();
    const settings = await AppSetting.findOne({ key: GLOBAL_SETTINGS_KEY })
      .select("primaryColor")
      .lean();
    const primaryColor = normalizeHexColor(settings?.primaryColor) ?? DEFAULT_PRIMARY_COLOR;
    const hslTriplet = hexToHslTriplet(primaryColor) ?? "0 0% 5%";
    return {
      "--primary": hslTriplet,
      "--ring": hslTriplet,
    };
  } catch {
    // Fallback to default black theme when settings are unavailable.
    return {
      "--primary": "0 0% 5%",
      "--ring": "0 0% 5%",
    };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialThemeVars = await getInitialThemeVars();
  return (
    <html lang="fr" className={aptos.variable} style={initialThemeVars}>
      <body className="font-sans antialiased bg-white">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
