import { Router } from "express";
import {
  ensureSchema,
  getSite,
  getVoices,
  getGuestbook,
  getGenealogy,
  getPerson,
  getApprovedContributions,
} from "../db.js";
import { relativesOf, familyUnits, rootPeople, fullName, shortName, lifespan } from "../lib/tree.js";

export const pagesRouter = Router();

const helpers = { fullName, shortName, lifespan };

pagesRouter.get("/", async (req, res, next) => {
  try {
    await ensureSchema();
    const site = await getSite();
    const [voices, guestbook, genealogy] = await Promise.all([
      getVoices(),
      getGuestbook(100),
      getGenealogy(),
    ]);

    const subject = site.subject_handle
      ? genealogy.people.find((p) => p.handle === site.subject_handle) || null
      : null;
    const relatives = subject ? relativesOf(subject.handle, genealogy) : null;

    res.render("home", {
      ...helpers,
      site,
      gallery: JSON.parse(site.gallery_json || "[]"),
      voices,
      guestbook,
      peopleCount: genealogy.people.length,
      subject,
      relatives,
    });
  } catch (err) {
    next(err);
  }
});

pagesRouter.get("/tree", async (req, res, next) => {
  try {
    await ensureSchema();
    const [site, genealogy] = await Promise.all([getSite(), getGenealogy()]);
    res.render("tree", {
      ...helpers,
      site,
      units: familyUnits(genealogy),
      roots: rootPeople(genealogy),
      peopleCount: genealogy.people.length,
    });
  } catch (err) {
    next(err);
  }
});

pagesRouter.get("/person/:handle", async (req, res, next) => {
  try {
    await ensureSchema();
    const [person, genealogy, approved] = await Promise.all([
      getPerson(req.params.handle),
      getGenealogy(),
      getApprovedContributions(),
    ]);
    if (!person) return res.status(404).send("No such person");
    const relatives = relativesOf(person.handle, genealogy);
    const memories = approved.filter((m) => m.about_handle === person.handle);
    res.render("person", { ...helpers, person, relatives, memories });
  } catch (err) {
    next(err);
  }
});

pagesRouter.get("/share", async (req, res, next) => {
  try {
    await ensureSchema();
    const [site, genealogy] = await Promise.all([getSite(), getGenealogy()]);
    const people = [...genealogy.people]
      .map((p) => ({ handle: p.handle, name: fullName(p) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.render("share", { siteName: site.name, people });
  } catch (err) {
    next(err);
  }
});

pagesRouter.get("/admin", (req, res) => {
  res.render("admin");
});
