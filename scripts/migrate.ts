import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { describeTarget, scriptConnection } from "./env";

/** Applies every pending migration in ./drizzle. Safe to run repeatedly. */
async function main() {
  const sql = scriptConnection();
  console.log(`→ Migrating ${describeTarget()}`);
  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    console.log("✓ Database is up to date");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("✖ Migration failed:", error);
  process.exit(1);
});
