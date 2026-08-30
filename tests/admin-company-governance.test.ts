import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync("drizzle/schema.ts", "utf8");
const dbSource = readFileSync("server/db.ts", "utf8");
const routerSource = readFileSync("server/routers.ts", "utf8");
const companyToolsSource = readFileSync("components/admin-company-tools.tsx", "utf8");
const adminScreenSource = readFileSync("app/admin.tsx", "utf8");
const homeSource = readFileSync("app/(tabs)/index.tsx", "utf8");
const pdfSource = readFileSync("lib/report-pdf.ts", "utf8");

describe("إعدادات شركة MADD وحوكمة المالك", () => {
  it("يحفظ بيانات الشركة وسجل النشاط في جداول مستقلة", () => {
    expect(schemaSource).toContain("companySettings");
    expect(schemaSource).toContain("adminActivityLogs");
    expect(dbSource).toContain("getCompanySettings");
    expect(dbSource).toContain("updateCompanySettings");
    expect(dbSource).toContain("recordAdminActivity");
  });

  it("يقصر إدارة الهوية والملكية والسجل على المالك", () => {
    expect(routerSource).toContain("companySettings:");
    expect(routerSource).toContain("updateCompanySettings:");
    expect(routerSource).toContain("companyGovernance:");
    expect(routerSource).toContain("ownerCandidates:");
    expect(routerSource).toContain("adminActivity:");
    expect(routerSource).toContain("assertOwner(ctx.user.id)");
    expect(routerSource).toContain("نقل الملكية");
  });

  it("يعرض أدوات مرئية لإدارة الهوية والحوكمة دون أوامر تقنية", () => {
    expect(companyToolsSource).toContain("إعدادات الشركة والحوكمة");
    expect(companyToolsSource).toContain("شعار الشركة");
    expect(companyToolsSource).toContain("نقل ملكية التشغيل");
    expect(companyToolsSource).toContain("سجل النشاط الإداري");
  });

  it("يعكس بيانات الشركة القابلة للتعديل في الواجهة والتقارير", () => {
    expect(homeSource).toContain("companyQuery");
    expect(homeSource).toContain("publicHeroTitle");
    expect(pdfSource).toContain("ReportBranding");
    expect(pdfSource).toContain("supportEmail");
  });

  it("يسجل العمليات الإدارية الحساسة للمراجعة", () => {
    expect(routerSource).toContain("project_update_published");
    expect(routerSource).toContain("project_manager_assigned");
    expect(routerSource).toContain("product_created");
    expect(routerSource).toContain("service_updated");
  });

  it("يوفر فلاتر السجل وتصديره PDF قبل المشاركة", () => {
    expect(routerSource).toContain("actorUserId");
    expect(routerSource).toContain("dateFrom");
    expect(routerSource).toContain("dateTo");
    expect(dbSource).toContain("listAdminActivityForOwner(filters");
    expect(companyToolsSource).toContain("بحث في تفاصيل العملية");
    expect(companyToolsSource).toContain("تطبيق الفلاتر");
    expect(companyToolsSource).toContain("تصدير PDF");
    expect(companyToolsSource).toContain("مشاركة PDF");
    expect(pdfSource).toContain("buildAdminActivityReportHtml");
  });

  it("يعرض آخر تعديل ووقته ومنفذه لكل أعضاء الإدارة المصرح لهم", () => {
    expect(dbSource).toContain("listRecentAdminActivityForAdmin");
    expect(dbSource).toContain("actorName: users.name");
    expect(routerSource).toContain("recentActivity:");
    expect(routerSource).toContain("customer_project_created");
    expect(routerSource).toContain("customer_project_submitted");
    expect(adminScreenSource).toContain("آخر التعديلات");
    expect(adminScreenSource).toContain("آخر تعديل:");
    expect(adminScreenSource).toContain("بواسطة");
  });
});
