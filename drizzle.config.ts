import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  // Migrations need a direct (unpooled) connection; Neon's pooler runs
  // PgBouncer in transaction mode, which breaks DDL session state.
  dbCredentials: { url: url ?? "" },
  strict: true,
  verbose: true,
});
