import { config } from "dotenv";
import postgres from "postgres";

config({ path: [".env.local", ".env"], quiet: true });

/**
 * Connection for operator scripts (migrate, seed). Prefers the direct,
 * unpooled URL: DDL and long transactions don't belong on PgBouncer.
 */
export function scriptConnection() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error("✖ Set DATABASE_URL (or DATABASE_URL_UNPOOLED) in .env.local first.");
    process.exit(1);
  }
  return postgres(url, { max: 1, prepare: false, onnotice: () => {} });
}

/** Host and database name only, so logs never print credentials. */
export function describeTarget(): string {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}
