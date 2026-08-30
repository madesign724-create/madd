import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("lib/pdf-native-sharing.ts", "utf8");
const projectReportSource = readFileSync("app/admin/report/[projectId].tsx", "utf8");
const portfolioReportSource = readFileSync("app/admin/portfolio-report.tsx", "utf8");
const activityToolsSource = readFileSync("components/admin-company-tools.tsx", "utf8");

describe("مشاركة PDF على الهاتف", () => {
  it("يتحقق من حفظ الملف قبل فتح ورقة المشاركة ويعلن نوع PDF الصحيح", () => {
    expect(source).toContain("FileSystem.getInfoAsync");
    expect(source).toContain("Sharing.isAvailableAsync");
    expect(source).toContain('UTI: "com.adobe.pdf"');
    expect(source).toContain('mimeType: "application/pdf"');
  });

  it("ينشئ ملفاً للمشاركة فور الضغط عند عدم وجود ملف مصدّر مسبقاً", () => {
    expect(projectReportSource).toContain("exportedPdfUri ?? await createNativePdf()");
    expect(portfolioReportSource).toContain("exportedPdfUri ?? await createNativePdf()");
    expect(activityToolsSource).toContain("exportedActivityPdfUri ?? await createNativeActivityPdf()");
  });
});
