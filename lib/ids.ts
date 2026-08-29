import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** URL-safe, lowercase, collision-resistant id. Default ~21 chars. */
export function newId(length = 21): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Longer opaque token for magic links and invitations. */
export function newToken(): string {
  return randomBytes(32).toString("hex");
}
