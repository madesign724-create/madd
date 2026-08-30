import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL is required to apply the catalog selection-mode migration.");
}

const confirmedDatabaseUrl = databaseUrl;

async function applySelectionModeColumn() {
  const sql = postgres(confirmedDatabaseUrl, { max: 1, prepare: false });

  try {
    await sql`alter table catalog_nodes add column if not exists selection_mode text`;
    await sql`update catalog_nodes set selection_mode = 'multi' where selection_mode is null`;
    await sql`alter table catalog_nodes alter column selection_mode set default 'multi'`;
    await sql`alter table catalog_nodes alter column selection_mode set not null`;
    console.log("selection_mode column is ready on catalog_nodes");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void applySelectionModeColumn();
