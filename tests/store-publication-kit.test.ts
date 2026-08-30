import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync("app/_layout.tsx", "utf8");
const accountSource = readFileSync("app/(tabs)/account.tsx", "utf8");
const privacySource = readFileSync("app/privacy.tsx", "utf8");
const deleteAccountSource = readFileSync("app/delete-account.tsx", "utf8");
const publicationKit = readFileSync("docs/madd-store-publication-kit.md", "utf8");

describe("حزمة نشر MADD للمتاجر", () => {
  it("يوفر سياسة خصوصية ومسار طلب حذف الحساب داخل التطبيق", () => {
    expect(layoutSource).toContain('<Stack.Screen name="privacy" />');
    expect(layoutSource).toContain('<Stack.Screen name="delete-account" />');
    expect(accountSource).toContain('label="سياسة الخصوصية"');
    expect(accountSource).toContain('label="طلب حذف الحساب"');
    expect(privacySource).toContain("سياسة خصوصية MADD");
    expect(deleteAccountSource).toContain("طلب حذف حساب MADD");
  });

  it("يوثق محتوى المتجر وإفصاح البيانات ومسار الصور والنشر", () => {
    expect(publicationKit).toContain("Google Play Store Listing");
    expect(publicationKit).toContain("Apple App Store Listing");
    expect(publicationKit).toContain("Google Play — Data Safety");
    expect(publicationKit).toContain("مفهوم صور الشاشات");
    expect(publicationKit).toContain("خطوات النشر على Google Play");
    expect(publicationKit).toContain("خطوات النشر على App Store");
  });
});
