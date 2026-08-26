import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUploadedFile, MediaValidationError } from "@/lib/utils/mediaStorage";

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let file: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (!f || typeof f === "string") {
      return NextResponse.json({ error: "Missing file (field name: file)" }, { status: 400 });
    }
    file = f as File;
  } catch {
    return NextResponse.json({ error: "Failed to parse multipart data" }, { status: 400 });
  }

  try {
    const saved = await saveUploadedFile(file);

    const asset = await db.mediaAsset.create({
      data: {
        filename: saved.filename,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        storageKey: saved.storageKey,
        storageProvider: "LOCAL",
        uploadedById: user.id,
      },
    });

    return NextResponse.json({
      id: asset.id,
      url: saved.url,
      filename: saved.filename,
      sizeBytes: saved.sizeBytes,
    });
  } catch (err) {
    if (err instanceof MediaValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[media upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
