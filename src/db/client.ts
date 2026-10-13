import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything queries can run against: the pool or an open transaction. */
export type Executor = Database | Transaction;

const globalForDb = globalThis as unknown as { __clearpathDb?: Database };

/**
 * Lazily creates the shared connection pool. Lazy so that `next build` and
 * unit tests never need a database, and cached on `globalThis` so dev-mode
 * hot reloads don't leak connections.
 */
export function getDb(): Database {
  if (globalForDb.__clearpathDb) return globalForDb.__clearpathDb;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Locally, copy .env.example to .env.local. On Vercel, connect the Neon integration to the project.",
    );
  }

  const client = postgres(url, {
    // Neon's pooler runs PgBouncer in transaction mode, which can't hold
    // prepared statements across transactions.
    prepare: false,
    // Serverless functions are short-lived; keep each instance's footprint small.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzle(client, { schema, casing: "snake_case" });
  globalForDb.__clearpathDb = db;
  return db;
}
