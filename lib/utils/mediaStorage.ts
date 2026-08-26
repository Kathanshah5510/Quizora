import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface SavedMedia {
  storageKey: string; // relative path from public/: "uploads/<filename>"
  url: string;        // "/uploads/<filename>"
  filename: string;   // sanitized original filename
  mimeType: string;
  sizeBytes: number;
}

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
}

export async function saveUploadedFile(file: File): Promise<SavedMedia> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new MediaValidationError(
      "Only JPEG, PNG, GIF, and WebP images are allowed"
    );
  }
  if (file.size > MAX_BYTES) {
    throw new MediaValidationError(
      `File too large. Maximum size is ${MAX_BYTES / 1024 / 1024} MB`
    );
  }

  const id = uuidv4().replace(/-/g, "");
  const safeName = `${id}_${sanitizeFilename(file.name)}`;
  const uploadsDir = join(process.cwd(), "public", "uploads");

  await mkdir(uploadsDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(join(uploadsDir, safeName), buffer);

  return {
    storageKey: `uploads/${safeName}`,
    url: `/uploads/${safeName}`,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}
