import { Router } from "express";
import multer from "multer";
import {
  ensureSchema,
  getSite,
  updateSite,
  getAllContributions,
  getContribution,
  patchContribution,
  deleteContribution,
  getGenealogy,
  updatePersonDetails,
  replaceGenealogy,
} from "../db.js";
import { uploadMiddleware, processAndSaveImage } from "../lib/upload.js";
import { parseGramps } from "../lib/gramps.js";
import { requireAdmin, checkPassword } from "../middleware/auth.js";
import { getSession } from "../lib/session.js";

export const adminRouter = Router();

const grampsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
}).single("file");

// ---- auth ----

adminRouter.post("/login", async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!process.env.ADMIN_PASSWORD) {
      return res.status(500).json({ error: "Server has no ADMIN_PASSWORD configured" });
    }
    if (!checkPassword(password, process.env.ADMIN_PASSWORD)) {
      return res.status(401).json({ error: "Incorrect password" });
    }
    const session = await getSession(req, res);
    session.isAdmin = true;
    await session.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/logout", async (req, res, next) => {
  try {
    const session = await getSession(req, res);
    session.destroy();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- site content ----

adminRouter.get("/site", requireAdmin, async (req, res, next) => {
  try {
    await ensureSchema();
    const site = await getSite();
    res.json({ ...site, gallery: JSON.parse(site.gallery_json) });
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/site", requireAdmin, async (req, res, next) => {
  try {
    await ensureSchema();
    await updateSite(req.body || {});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- photo upload (multipart, decoded + resized by sharp, stored in Vercel Blob) ----

adminRouter.post("/upload", requireAdmin, (req, res) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || "Upload failed" });
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    try {
      const { url } = await processAndSaveImage(req.file.buffer);
      res.json({ url });
    } catch (e) {
      console.error("Image processing/storage failed", e);
      res.status(400).json({ error: "That file doesn't look like a valid image" });
    }
  });
});

// ---- family tree ----

adminRouter.get("/genealogy", requireAdmin, async (req, res, next) => {
  try {
    await ensureSchema();
    res.json(await getGenealogy());
  } catch (err) {
    next(err);
  }
});

// Upload a .gramps file (Gramps' backup format) — wipes and reloads the
// people/families tables. Family-entered dates and bios are preserved.
adminRouter.post("/import-gramps", requireAdmin, (req, res) => {
  grampsUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || "Upload failed" });
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    try {
      await ensureSchema();
      const parsed = parseGramps(req.file.buffer);
      if (!parsed.people.length) {
        return res.status(400).json({ error: "No people found — is this a Gramps XML / .gramps file?" });
      }
      const counts = await replaceGenealogy(parsed);
      res.json({ ok: true, ...counts });
    } catch (e) {
      console.error("Gramps import failed", e);
      res.status(400).json({ error: "Could not read that file as a Gramps database" });
    }
  });
});

adminRouter.patch("/people/:handle", requireAdmin, async (req, res, next) => {
  try {
    await ensureSchema();
    const { birth_date, death_date, bio, photo_url } = req.body || {};
    await updatePersonDetails(req.params.handle, { birth_date, death_date, bio, photo_url });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- contributions ----

adminRouter.get("/contributions", requireAdmin, async (req, res, next) => {
  try {
    await ensureSchema();
    res.json(await getAllContributions());
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/contributions/:id", requireAdmin, async (req, res, next) => {
  try {
    const existing = await getContribution(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const { status, featured } = req.body || {};
    await patchContribution(req.params.id, { status, featured });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/contributions/:id", requireAdmin, async (req, res, next) => {
  try {
    const existing = await getContribution(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    await deleteContribution(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
