import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toaster";
import { connectDB } from "@/lib/db";
import AppSetting from "@/models/AppSetting";
import { DEFAULT_SOLUTION_NAME, GLOBAL_SETTINGS_KEY, normalizeSolutionName } from "@/lib/app-settings";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const fallbackTitle = `${DEFAULT_SOLUTION_NAME} — Gestion Restaurant`;

  try {
    await connectDB();
    const settings = await AppSetting.findOne({ key: GLOBAL_SETTINGS_KEY })
      .select("solutionName")
      .lean();
    const solutionName =
      typeof settings?.solutionName === "string" && settings.solutionName.trim()
        ? normalizeSolutionName(settings.solutionName)
        : DEFAULT_SOLUTION_NAME;

    return {
      title: `${solutionName} — Gestion Restaurant`,
      description: "Système de gestion des stocks et des ventes pour restaurant",
    };
  } catch {
    return {
      title: fallbackTitle,
      description: "Système de gestion des stocks et des ventes pour restaurant",
    };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans antialiased bg-white">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
