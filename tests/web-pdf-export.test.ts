import { describe, expect, it } from "vitest";

import { prepareWebPdfHtml } from "../lib/web-pdf-export";

describe("مستند PDF للويب", () => {
  it("يضيف عنواناً آمناً وإعدادات الطباعة إلى قالب التقرير العربي", () => {
    const document = prepareWebPdfHtml("<html><head></head><body>تقرير MADD</body></html>", "تقرير <MADD>");

    expect(document).toContain("<title>تقرير &lt;MADD&gt;</title>");
    expect(document).toContain("@media print");
    expect(document).toContain("تقرير MADD");
  });
});
