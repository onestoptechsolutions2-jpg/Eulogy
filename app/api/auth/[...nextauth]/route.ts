import { handlers } from "@/auth";

// Auth.js's authorize() verifies passwords with node:crypto (scrypt) and
// talks to Neon — must be the Node runtime, never Edge.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
