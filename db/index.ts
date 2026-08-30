import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | null = null;

function getDb(): DB {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Put the Neon pooled connection string in .env " +
          "(local) or the Vercel project's Environment Variables.",
      );
    }
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

// Lazy proxy so importing `db` never touches env at module load (keeps
// `next build` happy); the connection is created on first query.
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export { schema };
