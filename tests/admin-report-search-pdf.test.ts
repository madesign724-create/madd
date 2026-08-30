import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync("server/db.ts", "utf8");
const routerSource = readFileSync("server/routers.ts", "utf8");
const adminSource = readFileSync("app/admin.tsx", "utf8");
const pdfSource = readFileSync("lib/report-pdf.ts", "utf8");
const webPdfSource = readFileSync("lib/web-pdf-export.ts", "utf8");
const projectReportSource = readFileSync("app/admin/report/[projectId].tsx", "utf8");
const portfolioReportSource = readFileSync("app/admin/portfolio-report.tsx", "utf8");
const nativePdfSharingSource = readFileSync("lib/pdf-native-sharing.ts", "utf8");

describe("بحث تقارير MADD وتصدير PDF للطلبات الفردية", () => {
  it("يوفر الخادم قائمة تقارير مقفولة مرشحة بصلاحية إدارة المشروعات فقط", () => {
    expect(routerSource).toContain("lockedProjectReports:");
    expect(routerSource).not.toContain("monthlyProjectReport:");
    expect(routerSource).not.toContain("enableMonthlyReportEmail:");
    expect(routerSource).toContain('assertAdmin(ctx.user.id, "projects")');
    expect(dbSource).toContain("listLockedProjectReportsForAdmin");
    expect(dbSource).not.toContain("getMonthlyProjectReportForAdmin");
    expect(dbSource).toContain("isNotNull(projects.lockedAt)");
    expect(dbSource).toContain("toLocaleLowerCase(\"ar-EG\")");
  });

  it("يعرض البحث حسب اسم المشروع أو العميل أو المدينة ومرشحي الحالة والمسؤول", () => {
    expect(adminSource).toContain("تقارير الطلبات");
    expect(adminSource).toContain("ابحث باسم المشروع أو العميل أو المدينة");
    expect(adminSource).toContain("lockedProjectReports.useQuery");
    expect(adminSource).toContain("فلترة بالحالة");
    expect(adminSource).toContain("فلترة بمسؤول المشروع");
    expect(adminSource).not.toContain("تصدير التقرير الشهري PDF");
    expect(adminSource).not.toContain("/admin/monthly-report");
  });

  it("يفلتر التقارير بحسب المدينة وفترة إنشاء المشروع في الخادم والواجهة", () => {
    expect(dbSource).toContain("city?: string; dateFrom?: string; dateTo?: string");
    expect(dbSource).toContain("normalizedCity");
    expect(dbSource).toContain("filters.dateFrom");
    expect(dbSource).toContain("filters.dateTo");
    expect(routerSource).toContain("dateFrom: z.string().regex");
    expect(routerSource).toContain("dateTo: z.string().regex");
    expect(adminSource).toContain("فلترة المدينة");
    expect(adminSource).toContain("فلترة فترة إنشاء المشروع");
    expect(portfolioReportSource).toContain("dateFrom");
    expect(portfolioReportSource).toContain("الفلاتر المطبقة");
  });

  it("يوفر تقريراً شاملاً للمشروعات بمستوى التقدم والحالة والمسؤول قابل للطباعة وPDF", () => {
    expect(routerSource).toContain("portfolioReport:");
    expect(dbSource).toContain("getPortfolioReportForAdmin");
    expect(dbSource).toContain("averageProgress");
    expect(pdfSource).toContain("buildPortfolioReportHtml");
    expect(adminSource).toContain("إنشاء تقرير شامل للمشروعات");
    expect(portfolioReportSource).toContain("تقرير شامل للمشروعات");
    expect(portfolioReportSource).toContain("Print.printAsync");
    expect(portfolioReportSource).toContain("saveNativePdf");
    expect(nativePdfSharingSource).toContain("Print.printToFileAsync");
  });

  it("يميّز التقرير التفصيلي لكل مشروع عن التقرير الشامل داخل لوحة الإدارة", () => {
    expect(adminSource).toContain("تقرير تفصيلي للمشروع");
    expect(projectReportSource).toContain("تقرير تفصيلي للمشروع");
    expect(projectReportSource).toContain("بيانات المشروع والعميل");
    expect(projectReportSource).toContain("الخدمات المختارة");
    expect(projectReportSource).toContain("اختيارات المنتجات");
    expect(projectReportSource).toContain("سجل مراحل التنفيذ");
  });

  it("يحفظ ويعرض المسار الهرمي للمنتج في التقرير التفصيلي وPDF", () => {
    expect(dbSource).toContain("export async function getProductBreadcrumb");
    expect(dbSource).toContain("breadcrumb: selection.productId ? await getProductBreadcrumb");
    expect(projectReportSource).toContain("المسار:");
    expect(projectReportSource).toContain("product.breadcrumb");
    expect(pdfSource).toContain("breadcrumb?: string[]");
    expect(pdfSource).toContain("المسار:");
  });

  it("يضم شعاراً ورأساً رسمياً من MADD في قوالب PDF مع حماية HTML العربية", () => {
    expect(pdfSource).toContain('Asset.fromModule(require("../assets/images/icon.png"))');
    expect(pdfSource).toContain('from "expo-file-system/legacy"');
    expect(pdfSource).toContain("data:image/png;base64");
    expect(pdfSource).toContain("buildProjectReportHtml");
    expect(pdfSource).toContain("buildMaddHeader");
    expect(pdfSource).toContain('branding.legalName || "MADD Engineering & Finishes"');
    expect(pdfSource).toContain("madesign724@gmail.com");
    expect(pdfSource).not.toContain("buildMonthlyReportHtml");
    expect(pdfSource).toContain("escapeHtml");
    expect(pdfSource).toContain('dir="rtl"');
  });

  it("يفصل تصدير PDF المحلي عن المشاركة ويتيح مشاركة الملف المُصدَّر عبر تطبيقات الهاتف", () => {
    expect(projectReportSource).toContain("Print.printAsync");
    expect(projectReportSource).toContain('from "@/lib/pdf-native-sharing"');
    expect(projectReportSource).toContain("createNativePdf");
    expect(projectReportSource).toContain("تصدير PDF");
    expect(projectReportSource).toContain("مشاركة PDF");
    expect(projectReportSource).toContain("shareNativePdf");
    expect(portfolioReportSource).toContain('from "@/lib/pdf-native-sharing"');
    expect(portfolioReportSource).toContain("createNativePdf");
    expect(portfolioReportSource).toContain("تصدير PDF");
    expect(portfolioReportSource).toContain("مشاركة PDF");
    expect(portfolioReportSource).toContain("shareNativePdf");
    expect(projectReportSource).toContain('Platform.OS === "web" ? "حفظ PDF" : "مشاركة PDF"');
    expect(nativePdfSharingSource).toContain("Print.printToFileAsync");
    expect(nativePdfSharingSource).toContain("Sharing.isAvailableAsync");
    expect(nativePdfSharingSource).toContain("Sharing.shareAsync");
  });

  it("يفتح على الويب مستند التقرير وحوار الطباعة للحفظ كـ PDF بدلاً من إيقاف التصدير برسالة إرشادية", () => {
    expect(webPdfSource).toContain("openWebPdfExportWindow");
    expect(webPdfSource).toContain("writeWebPdfExportWindow");
    expect(webPdfSource).toContain("printWindow.print()");
    expect(webPdfSource).toContain("prepareWebPdfHtml");
    expect(projectReportSource).toContain("openWebPdfExportWindow");
    expect(portfolioReportSource).toContain("openWebPdfExportWindow");
    expect(readFileSync("components/admin-company-tools.tsx", "utf8")).toContain("webPrintWindow = Platform.OS === \"web\" ? openWebPdfExportWindow() : null");
    expect(projectReportSource).not.toContain("تصدير PDF من المتصفح");
    expect(portfolioReportSource).not.toContain("تصدير PDF من المتصفح");
  });
});
