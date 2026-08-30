import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authScreen = readFileSync(resolve(process.cwd(), "app/auth.tsx"), "utf8");

describe("شاشة دخول البريد الإلكتروني", () => {
  it("توفر إنشاء الحساب والدخول بالبريد وكلمة المرور مع رابط تأكيد آمن", () => {
    expect(authScreen).toContain('supabase.auth.signUp');
    expect(authScreen).toContain('supabase.auth.signInWithPassword');
    expect(authScreen).toContain('emailRedirectTo: getRedirectUri()');
    expect(authScreen).toContain('secureTextEntry');
  });

  it("لا تستبدل تسجيل Google وتوضح حماية الإدارة", () => {
    expect(authScreen).toContain('startOAuthLogin');
    expect(authScreen).toContain('تبقى لوحة الإدارة مقصورة على المالك وفريقه المخوّل');
  });
});
