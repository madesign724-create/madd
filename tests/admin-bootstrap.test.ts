import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getBootstrapAdminEmail, isBootstrapAdminEmail } from "../server/admin-bootstrap";

describe("MADD operations administrator bootstrap", () => {
  it("loads a valid configured administrator email and matches it case-insensitively", () => {
    const configuredEmail = getBootstrapAdminEmail();
    expect(configuredEmail).toBe("madesign724@gmail.com");
    expect(configuredEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(isBootstrapAdminEmail(configuredEmail.toUpperCase())).toBe(true);
    expect(isBootstrapAdminEmail("not-the-configured-admin@example.com")).toBe(false);
  });

  it("يثبت بريد مالك MADD ولا يعتمد على قيمة بيئية قد تفتح الإدارة لحساب آخر", () => {
    const bootstrapSource = readFileSync("server/admin-bootstrap.ts", "utf8");
    const dbSource = readFileSync("server/db.ts", "utf8");
    expect(bootstrapSource).toContain('return "madesign724@gmail.com"');
    expect(bootstrapSource).not.toContain("MADD_BOOTSTRAP_ADMIN_EMAIL");
    expect(dbSource).toContain("createdByUserId === ownerUserId");
    expect(dbSource).toContain("getBootstrapAdminEmail()");
  });
});
