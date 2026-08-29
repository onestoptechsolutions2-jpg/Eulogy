import { Router } from "express";
import {
  ensureSchema,
  addContribution,
  getGuestbook,
  addGuestbookEntry,
  deleteGuestbookEntry,
  getGenealogy,
} from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { fullName } from "../lib/tree.js";

export const apiRouter = Router();

apiRouter.post("/contributions", async (req, res, next) => {
  try {
    await ensureSchema();
    const { name, relationship, relationshipDetail, memory, aboutHandle } = req.body || {};
    if (!name?.trim() || !relationship?.trim() || !memory?.trim()) {
      return res.status(400).json({ error: "name, relationship, and memory are required" });
    }
    const row = await addContribution({
      name: name.trim(),
      relationship: relationship.trim(),
      relationshipDetail: relationshipDetail?.trim(),
      memory: memory.trim(),
      aboutHandle: aboutHandle?.trim() || null,
    });
    res.status(201).json({ id: row.id });
  } catch (err) {
    next(err);
  }
});

// People list for the "who is this memory about?" picker and admin previews.
apiRouter.get("/people", async (req, res, next) => {
  try {
    await ensureSchema();
    const { people } = await getGenealogy();
    res.json(
      people
        .map((p) => ({ handle: p.handle, name: fullName(p) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/genealogy", async (req, res, next) => {
  try {
    await ensureSchema();
    res.json(await getGenealogy());
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/guestbook", async (req, res, next) => {
  try {
    await ensureSchema();
    res.json(await getGuestbook(200));
  } catch (err) {
    next(err);
  }
});

apiRouter.post("/guestbook", async (req, res, next) => {
  try {
    await ensureSchema();
    const { name, message } = req.body || {};
    if (!name?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "name and message are required" });
    }
    const row = await addGuestbookEntry(name.trim(), message.trim());
    res.status(201).json({ id: row.id });
  } catch (err) {
    next(err);
  }
});

apiRouter.delete("/guestbook/:id", requireAdmin, async (req, res, next) => {
  try {
    await deleteGuestbookEntry(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
