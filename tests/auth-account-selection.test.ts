import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const oauthSource = readFileSync("constants/oauth.ts", "utf8");
const authScreenSource = readFileSync("app/auth.tsx", "utf8");
const callbackSource = readFileSync("app/auth/callback.tsx", "utf8");
const accountSource = readFileSync("app/(tabs)/account.tsx", "utf8");
const createProjectSource = readFileSync("app/create-project.tsx", "utf8");

describe("تسجيل Google المستقل في MADD", () => {
  it("يبدأ الدخول من Supabase بمزود Google ويطلب اختيار الحساب عند الحاجة", () => {
    expect(oauthSource).toContain('provider: "google"');
    expect(oauthSource).toContain('prompt: "select_account"');
    expect(oauthSource).toContain("WebBrowser.openAuthSessionAsync");
    expect(oauthSource).toContain("chooseAccount?: boolean");
  });

  it("لا يرسل العميل إلى بوابة Manus أو مسار app-auth", () => {
    expect(oauthSource).not.toContain("manus.im");
    expect(oauthSource).not.toContain("/app-auth");
    expect(authScreenSource).not.toContain("Powered by Manus");
    expect(authScreenSource).not.toContain("إنشاء حساب جديد");
    expect(authScreenSource).not.toContain("استخدام حساب مختلف");
  });

  it("يعرض شاشة MADD العربية بزر Google واحد ويكمل العودة الآمنة", () => {
    expect(authScreenSource).toContain("دخول MADD");
    expect(authScreenSource).toContain("المتابعة مع Google");
    expect(authScreenSource).toContain('startOAuthLogin({ chooseAccount: true })');
    expect(callbackSource).toContain("completeSupabaseOAuthCallback");
    expect(callbackSource).toContain("consumePendingRoute");
  });

  it("يوجه بوابتي الحساب والمشروع إلى شاشة المصادقة الجديدة", () => {
    expect(accountSource).toContain("إنشاء حساب أو تسجيل الدخول");
    expect(accountSource).toContain('router.push("/auth"');
    expect(createProjectSource).toContain('await savePendingRoute("/create-project")');
    expect(createProjectSource).toContain('router.push("/auth"');
  });
});
