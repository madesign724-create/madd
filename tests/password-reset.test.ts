import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const authSource = readFileSync(join(root, "app/auth.tsx"), "utf8");
const resetSource = readFileSync(join(root, "app/auth/reset-password.tsx"), "utf8");
const oauthSource = readFileSync(join(root, "constants/oauth.ts"), "utf8");
const layoutSource = readFileSync(join(root, "app/_layout.tsx"), "utf8");

describe("استرداد كلمة المرور", () => {
  it("يرسل رابط الاسترداد إلى مسار منفصل وآمن", () => {
    expect(authSource).toContain("resetPasswordForEmail");
    expect(authSource).toContain("getPasswordResetRedirectUri()");
    expect(authSource).toContain("نسيت كلمة المرور؟");
    expect(oauthSource).toContain('"auth/reset-password"');
  });

  it("يتحقق من رابط الاسترداد ويطلب كلمة مرور جديدة متطابقة", () => {
    expect(resetSource).toContain("completeSupabaseRecoveryCallback");
    expect(resetSource).toContain("supabase.auth.updateUser({ password })");
    expect(resetSource).toContain("password !== confirmation");
    expect(layoutSource).toContain('name="auth/reset-password"');
  });
});
