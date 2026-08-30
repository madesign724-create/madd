import { describe, expect, it } from "vitest";
import postgres from "postgres";

describe("Supabase connection configuration", () => {
  it("connects to the configured Supabase PostgreSQL project", async () => {
    const databaseUrl = process.env.SUPABASE_DATABASE_URL;
    const apiUrl = process.env.SUPABASE_URL;

    expect(databaseUrl, "SUPABASE_DATABASE_URL is required").toBeTruthy();
    expect(apiUrl, "SUPABASE_URL is required").toBeTruthy();

    const parsedDatabaseUrl = new URL(databaseUrl!);
    const databaseHost = parsedDatabaseUrl.hostname;
    const apiHost = new URL(apiUrl!).hostname;
    expect(databaseHost.endsWith(".supabase.co") || databaseHost.includes("pooler.supabase.com")).toBe(true);
    const projectReference = apiHost.split(".")[0];
    expect(
      databaseHost.includes(projectReference) || decodeURIComponent(parsedDatabaseUrl.username).includes(projectReference),
      "The database URL must belong to the configured Supabase project",
    ).toBe(true);

    const sql = postgres(databaseUrl!, { max: 1, prepare: false, connect_timeout: 10 });
    try {
      const result = await sql<{ database_name: string }[]>`select current_database() as database_name`;
      expect(result[0]?.database_name).toBeTruthy();
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
