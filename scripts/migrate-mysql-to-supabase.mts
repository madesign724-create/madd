import mysql from "mysql2/promise";
import postgres from "postgres";

const sourceUrl = process.env.DATABASE_URL;
const targetUrl = process.env.SUPABASE_DATABASE_URL;
const apply = process.argv.includes("--apply");

if (!sourceUrl?.startsWith("mysql")) throw new Error("DATABASE_URL must contain the current MySQL connection URL.");
if (!targetUrl?.startsWith("postgres")) throw new Error("SUPABASE_DATABASE_URL must contain the Supabase PostgreSQL connection URL.");

const tables = [
  "users", "customer_profiles", "staff_members", "company_settings", "admin_activity_logs",
  "services", "catalog_nodes", "products", "product_images", "projects", "project_updates",
  "project_update_images", "user_device_tokens", "project_services", "project_selections", "project_attachments",
] as const;

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const source = await mysql.createConnection(sourceUrl);
const target = postgres(targetUrl, { max: 1, prepare: false });

try {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const [rows] = await source.query<Array<{ total: number }>>(`SELECT COUNT(*) AS total FROM \`${table}\``);
    counts[table] = Number(rows[0]?.total ?? 0);
  }
  console.log(`MySQL source rows: ${Object.entries(counts).map(([table, count]) => `${table}=${count}`).join(", ")}`);
  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to copy records without deleting source or target data.");
  } else {
    for (const table of tables) {
      const [rows] = await source.query<Array<Record<string, unknown>>>(`SELECT * FROM \`${table}\``);
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const columnSql = columns.map(quoteIdentifier).join(", ");
      const parameterSql = columns.map((_, index) => `$${index + 1}`).join(", ");
      const statement = `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${parameterSql}) ON CONFLICT DO NOTHING`;
      for (const row of rows) await target.unsafe(statement, columns.map((column) => row[column]));
      console.log(`Copied ${rows.length} record(s) from ${table}.`);
    }
    for (const table of tables) {
      await target.unsafe(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table)}), 1), true)`);
    }
    console.log("MySQL to Supabase copy completed without deleting data from either database.");
  }
} finally {
  await source.end();
  await target.end({ timeout: 5 });
}
