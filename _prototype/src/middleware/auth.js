import crypto from "node:crypto";
import { getSession } from "../lib/session.js";

/**
 * Constant-time comparison for the admin password. A plain `===` leaks
 * timing information proportional to how many leading characters match.
 * Both sides are hashed first so the comparison is fixed-length
 * regardless of the submitted password's length.
 */
export function checkPassword(submitted, expected) {
  if (!expected) return false;
  const a = crypto.createHash("sha256").update(String(submitted ?? "")).digest();
  const b = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

// Reads the encrypted session cookie and 401s if it doesn't say isAdmin.
export async function requireAdmin(req, res, next) {
  try {
    const session = await getSession(req, res);
    if (session.isAdmin) return next();
  } catch {
    /* unreadable/absent cookie — fall through to 401 */
  }
  return res.status(401).json({ error: "Unauthorized" });
}

export async function requireAdminPage(req, res, next) {
  try {
    const session = await getSession(req, res);
    if (session.isAdmin) return next();
  } catch {
    /* fall through */
  }
  return res.status(401).send('<p>Unauthorized. Log in at <a href="/admin">/admin</a> first.</p>');
}
