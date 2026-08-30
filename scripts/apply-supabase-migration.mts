import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error("SUPABASE_DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  const migration = await readFile(path.resolve("drizzle/0010_supabase_postgres_baseline.sql"), "utf8");
  await sql.unsafe(migration);
  const tables = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name in ('services', 'catalog_nodes', 'products', 'product_images', 'projects', 'admin_activity_logs')
    order by table_name
  `;
  if (tables.length !== 6) throw new Error("Supabase migration did not create all required MADD tables");
  console.log(`Supabase MADD schema ready: ${tables.map((table) => table.table_name).join(", ")}`);
} finally {
  await sql.end({ timeout: 5 });
}
