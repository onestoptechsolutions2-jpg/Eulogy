import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const dk = await scryptAsync(plain, salt, KEYLEN);
  return `scrypt$${salt}$${dk.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = (stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const dk = await scryptAsync(plain, salt, KEYLEN);
  const known = Buffer.from(hash, "hex");
  return known.length === dk.length && timingSafeEqual(known, dk);
}

/** Minimum bar for a new password. Returns an error message, or null if ok. */
export function checkPasswordStrength(plain: string): string | null {
  if (plain.length < 8) return "Use at least 8 characters.";
  if (plain.length > 200) return "That password is too long.";
  return null;
}

/** A readable random password for seeded / reset accounts. */
export function generatePassword(): string {
  const words = randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "");
  return `${words.slice(0, 4)}-${words.slice(4, 8)}-${randomBytes(1)[0] % 90 + 10}`;
}
