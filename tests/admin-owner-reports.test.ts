import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync("server/db.ts", "utf8");
const routerSource = readFileSync("server/routers.ts", "utf8");
const ownerToolsSource = readFileSync("components/admin-owner-catalog-tools.tsx", "utf8");
const reportScreenSource = readFileSync("app/admin/report/[projectId].tsx", "utf8");
const adminScreenSource = readFileSync("app/admin.tsx", "utf8");
const nativePdfSharingSource = readFileSync("lib/pdf-native-sharing.ts", "utf8");

describe("لوحة مالك MADD وتقارير الطلبات", () => {
  it("تقيد إدارة صفحات الخدمة وحذفها بصلاحية المالك وتحمي الخدمة المرتبطة باختيارات العملاء", () => {
    expect(routerSource).toContain("createService:");
    expect(routerSource).toContain("deleteService:");
    expect(routerSource).toContain("uploadServiceImage:");
    expect(routerSource).toContain("assertOwner(ctx.user.id)");
    expect(dbSource).toContain("deleteServiceForAdmin");
    expect(dbSource).toContain("await transaction.delete(catalogNodes).where(eq(catalogNodes.serviceId, serviceId))");
    expect(dbSource).toContain("هذه الخدمة مرتبطة بطلبات عملاء محفوظة");
  });

  it("يوفر إدارة صورة منتج مفردة مع تبديل آمن للصورة الرئيسية", () => {
    expect(routerSource).toContain("deleteProductImage:");
    expect(dbSource).toContain("deleteProductImageForAdmin");
    expect(dbSource).toContain("mainImageUrl");
    expect(ownerToolsSource).toContain("معرض صور المنتجات");
    expect(ownerToolsSource).toContain("حذف هذه الصورة");
    expect(ownerToolsSource).toContain("الصورة الرئيسية");
  });

  it("يجمع تقريراً محفوظاً للطلبات المقفولة فقط ويعرض الوصول إليه من لوحة المشروعات", () => {
    expect(routerSource).toContain("lockedProjectReport:");
    expect(dbSource).toContain("getLockedProjectReportForAdmin");
    expect(dbSource).toContain("if (!project?.lockedAt) return null");
    expect(dbSource).toContain("selectedServices");
    expect(dbSource).toContain("selectedProducts");
    expect(dbSource).toContain("updates:");
    expect(adminScreenSource).toContain("تقرير تفصيلي للمشروع");
    expect(adminScreenSource).toContain("/admin/report/");
  });

  it("يوفر طباعة التقرير وإنشاء PDF قابل للمشاركة من الهاتف", () => {
    expect(reportScreenSource).toContain('from "expo-print"');
    expect(reportScreenSource).toContain("Print.printAsync");
    expect(reportScreenSource).toContain('from "@/lib/pdf-native-sharing"');
    expect(reportScreenSource).toContain("createNativePdf");
    expect(reportScreenSource).toContain("shareNativePdf");
    expect(nativePdfSharingSource).toContain("Print.printToFileAsync");
    expect(nativePdfSharingSource).toContain("Sharing.shareAsync");
    expect(reportScreenSource).toContain("تصدير PDF");
    expect(reportScreenSource).toContain("مشاركة PDF");
  });
});
