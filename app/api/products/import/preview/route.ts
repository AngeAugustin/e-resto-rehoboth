import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { parseProductImportFile } from "@/lib/product-import";

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Le fichier est vide." }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return NextResponse.json({ error: "Le fichier dépasse 10MB." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseProductImportFile({
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });

    const validRows = rows.filter((r) => r.valid).length;
    return NextResponse.json({
      fileName: file.name,
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows,
      rows,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Impossible d'analyser le fichier";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
