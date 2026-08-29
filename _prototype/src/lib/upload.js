import multer from "multer";
import sharp from "sharp";
import crypto from "node:crypto";
import { put } from "@vercel/blob";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// The upload is buffered in memory (photos only, capped below). sharp
// re-encodes the actual pixel data before anything is stored, so a
// mislabeled or malicious file never survives as-is.
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB raw upload cap
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WEBP, or GIF images are allowed"));
    }
    cb(null, true);
  },
}).single("file");

/**
 * Re-encodes an uploaded image to a sane max size, then stores it in
 * Vercel Blob and returns its public URL. Using sharp (which decodes the
 * real pixels) rather than trusting the extension is what makes this safe
 * against disguised files — anything that isn't a real image throws here.
 *
 * BLOB_READ_WRITE_TOKEN is injected automatically on Vercel once the Blob
 * store is connected to the project. Locally, put it in .env.
 */
export async function processAndSaveImage(buffer, { maxDimension = 2000, quality = 82 } = {}) {
  const webp = await sharp(buffer, { failOn: "error" })
    .rotate() // auto-orient from EXIF
    .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  const key = `uploads/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
  const { url } = await put(key, webp, {
    access: "public",
    contentType: "image/webp",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return { url };
}
