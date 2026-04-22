import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";

function isDirectImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(url);
}

function extractMetaImage(html: string, baseUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate) continue;
    try {
      const resolved = new URL(candidate, baseUrl).toString();
      return resolved;
    } catch {
      continue;
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  const sourceUrl = req.nextUrl.searchParams.get("url")?.trim();
  if (!sourceUrl) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Protocole non supporté" }, { status: 400 });
  }

  if (isDirectImageUrl(parsed.toString())) {
    return NextResponse.json({ imageUrl: parsed.toString() });
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; e-stock-import/1.0)" },
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ imageUrl: null });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.startsWith("image/")) {
      return NextResponse.json({ imageUrl: res.url || parsed.toString() });
    }

    const html = await res.text();
    const imageUrl = extractMetaImage(html, res.url || parsed.toString());
    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}
