import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";

const IMG_EXT_REGEX = /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i;

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
      return new URL(candidate, baseUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
}

async function resolveImageUrl(inputUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (IMG_EXT_REGEX.test(parsed.toString())) return parsed.toString();

  const pageRes = await fetch(parsed.toString(), {
    redirect: "follow",
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; e-stock-image-proxy/1.0)" },
  });
  if (!pageRes.ok) return null;

  const contentType = pageRes.headers.get("content-type") ?? "";
  if (contentType.startsWith("image/")) return pageRes.url || parsed.toString();

  const html = await pageRes.text();
  return extractMetaImage(html, pageRes.url || parsed.toString());
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  const sourceUrl = req.nextUrl.searchParams.get("url")?.trim();
  if (!sourceUrl) return NextResponse.json({ error: "URL manquante" }, { status: 400 });

  try {
    const imageUrl = await resolveImageUrl(sourceUrl);
    if (!imageUrl) return NextResponse.json({ error: "Image introuvable" }, { status: 404 });

    const imageRes = await fetch(imageUrl, {
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; e-stock-image-proxy/1.0)" },
    });
    if (!imageRes.ok) return NextResponse.json({ error: "Image inaccessible" }, { status: 404 });

    const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await imageRes.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Impossible de charger l'image" }, { status: 500 });
  }
}
