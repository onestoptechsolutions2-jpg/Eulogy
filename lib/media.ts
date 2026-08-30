import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import type { Media } from "@/db/schema";
import { newId } from "./ids";

// Images are kept base64 in the `media` table for now. Everything that
// stores or serves an image goes through this module, so switching to
// object storage later is a change in one file.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB per image

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type SavedImage = { id: string; url: string };

export class UploadError extends Error {}

/** Validate + store one uploaded image, return its id and served URL. */
export async function saveImage(opts: {
  treeId: string;
  uploadedBy: string;
  file: File;
  kind: "avatar" | "cover" | "gallery";
  personId?: string | null;
  caption?: string;
}): Promise<SavedImage> {
  const { file } = opts;
  if (!file || typeof file === "string" || file.size === 0) {
    throw new UploadError("Choose an image file.");
  }
  if (!ALLOWED.has(file.type)) {
    throw new UploadError("Use a JPEG, PNG, WebP or GIF image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("That image is over 4 MB — pick a smaller one.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const id = newId();
  await db.insert(media).values({
    id,
    treeId: opts.treeId,
    personId: opts.personId ?? null,
    kind: opts.kind,
    mimeType: file.type,
    data: bytes.toString("base64"),
    byteSize: file.size,
    caption: (opts.caption ?? "").trim().slice(0, 300),
    uploadedByUserId: opts.uploadedBy,
  });
  return { id, url: `/media/${id}` };
}

export async function getImage(id: string): Promise<Media | null> {
  const [m] = await db.select().from(media).where(eq(media.id, id));
  return m ?? null;
}

export async function listGallery(treeId: string, personId: string): Promise<Media[]> {
  return db
    .select()
    .from(media)
    .where(and(eq(media.treeId, treeId), eq(media.personId, personId), eq(media.kind, "gallery")))
    .orderBy(desc(media.createdAt));
}

export async function listTreeGallery(treeId: string, limit = 200): Promise<Media[]> {
  return db
    .select()
    .from(media)
    .where(and(eq(media.treeId, treeId), eq(media.kind, "gallery")))
    .orderBy(desc(media.createdAt))
    .limit(limit);
}

export async function deleteImage(treeId: string, id: string): Promise<Media | null> {
  const [m] = await db
    .select()
    .from(media)
    .where(and(eq(media.treeId, treeId), eq(media.id, id)));
  if (!m) return null;
  await db.delete(media).where(eq(media.id, id));
  return m;
}

/** If a people.photo_url / cover_url points at our own /media/<id>, the id. */
export function mediaIdFromUrl(url: string): string | null {
  const m = /^\/media\/([a-z0-9]{10,})$/.exec(url.trim());
  return m ? m[1] : null;
}
