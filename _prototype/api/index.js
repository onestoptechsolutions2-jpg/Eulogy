import "dotenv/config";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import path from "node:path";

import { pagesRouter } from "../src/routes/pages.js";
import { apiRouter } from "../src/routes/api.js";
import { adminRouter } from "../src/routes/admin.js";

const ROOT = process.cwd();

const app = express();
app.set("trust proxy", 1); // Vercel terminates TLS at its edge; trust the forwarded proto/IP
app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "src/views"));

app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // covers this app's own static inline style="" attributes only —
        // every dynamic value on a page goes through EJS auto-escaping.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        // photos are served from Vercel Blob's public CDN
        imgSrc: ["'self'", "data:", "https://*.public.blob.vercel-storage.com"],
        scriptSrc: ["'self'"],
      },
    },
  })
);

app.use(express.json({ limit: "1mb" })); // photos go through multer/multipart, not JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(ROOT, "public")));

app.use("/", pagesRouter);
app.use("/api", apiRouter);
app.use("/api/admin", adminRouter);

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).send("Not found"));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request too large" });
  }
  res.status(500).json({ error: "Internal server error" });
});

export default app;
